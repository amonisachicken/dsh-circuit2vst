#!/usr/bin/env node
/**
 * Build the synthetic parity documents.
 *
 * The four shipped examples cover RC / diode / BJT / op-amp, but not
 * potentiometers, net labels, mirror/rotation, the `nc` symbol or most lint
 * branches. These documents fill those gaps and are committed, so the parity
 * test does not depend on this script at run time.
 *
 * Layout rules that keep the drawings unambiguous:
 *
 * - parts sit on fixed, widely spaced slots;
 * - every connection is a wire routed through its **own** channel (unique
 *   `channelY` + `channelX`), so no two routes share a segment, and an elbow
 *   endpoint can never land inside another route;
 * - the only intended coincidence is a pin sitting on its own routing point.
 *
 * Note: upstream derives a net's name by iterating a `HashMap` of explicit names,
 * so two different labels on the same net make the name depend on iteration
 * order. That corner is deliberately excluded — it is non-deterministic upstream,
 * not something a port could match.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { toWorld } from '../src/client/circuit-netlist.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SYMBOLS = JSON.parse(readFileSync(join(ROOT, 'vendor/circuit/symbols.json'), 'utf8')).symbols
const OUT = join(HERE, 'fixtures', 'parity')
mkdirSync(OUT, { recursive: true })

/**
 * Build a placed part at a slot.
 * @param ref - reference designator.
 * @param symbol - symbols.json key.
 * @param x - slot x.
 * @param y - slot y.
 * @param extra - rot / mirror / model / value / alias.
 * @returns a document part.
 */
function part(ref, symbol, x, y, extra = {}) {
  return {
    id: `p${ref}`,
    ref,
    symbol,
    at: { x, y },
    rot: extra.rot ?? 0,
    mirror: extra.mirror ?? 'none',
    ...(extra.model === undefined ? {} : { model: extra.model }),
    ...(extra.value === undefined ? {} : { value: extra.value }),
    ...(extra.alias === undefined ? {} : { alias: extra.alias }),
  }
}

/**
 * World position of one pin.
 * @param placed - document part.
 * @param pinId - pin id in symbols.json.
 * @returns `{x, y}`.
 */
function pin(placed, pinId) {
  const spec = SYMBOLS[placed.symbol].pins.find((candidate) => candidate.id === pinId)
  if (spec === undefined) throw new Error(`${placed.symbol} 没有引脚 ${pinId}`)
  return toWorld(spec.at, placed)
}

/**
 * Assemble a document.
 * @param name - document name.
 * @param build - receives the document and helpers.
 */
function make(name, build) {
  const doc = { version: 1, name, parts: [], wires: [], nextId: 1 }
  let routes = 0
  const add = (placed) => { doc.parts.push(placed); return placed }
  // The upstream document only ever holds two-point wires: the generator reads
  // `points[0]` and `points[1]`, and the editor splits every stroke into
  // segments. Route polylines are therefore emitted segment by segment.
  const wire = (points) => {
    for (let index = 1; index < points.length; index += 1) {
      doc.wires.push({ id: `w${doc.wires.length + 1}`, points: [points[index - 1], points[index]] })
    }
  }
  const rawWire = (points) => { doc.wires.push({ id: `w${doc.wires.length + 1}`, points }) }
  /**
   * Connect two pins with one straight segment.
   *
   * Elbow routing was the obvious idea and it was wrong: a horizontal run along
   * a row of pins, or a vertical run down a column, makes the wire pass through
   * unrelated pins (the generator unions a pin that lies on any segment). A
   * single two-point wire only ever touches its own endpoints, and the netlist
   * generator does not require orthogonal wires — that rule belongs to the editor.
   *
   * @param from - part.
   * @param fromPin - source pin id.
   * @param to - part.
   * @param toPin - target pin id.
   */
  const connect = (from, fromPin, to, toPin) => {
    wire([pin(from, fromPin), pin(to, toPin)])
  }
  build(doc, { add, connect, wire, rawWire, pin })
  doc.nextId = doc.parts.length + doc.wires.length + 1
  writeFileSync(join(OUT, `${name}.design.json`), `${JSON.stringify(doc, null, 2)}\n`)
  console.log(`✓ ${name}.design.json（${doc.parts.length} 元件，${doc.wires.length} 导线）`)
}

make('parity-pot', (doc, { add, connect }) => {
  const input = add(part('IN1', 'node-in', 0, 0))
  const pot = add(part('P1', 'potentiometer', 60, 0, { alias: 'gain', value: '500k' }))
  const output = add(part('OUT1', 'node-out', 120, 0))
  const ground = add(part('GND1', 'earth', 80, 120))
  connect(input, 'IN', pot, '1')
  connect(pot, '2', output, 'OUT')
  connect(pot, '3', ground, 'GND')
  // Defaults (no value / no alias) plus deliberately free pins.
  add(part('P2', 'potentiometer', 120, 60))
  void doc
})

make('parity-bjt-mirror', (doc, { add, connect }) => {
  const input = add(part('IN1', 'node-in', 0, 0))
  const base = add(part('R1', 'resistor', 80, 40, { value: '4.7k' }))
  const transistor = add(part('Q1', 'npn', 160, 0, { rot: 90, mirror: 'x', model: 'BC549C' }))
  const collector = add(part('R2', 'resistor', 160, 80, { value: '10k' }))
  const supply = add(part('VCC1', 'vcc', 240, 80))
  const ground = add(part('GND1', 'earth', 60, 60))
  const output = add(part('OUT1', 'node-out', 240, 0))
  connect(input, 'IN', base, '1')
  connect(base, '2', transistor, 'B')
  connect(transistor, 'C', collector, '2')
  connect(collector, '1', supply, 'VCC')
  connect(transistor, 'E', ground, 'GND')
  connect(transistor, 'C', output, 'OUT')
  void doc
})

