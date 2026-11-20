/**
 * Hit-test priority: the part drawn on top must win.
 *
 * Regression for the external report (2026-11-20): `circuitHitTest` kept the
 * first part on a distance tie, while rendering draws later parts on top — an
 * overlapping click (two parts within 15 mm) always picked the oldest one, so
 * copy/move operated on the wrong part.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { circuitHitTest, circuitPartBox } from '../src/client/circuit-netlist.js'

const SYMBOLS = JSON.parse(readFileSync(new URL('../vendor/circuit/symbols.json', import.meta.url), 'utf8')).symbols

/** One placed part. */
function part(id, ref, symbol, x, y) {
  return { id, ref, symbol, at: { x, y }, rot: 0, mirror: 'none' }
}

test('overlapping parts: the later one (drawn on top) wins', () => {
  const doc = {
    parts: [part('p1', 'R1', 'resistor', 0, 0), part('p2', 'R2', 'resistor', 0, 0)],
    wires: [],
  }
  const hit = circuitHitTest(doc, SYMBOLS, { x: 0, y: 0 }, 5)
  assert.equal(hit.partId, 'p2', '应当命中后创建、视觉在上层的 R2')
})

test('a nearer part still wins over a farther one', () => {
  const doc = {
    parts: [part('p1', 'R1', 'resistor', 0, 0), part('p2', 'R2', 'resistor', 0, 40)],
    wires: [],
  }
  const hit = circuitHitTest(doc, SYMBOLS, { x: 0, y: 40 }, 5)
  assert.equal(hit.partId, 'p2')
})

test('a click far from everything hits nothing', () => {
  const doc = { parts: [part('p1', 'R1', 'resistor', 0, 0)], wires: [] }
  assert.deepEqual(circuitHitTest(doc, SYMBOLS, { x: 500, y: 500 }, 5), { partId: null, wireId: null })
})

test('a wire over a part still wins (wires are thinner)', () => {
  const doc = {
    parts: [part('p1', 'R1', 'resistor', 0, 0)],
    wires: [{ id: 'w1', points: [{ x: -20, y: 0 }, { x: 20, y: 0 }] }],
  }
  const hit = circuitHitTest(doc, SYMBOLS, { x: 0, y: 0 }, 5)
  assert.equal(hit.wireId, 'w1')
  assert.equal(hit.partId, null)
})

test('the part box matches the symbol canvas', () => {
  const box = circuitPartBox(part('p1', 'R1', 'resistor', 0, 0), SYMBOLS.resistor)
  assert.ok(box.maxX - box.minX > 0 && box.maxY - box.minY > 0)
  assert.ok(box.minX <= 0 && box.maxX >= 0)
})