make('parity-opamp', (doc, { add, connect }) => {
  // Feedback resistor sits well above the output row: a wire along y = 0 must
  // not graze its pins (a pin that lies on a segment joins that net).
  const input = add(part('IN1', 'node-in', 0, 0))
  const amp = add(part('U1', 'opamp', 60, 0, { rot: 180, model: 'OP07A' }))
  const feedback = add(part('R1', 'resistor', 120, -80, { value: '100k' }))
  const toGround = add(part('R2', 'resistor', 60, 80, { value: '10k' }))
  const positive = add(part('V1', 'vcc', 120, 80))
  const negative = add(part('V2', 'vee', 180, 80))
  const ground = add(part('GND1', 'earth', 0, 80))
  const output = add(part('OUT1', 'node-out', 240, 0))
  connect(input, 'IN', amp, 'IN+')
  connect(positive, 'VCC', amp, 'V+')
  connect(negative, 'VEE', amp, 'V-')
  connect(amp, 'OUT', output, 'OUT')
  connect(amp, 'IN-', feedback, '1')
  connect(feedback, '2', amp, 'OUT')
  connect(amp, 'IN-', toGround, '1')
  connect(toGround, '2', ground, 'GND')
  void doc
})

make('parity-mosfet', (doc, { add, connect }) => {
  const input = add(part('IN1', 'node-in', 0, 0))
  const gate = add(part('R1', 'resistor', 60, 0, { value: '1meg' }))
  const transistor = add(part('M1', 'mosfet-n', 120, 0, { model: '2N7000' }))
  const drain = add(part('R2', 'resistor', 180, 0, { value: '2.2k' }))
  const supply = add(part('VCC1', 'vcc', 240, 0))
  const ground = add(part('GND1', 'earth', 120, 60))
  const probe = add(part('TP1', 'test-point', 300, 0))
  const spare = add(part('NC1', 'nc', 300, 60))
  const output = add(part('OUT1', 'node-out', 360, 0))
  connect(input, 'IN', gate, '1')
  connect(gate, '2', transistor, 'G')
  connect(transistor, 'D', drain, '2')
  connect(drain, '1', supply, 'VCC')
  connect(transistor, 'S', ground, 'GND')
  connect(transistor, 'D', probe, 'TP')
  connect(probe, 'TP', output, 'OUT')
  connect(output, 'OUT', spare, 'NC')
  void doc
})

make('parity-lints', (doc, { add, connect, rawWire, pin }) => {
  // Duplicate references, an unknown symbol, missing / wrong model, no ground,
  // no ports, a dangling pin and a wire with a single anchor.
  const first = add(part('R1', 'resistor', 0, 0, { value: '1k' }))
  const second = add(part('R1', 'resistor', 60, 0, { value: '2k' }))
  add(part('X9', 'not-a-symbol', 120, 0))
  add(part('Q1', 'npn', 180, 0))
  add(part('D1', 'diode', 240, 0, { model: '1N9999' }))
  connect(first, '2', second, '1')
  rawWire([pin(second, '2')])
  void doc
})

make('parity-source', (doc, { add, connect }) => {
  const source = add(part('V1', 'voltage-source', 0, 0, { value: '9' }))
  const input = add(part('IN1', 'node-in', 60, 0))
  const resistor = add(part('R1', 'resistor', 120, 0, { value: '47k' }))
  const ground = add(part('GND1', 'earth', 0, 60))
  const output = add(part('OUT1', 'node-out', 180, 0))
  connect(source, '+', input, 'IN')
  connect(source, '-', ground, 'GND')
  connect(input, 'IN', resistor, '1')
  connect(resistor, '2', output, 'OUT')
  void doc
})

make('parity-wires', (doc, { add, wire, pin }) => {
  // A real T junction: a stub whose endpoint lands mid-segment, so union can
  // only come from `on_segment`, not from shared endpoints.
  const input = add(part('IN1', 'node-in', 0, 0))
  const first = add(part('R1', 'resistor', 60, 0, { value: '1k', rot: 90 }))
  const second = add(part('R2', 'resistor', 60, 80, { value: '2k' }))
  const output = add(part('OUT1', 'node-out', 120, 0))
  const start = pin(input, 'IN')
  const firstIn = pin(first, '1')
  const firstOut = pin(first, '2')
  wire([start, { x: firstIn.x, y: start.y }, firstIn])
  // The stub starts at a point inside the horizontal run above and goes down to
  // R1's other pin: the junction is only visible to `on_segment`.
  const stubTop = { x: (start.x + firstIn.x) / 2, y: start.y }
  wire([stubTop, { x: stubTop.x, y: firstOut.y }, firstOut])
  // A second net, routed well below the first one.
  const secondIn = pin(second, '1')
  const secondOut = pin(second, '2')
  wire([secondIn, { x: secondIn.x, y: 150 }, { x: secondOut.x, y: 150 }, secondOut])
  wire([pin(output, 'OUT'), { x: pin(output, 'OUT').x, y: 150 }, { x: secondOut.x, y: 150 }])
  void doc
})
