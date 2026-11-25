/**
 * Circuit canvas (M4.1) — a React rewrite of the upstream designer's view layer.
 *
 * The document model, geometry rules and the netlist engine are already ported
 * (`src/client/circuit-netlist.js`, byte-parity tested). This module adds the
 * surface the upstream app shows: a 2.5 mm grid, symbol art with labels that stay
 * upright, wires with T-junction dots, dangling-pin circles, pan/zoom, a 5 mm
 * hit tolerance with wire priority, selection/hover, a property panel and a live
 * netlist/lint readout.
 *
 * Editing modes (`r/c/g/w/q/m/d`) are M4.2; for now the canvas is a viewer plus
 * the property fields that only touch data (alias / value / rotation).
 */

/** Grid step in millimetres (upstream D-003). */
const CIRCUIT_GRID = 2.5
/** Geometry tolerance, same as the netlist engine. */
const CIRCUIT_EPS = 1e-6
/** Hit radius: 2×2 grid cells. */
const HIT_TOLERANCE_MM = CIRCUIT_GRID * 2

/** Value units offered per symbol, mirrored from the upstream model. */
const CIRCUIT_VALUE_UNITS = {
  resistor: ['k', 'Ω'],
  capacitor: ['n', 'p', 'u'],
  potentiometer: ['k', 'Ω'],
  'voltage-source': ['V'],
  inductor: ['m', 'u', ''],
  transformer: ['m', 'u', ''],
}

/** Display names for unit suffixes (resistance / capacitance / voltage). */
const CIRCUIT_UNIT_LABEL = { '': 'Ω', k: 'kΩ', p: 'pF', n: 'nF', u: 'µF', V: 'V' }

/** Units whose letters mean henries instead of the default table. */
const CIRCUIT_UNIT_LABEL_HENRY = { '': 'H', m: 'mH', u: 'µH' }
const CIRCUIT_HENRY_SYMBOLS = new Set(['inductor', 'transformer'])

/**
 * Display text for one unit suffix, per symbol (inductor/transformer show H).
 * @param symbol - symbol id.
 * @param unit - unit suffix.
 * @returns display text.
 */
function circuitUnitLabel(symbol, unit) {
  if (CIRCUIT_HENRY_SYMBOLS.has(symbol)) return CIRCUIT_UNIT_LABEL_HENRY[unit] ?? unit
  return CIRCUIT_UNIT_LABEL[unit] ?? unit
}

/** Same-point test used by the junction finder. */
function circuitSamePoint(left, right) {
  return Math.abs(left.x - right.x) < CIRCUIT_EPS && Math.abs(left.y - right.y) < CIRCUIT_EPS
}

/**
 * Whether a point lies strictly inside an orthogonal segment.
 * @param point - candidate.
 * @param start - segment start.
 * @param end - segment end.
 * @returns true when the point is interior.
 */
function circuitOnSegmentInterior(point, start, end) {
  if (Math.abs(start.y - end.y) < CIRCUIT_EPS) {
    return Math.abs(point.y - start.y) < CIRCUIT_EPS
      && point.x > Math.min(start.x, end.x) + CIRCUIT_EPS
      && point.x < Math.max(start.x, end.x) - CIRCUIT_EPS
  }
  if (Math.abs(start.x - end.x) < CIRCUIT_EPS) {
    return Math.abs(point.x - start.x) < CIRCUIT_EPS
      && point.y > Math.min(start.y, end.y) + CIRCUIT_EPS
      && point.y < Math.max(start.y, end.y) - CIRCUIT_EPS
  }
  return false
}

/**
 * Junction dots: T junctions (an endpoint inside another wire) and 3+ coincident
 * endpoints. A crossing (interior × interior) is not a connection and gets none.
 * @param wires - document wires.
 * @returns points to dot.
 */
function circuitWireJunctions(wires) {
  const points = []
  const add = (point) => {
    if (!points.some((existing) => circuitSamePoint(existing, point))) points.push(point)
  }
  for (const wire of wires) {
    for (const point of wire.points) {
      for (const other of wires) {
        if (other.id === wire.id) continue
        if (circuitOnSegmentInterior(point, other.points[0], other.points[1])) add(point)
      }
    }
  }
  const ends = wires.flatMap((wire) => wire.points)
  for (const point of ends) {
    if (ends.filter((other) => circuitSamePoint(other, point)).length >= 3) add(point)
  }
  return points
}

/**
 * Millimetres → screen pixels.
 * @param point - mm point.
 * @param view - `{scale, pan}`.
 * @returns pixel point.
 */
const circuitMmToScreen = (point, view) => ({ x: point.x * view.scale + view.pan.x, y: point.y * view.scale + view.pan.y })

/**
 * Screen pixels → millimetres.
 * @param point - pixel point.
 * @param view - `{scale, pan}`.
 * @returns mm point.
 */
const circuitScreenToMm = (point, view) => ({ x: (point.x - view.pan.x) / view.scale, y: (point.y - view.pan.y) / view.scale })

/**
 * Where the reference label sits: below the rotated box, or right of it when the
 * part is taller than wide.
 * @param part - document part.
 * @param symbol - symbol spec.
 * @returns anchor in millimetres.
 */
function circuitLabelAnchor(part, symbol) {
  const box = circuitPartBox(part, symbol)
  if (box.maxY - box.minY > box.maxX - box.minX) {
    return { x: box.maxX + 2.5, y: (box.minY + box.maxY) / 2 }
  }
  return { x: (box.minX + box.maxX) / 2, y: box.maxY + 2.5 }
}

/**
 * Fit a document into a viewport (upstream `circuitFitView`).
 * @param doc - document.
 * @param symbols - symbol table.
 * @param viewport - `{w, h}` in pixels.
 * @returns a view.
 */
function circuitFitView(doc, symbols, viewport) {
  const points = []
  for (const part of doc.parts) {
    const symbol = symbols[part.symbol]
    if (symbol === undefined) continue
    for (const pin of symbol.pins) points.push(toWorld(pin.at, part))
    points.push(part.at)
  }
  for (const wire of doc.wires) points.push(...wire.points)
  if (points.length === 0) return { scale: 8, pan: { x: 120, y: 100 } }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 15
  const width = Math.max(maxX - minX + pad * 2, 40)
  const height = Math.max(maxY - minY + pad * 2, 30)
  const scale = Math.min(viewport.w / width, viewport.h / height, 24)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  return { scale, pan: { x: viewport.w / 2 - centerX * scale, y: viewport.h / 2 - centerY * scale } }
}

/**
 * Split a SPICE-ish value into number and unit.
 * @param value - e.g. `10k`.
 * @param units - allowed units for the symbol.
 * @returns `{num, unit}`.
 */
function circuitSplitValue(value, units) {
  const fallback = units[0] ?? ''
  if (value === undefined || value === null || value === '') return { num: '', unit: fallback }
  const match = /^\s*([-+]?[\d.]+)\s*(p|n|u|µ|m|k|M|V)?\s*$/.exec(value)
  if (match === null) return { num: String(value), unit: fallback }
  const raw = match[2] ?? ''
  const unit = raw === 'µ' ? 'u' : raw
  return { num: match[1] ?? '', unit: units.includes(unit) ? unit : fallback }
}

/**
 * Join a number and unit back into a SPICE value.
 * @param num - numeric text.
 * @param unit - unit suffix.
 * @returns the value text.
 */
function circuitJoinValue(num, unit) {
  const text = String(num).trim()
  if (text === '') return ''
  return unit === 'Ω' || unit === 'V' || unit === '' ? text : `${text}${unit}`
}

/**
 * The circuit canvas surface.
 * @param props.project - selected project (shown for context).
 * @param props.t - translator.
 * @param props.onError - report failures to the panel.
 */
/** Snap a coordinate to the document grid (D-003). */
const circuitSnap = (value) => Math.round(value / CIRCUIT_GRID) * CIRCUIT_GRID

/**
 * Next document id (`p1`, `w4`, …), bumping `doc.nextId`.
 * @param doc - document.
 * @param kind - id prefix.
 * @returns the new id.
 */
const circuitNextId = (doc, kind) => `${kind}${doc.nextId++}`

/**
 * Next free reference for a prefix: highest number + 1, no hole filling.
 * @param doc - document.
 * @param prefix - SPICE prefix, e.g. `R`.
 * @returns e.g. `R7`.
 */
function circuitNextRef(doc, prefix) {
  let max = 0
  for (const part of doc.parts) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(part.ref)
    if (match !== null) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}${max + 1}`
}

/** Values a freshly placed part starts with (mirrors the upstream defaults). */
const CIRCUIT_PART_DEFAULTS = {
  resistor: { value: '10k' },
  capacitor: { value: '100n' },
  potentiometer: { value: '500k' },
  inductor: { value: '10m' },
  transformer: { value: '1' },
  diode: { model: '1N4148' },
  led: { model: 'LedRed' },
  npn: { model: 'BC549C' },
  pnp: { model: 'BC559C' },
  'jfet-n': { model: 'J201' },
  'mosfet-n': { model: '2N7000' },
  opamp: { model: 'OP07A' },
}

/**
 * Points where a merge would swallow a T junction (D-023): an endpoint of one
 * wire lying inside a perpendicular wire.
 * @param wires - current wires.
 * @returns barrier points.
 */
function circuitMergeBarriers(wires) {
  const points = []
  const add = (point) => {
    if (!points.some((existing) => circuitSamePoint(existing, point))) points.push(point)
  }
  for (const wire of wires) {
    const horizontal = Math.abs(wire.points[0].y - wire.points[1].y) < CIRCUIT_EPS
    for (const point of wire.points) {
      for (const other of wires) {
        if (other.id === wire.id) continue
        if (!circuitOnSegmentInterior(point, other.points[0], other.points[1])) continue
        const otherHorizontal = Math.abs(other.points[0].y - other.points[1].y) < CIRCUIT_EPS
        if (horizontal !== otherHorizontal) add(point)
      }
    }
  }
  return points
}

/**
 * Whether merging two collinear segments would erase a barrier point.
 * @param current - accumulated segment.
 * @param next - segment being merged.
 * @param barriers - barrier points.
 * @returns true when the merge must be skipped.
 */
function circuitMergeErasesBarrier(current, next, barriers) {
  if (barriers.length === 0) return false
  const low = Math.min(current.lo, next.lo)
  const high = Math.max(current.hi, next.hi)
  const erased = [current.lo, current.hi, next.lo, next.hi].filter((value) => value > low + CIRCUIT_EPS && value < high - CIRCUIT_EPS)
  if (erased.length === 0) return false
  for (const point of barriers) {
    const onLine = current.horiz ? Math.abs(point.y - current.coord) < CIRCUIT_EPS : Math.abs(point.x - current.coord) < CIRCUIT_EPS
    if (!onLine) continue
    const value = current.horiz ? point.x : point.y
    if (erased.some((candidate) => Math.abs(candidate - value) < CIRCUIT_EPS)) return true
  }
  return false
}

/**
 * Merge collinear segments that overlap or touch, keeping the earliest id.
 * Crossings are not merged; T junctions are protected by barriers.
 * @param wires - wires to normalise.
 * @returns a new wire list.
 */
function circuitNormalizeWires(wires) {
  const segments = []
  for (const wire of wires) {
    const [a, b] = wire.points
    if (Math.abs(a.y - b.y) < CIRCUIT_EPS) {
      segments.push({ horiz: true, coord: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x), id: wire.id })
    } else if (Math.abs(a.x - b.x) < CIRCUIT_EPS) {
      segments.push({ horiz: false, coord: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y), id: wire.id })
    } else {
      segments.push({ horiz: true, coord: Number.NaN, lo: 0, hi: 0, id: wire.id })
    }
  }
  const groups = new Map()
  for (const segment of segments) {
    if (Number.isNaN(segment.coord)) continue
    const key = `${segment.horiz ? 'h' : 'v'}:${segment.coord.toFixed(4)}`
    const list = groups.get(key) ?? []
    list.push(segment)
    groups.set(key, list)
  }
  const toWire = (segment) => (segment.horiz
    ? { id: segment.id, points: [{ x: segment.lo, y: segment.coord }, { x: segment.hi, y: segment.coord }] }
    : { id: segment.id, points: [{ x: segment.coord, y: segment.lo }, { x: segment.coord, y: segment.hi }] })
  const merged = []
  const barriers = circuitMergeBarriers(wires)
  for (const list of groups.values()) {
    list.sort((left, right) => left.lo - right.lo || left.hi - right.hi)
    let current = { ...list[0] }
    for (const segment of list.slice(1)) {
      if (segment.lo <= current.hi + CIRCUIT_EPS && !circuitMergeErasesBarrier(current, segment, barriers)) {
        current.hi = Math.max(current.hi, segment.hi)
      } else {
        merged.push(toWire(current))
        current = { ...segment }
      }
    }
    merged.push(toWire(current))
  }
  for (const wire of wires) {
    const [a, b] = wire.points
    const axis = Math.abs(a.y - b.y) < CIRCUIT_EPS || Math.abs(a.x - b.x) < CIRCUIT_EPS
    if (!axis) merged.push(wire)
  }
  return merged
    .filter((wire) => Math.abs(wire.points[0].x - wire.points[1].x) > CIRCUIT_EPS || Math.abs(wire.points[0].y - wire.points[1].y) > CIRCUIT_EPS)
    .sort((left, right) => left.id.localeCompare(right.id, 'en', { numeric: true }))
}

/**
 * Cut the part of a wire that spans two collinear pins (D-021).
 * @param doc - document, mutated.
 * @param left - first pin.
 * @param right - second pin.
 * @returns true when something was cut.
 */
function circuitTrimWireBetweenPins(doc, left, right) {
  const horizontal = Math.abs(left.y - right.y) < CIRCUIT_EPS
  const vertical = Math.abs(left.x - right.x) < CIRCUIT_EPS
  if (!horizontal && !vertical) return false
  const coord = horizontal ? left.y : left.x
  const low = horizontal ? Math.min(left.x, right.x) : Math.min(left.y, right.y)
  const high = horizontal ? Math.max(left.x, right.x) : Math.max(left.y, right.y)
  if (high - low < CIRCUIT_EPS) return false

  let changed = false
  const out = []
  for (const wire of doc.wires) {
    const [a, b] = wire.points
    const sameLine = horizontal
      ? Math.abs(a.y - b.y) < CIRCUIT_EPS && Math.abs(a.y - coord) < CIRCUIT_EPS
      : Math.abs(a.x - b.x) < CIRCUIT_EPS && Math.abs(a.x - coord) < CIRCUIT_EPS
    if (!sameLine) { out.push(wire); continue }
    const wireLow = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
    const wireHigh = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
    if (wireLow > low + CIRCUIT_EPS || wireHigh < high - CIRCUIT_EPS) { out.push(wire); continue }
    changed = true
    const make = (from, to, id) => {
      if (to - from < CIRCUIT_EPS) return null
      const points = horizontal
        ? [{ x: from, y: coord }, { x: to, y: coord }]
        : [{ x: coord, y: from }, { x: coord, y: to }]
      const cut = { id, points }
      if (wire.net !== undefined) cut.net = wire.net
      return cut
    }
    const head = make(wireLow, low, wire.id)
    const tail = make(high, wireHigh, head === null ? wire.id : circuitNextId(doc, 'w'))
    if (head !== null) out.push(head)
    if (tail !== null) out.push(tail)
  }
  if (changed) doc.wires = out
  return changed
}

/**
 * Trim wires that run between a part's collinear pins (BJT C–E, op-amp IN+/IN−,
 * pot 1–3, …).
 * @param doc - document, mutated.
 * @param symbols - symbol table.
 * @returns true when something was cut.
 */
function circuitTrimWiresUnderParts(doc, symbols) {
  let changed = false
  for (const part of doc.parts) {
    const symbol = symbols[part.symbol]
    if (symbol === undefined || symbol.pins.length < 2) continue
    const pins = symbol.pins.map((pin) => toWorld(pin.at, part))
    const seenRows = new Set()
    const seenColumns = new Set()
    for (const pin of pins) {
      const rowKey = pin.y.toFixed(4)
      if (!seenRows.has(rowKey)) {
        seenRows.add(rowKey)
        const row = pins.filter((other) => Math.abs(other.y - pin.y) < CIRCUIT_EPS).sort((left, right) => left.x - right.x)
        if (row.length >= 2 && circuitTrimWireBetweenPins(doc, row[0], row[row.length - 1])) changed = true
      }
      const columnKey = pin.x.toFixed(4)
      if (!seenColumns.has(columnKey)) {
        seenColumns.add(columnKey)
        const column = pins.filter((other) => Math.abs(other.x - pin.x) < CIRCUIT_EPS).sort((left, right) => left.y - right.y)
        if (column.length >= 2 && circuitTrimWireBetweenPins(doc, column[0], column[column.length - 1])) changed = true
      }
    }
  }
  return changed
}

/** Next rotation step. */
const circuitRotStep = (rot) => (rot + 90) % 360

/** Toggle mirror axis: none ⇄ x. */
const circuitFlipMirror = (mirror) => (mirror === 'x' ? 'none' : 'x')

/**
 * Orthogonal wire endpoints: the dominant axis wins, the other snaps to the start.
 * @param from - start point.
 * @param to - cursor.
 * @returns `[start, end]` snapped.
 */
function circuitOrtho(from, to) {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const end = dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  return [{ x: circuitSnap(from.x), y: circuitSnap(from.y) }, { x: circuitSnap(end.x), y: circuitSnap(end.y) }]
}

/**
 * Preview end point for the wire being drawn.
 * @param from - start point.
 * @param to - cursor.
 * @returns the snapped end point.
 */
function circuitOrthoPoint(from, to) {
  const [a, b] = circuitOrtho(from, to)
  return a.x === b.x ? { x: a.x, y: b.y } : { x: b.x, y: a.y }
}

/**
 * Enter placement mode for a symbol.
 * @param symbol - symbol key.
 * @param hooks - editor hooks.
 * @param at - initial position (usually the cursor).
 * @param attrs - attributes carried over by copy (D-022).
 */
function circuitEnterPlace(symbol, hooks, at, attrs) {
  const spec = hooks.symbols[symbol]
  if (spec === undefined) return
  hooks.setMode({ kind: 'place', symbol, at: { ...at }, rot: 0, mirror: 'none', ...(attrs === undefined ? {} : { attrs }) })
  hooks.status(`放置 ${spec.name?.zh ?? symbol}：左键落点，ctrl+r 旋转，ctrl+e 镜像，esc 退出`)
}

/**
 * Attributes carried by `d` (value / model / alias / signal settings).
 * @param source - part being copied.
 * @returns partial part attributes.
 */
function circuitCopyAttrs(source) {
  const attrs = {}
  if (source.value !== undefined) attrs.value = source.value
  if (source.model !== undefined) attrs.model = source.model
  if (source.alias !== undefined) attrs.alias = source.alias
  if (source.amp !== undefined) attrs.amp = source.amp
  if (source.freq !== undefined) attrs.freq = source.freq
  return attrs
}

/**
 * Drop the part held in placement mode.
 * @param mode - place mode.
 * @param hooks - editor hooks.
 */
function circuitCommitPlace(mode, hooks) {
  const spec = hooks.symbols[mode.symbol]
  if (spec === undefined) return
  const prefix = spec.spice.prefix || 'X'
  const part = {
    id: circuitNextId(hooks.doc, 'p'),
    ref: circuitNextRef(hooks.doc, prefix),
    symbol: mode.symbol,
    at: { x: circuitSnap(mode.at.x), y: circuitSnap(mode.at.y) },
    rot: mode.rot,
    mirror: mode.mirror,
    ...(CIRCUIT_PART_DEFAULTS[mode.symbol] ?? {}),
    ...(mode.attrs ?? {}),
  }
  hooks.commit()
  hooks.doc.parts.push(part)
  circuitTrimWiresUnderParts(hooks.doc, hooks.symbols)
  hooks.changed()
  hooks.status(`${part.ref} 已放置`)
}

/**
 * Rotate the part being placed or moved.
 * @param mode - current mode.
 * @param hooks - editor hooks.
 */
function circuitToggleRotate(mode, hooks) {
  if (mode.kind === 'place') {
    hooks.setMode({ ...mode, rot: circuitRotStep(mode.rot) })
  } else if (mode.kind === 'move') {
    const part = hooks.doc.parts.find((candidate) => candidate.id === mode.partId)
    if (part === undefined) return
    hooks.commit()
    part.rot = circuitRotStep(part.rot)
    hooks.changed()
  }
}

/**
 * Mirror the part being placed or moved.
 * @param mode - current mode.
 * @param hooks - editor hooks.
 */
function circuitToggleMirror(mode, hooks) {
  if (mode.kind === 'place') {
    hooks.setMode({ ...mode, mirror: circuitFlipMirror(mode.mirror) })
  } else if (mode.kind === 'move') {
    const part = hooks.doc.parts.find((candidate) => candidate.id === mode.partId)
    if (part === undefined) return
    hooks.commit()
    part.mirror = circuitFlipMirror(part.mirror)
    hooks.changed()
  }
}

/**
 * Commit one wire segment; returns the next anchor so drawing continues.
 * @param from - start point.
 * @param to - end point.
 * @param hooks - editor hooks.
 * @returns the next anchor (the segment's end).
 */
function circuitCommitWire(from, to, hooks) {
  const [a, b] = circuitOrtho(from, to)
  if (a.x === b.x && a.y === b.y) return a
  hooks.commit()
  hooks.doc.wires.push({ id: circuitNextId(hooks.doc, 'w'), points: [a, b] })
  hooks.changed()
  return b
}

/**
 * Delete a part or a single wire segment.
 * @param hooks - editor hooks.
 * @param partId - hit part, if any.
 * @param wireId - hit wire, if any.
 */
function circuitDeleteAt(hooks, partId, wireId) {
  if (partId !== null) {
    const index = hooks.doc.parts.findIndex((part) => part.id === partId)
    if (index < 0) return
    hooks.commit()
    const [gone] = hooks.doc.parts.splice(index, 1)
    hooks.changed()
    hooks.status(`已删除 ${gone?.ref ?? partId}`)
  } else if (wireId !== null) {
    const index = hooks.doc.wires.findIndex((wire) => wire.id === wireId)
    if (index < 0) return
    hooks.commit()
    hooks.doc.wires.splice(index, 1)
    hooks.changed()
    hooks.status('已删除一段导线')
  }
}

/**
 * Pick a part up for moving; records the original placement for esc.
 * @param partId - part id.
 * @param doc - document.
 * @returns a move mode, or null.
 */
function circuitPickUp(partId, doc) {
  const part = doc.parts.find((candidate) => candidate.id === partId)
  if (part === undefined) return null
  return { kind: 'move', partId, origin: JSON.parse(JSON.stringify(part)), at: { ...part.at } }
}

/**
 * Put the held part down at a snapped position.
 * @param mode - move mode.
 * @param at - drop point.
 * @param hooks - editor hooks.
 */
function circuitDropAt(mode, at, hooks) {
  const part = hooks.doc.parts.find((candidate) => candidate.id === mode.partId)
  if (part === undefined) return
  part.at = { x: circuitSnap(at.x), y: circuitSnap(at.y) }
  circuitTrimWiresUnderParts(hooks.doc, hooks.symbols)
  hooks.changed()
  hooks.status(`${part.ref} 已移动`)
}

/**
 * Esc: put a held part back where it started, then return to view mode.
 * @param mode - current mode.
 * @param hooks - editor hooks.
 */
function circuitCancel(mode, hooks) {
  if (mode.kind === 'move') {
    const part = hooks.doc.parts.find((candidate) => candidate.id === mode.partId)
    if (part !== undefined) {
      part.at = mode.origin.at
      part.rot = mode.origin.rot
      part.mirror = mode.origin.mirror
    }
    hooks.changed()
    hooks.status('已放回原位')
  }
  hooks.setMode({ kind: 'view' })
}

/**
 * Cursor shape for a mode.
 * @param mode - current mode.
 * @returns a CSS cursor value.
 */
function circuitCursorFor(mode) {
  switch (mode.kind) {
    case 'place': return 'crosshair'
    case 'wire': return 'crosshair'
    case 'delete': return 'not-allowed'
    case 'move': return 'grab'
    case 'copy': return 'copy'
    default: return 'default'
  }
}

/**
 * Human-readable mode label for the status bar.
 * @param mode - current mode.
 * @param symbols - symbol table.
 * @returns the label.
 */
function circuitModeLabel(mode, symbols) {
  switch (mode.kind) {
    case 'place': return `放置 ${symbols[mode.symbol]?.name?.zh ?? mode.symbol}`
    case 'wire': return mode.from === null ? '画线（点击起点）' : '画线（点击定点，esc 退出）'
    case 'delete': return '删除'
    case 'move': return '移动（点击放下，esc 放回）'
    case 'copy': return '复制（点击要复制的元件）'
    default: return '查看'
  }
}

/**
 * The circuit canvas surface.
 * @param props.project - selected project (shown for context).
 * @param props.t - translator.
 * @param props.onError - report failures to the panel.
 */
function CircuitCanvas({ project, api, t, onError }) {
  const [example, setExample] = React.useState('')
  const docRef = React.useRef(null)
  const [, repaint] = React.useReducer((value) => value + 1, 0)
  const [mode, setModeState] = React.useState({ kind: 'view' })
  const modeRef = React.useRef({ kind: 'view' })
  const [status, setStatus] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [savedFile, setSavedFile] = React.useState(null)
  const [saveAsOpen, setSaveAsOpen] = React.useState(false)
  const [saveAsName, setSaveAsName] = React.useState('')
  const [view, setView] = React.useState({ scale: 8, pan: { x: 120, y: 100 } })
  const [viewport, setViewport] = React.useState({ w: 900, h: 520 })
  const [selection, setSelection] = React.useState({ partId: null, wireId: null })
  const [hover, setHover] = React.useState({ partId: null, wireId: null })
  const [cursor, setCursor] = React.useState(null)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [showNetlist, setShowNetlist] = React.useState(false)
  const [propsOpen, setPropsOpen] = React.useState(true)
  const [simOpen, setSimOpen] = React.useState(false)
  /** `{net, label}` when the scope was opened from OUT / a test point. */
  const [scopeFocus, setScopeFocus] = React.useState(null)
  const [layouts, setLayouts] = React.useState([])
  const [dirty, setDirty] = React.useState(false)
  /** A freshly loaded example: saving it must ask for a file name first. */
  const [isTemplate, setIsTemplate] = React.useState(false)
  const [paramReport, setParamReport] = React.useState(null)
  const frameRef = React.useRef(null)
  const dragRef = React.useRef(null)
  const cursorMmRef = React.useRef({ x: 0, y: 0 })
  const moveArmedRef = React.useRef(false)
  const pastRef = React.useRef([])
  const futureRef = React.useRef([])
  const lastClickRef = React.useRef({ id: null, at: 0 })
  const hooksRef = React.useRef(null)

  const symbols = CIRCUIT_SYMBOLS.symbols
  const doc = docRef.current

  /** Switch mode through both the ref (for handlers) and React state. */
  const setMode = (next) => {
    // A pending double-click must not survive a mode switch: the first click in
    // copy/move/place would otherwise be swallowed as "second click" (report B).
    lastClickRef.current = { id: null, at: 0 }
    modeRef.current = next
    setModeState(next)
  }

  /** Push one undo step; called before every mutation. */
  const commit = () => {
    pastRef.current.push(JSON.stringify(docRef.current))
    if (pastRef.current.length > 200) pastRef.current.shift()
    futureRef.current.length = 0
    setDirty(true)
  }

  const undo = () => {
    const previous = pastRef.current.pop()
    if (previous === undefined) return
    futureRef.current.push(JSON.stringify(docRef.current))
    Object.assign(docRef.current, JSON.parse(previous))
    repaint()
    setDirty(true)
    setStatus('已撤销')
  }

  const redo = () => {
    const next = futureRef.current.pop()
    if (next === undefined) return
    pastRef.current.push(JSON.stringify(docRef.current))
    Object.assign(docRef.current, JSON.parse(next))
    repaint()
    setDirty(true)
    setStatus('已重做')
  }

  /** Base name of the file currently open, mirrored into a ref for the closures. */
  const currentBaseRef = React.useRef(null)

  const hooks = {
    doc,
    symbols,
    commit,
    changed: repaint,
    setMode,
    status: setStatus,
  }
  hooksRef.current = hooks

  /**
   * Replace the document (no undo history carried over).
   * @param next - document to open.
   * @param message - status line to show.
   */
  const applyDocument = React.useCallback((next, message, options = {}) => {
    docRef.current = JSON.parse(JSON.stringify(next))
    pastRef.current = []
    futureRef.current = []
    setMode({ kind: 'view' })
    setSelection({ partId: null, wireId: null })
    setHover({ partId: null, wireId: null })
    setDirty(false)
    setIsTemplate(options.template === true)
    setStatus(message)
    repaint()
  }, [])

  /** Re-run the manifest ↔ circuit parameter consistency check. */
  const refreshParamReport = React.useCallback(async () => {
    if (api === null) return
    try {
      setParamReport(await api.checkParams())
    } catch (failure) {
      onError(failure)
    }
  }, [api, onError])

  /** Refresh the project's layout list (used by the 载入布局 picker). */
  const refreshLayouts = React.useCallback(async () => {
    if (api === null) return
    try {
      setLayouts(await api.list())
    } catch (failure) {
      onError(failure)
    }
  }, [api, onError])

  /**
   * Save pending edits before switching documents.
   * A template has no file yet, so it is saved under its own name (otherwise the
   * edits would be lost on switch).
   */
  const ensureSaved = async (reason) => {
    if (api === null || !dirty || docRef.current === null) return
    // A template has no file of its own; saving it silently under its own name
    // could clobber an existing layout, so leave it to the explicit save-as.
    if (isTemplate) {
      setStatus(`${reason}：示例模板的修改未保存`)
      return
    }
    try {
      const result = await api.save(docRef.current, currentBaseRef.current ?? docRef.current.name)
      setSavedFile(result.file)
      setDirty(false)
      setIsTemplate(false)
      setStatus(`${reason}：已自动保存 ${result.file}`)
      await refreshLayouts()
    } catch (failure) {
      onError(failure)
      throw failure
    }
  }

  /** Open a layout from the project, saving the current one first. */
  const switchLayout = async (name) => {
    if (api === null || name === '') return
    setBusy('layout')
    try {
      await ensureSaved('切换布局')
      const circuit = await api.load(name)
      if (circuit === null || circuit.exists !== true) throw new Error(`没有这个布局：${name}`)
      setSavedFile(circuit.file)
      applyDocument(JSON.parse(circuit.text), `已载入 ${circuit.file}`)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy('')
    }
  }

  /** Open one of the bundled examples as a template (auto-saves the current one). */
  const startExample = async (name) => {
    const source = CIRCUIT_EXAMPLES[name]
    if (source === undefined) {
      onError(new Error(`没有示例 ${name}`))
      return
    }
    setBusy('example')
    try {
      await ensureSaved('载入示例')
      setSavedFile(null)
      applyDocument(source, `示例「${name}」：模板，首次「保存布局」会另存为新布局`, { template: true })
      setExample(name)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy('')
    }
  }

  // Open the project's circuit document; fall back to an example so the canvas
  // is never empty on first use.
  React.useEffect(() => {
    if (api === null) {
      // No project selected: read-only example preview.
      void startExample('lowpass')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const circuit = await api.load()
        if (cancelled) return
        if (circuit !== null && circuit.exists === true) {
          setSavedFile(circuit.file)
          setExample('')
          applyDocument(JSON.parse(circuit.text), `已载入 ${circuit.file}`)
        } else {
          await startExample('lowpass')
        }
        await refreshLayouts()
        await refreshParamReport()
      } catch (failure) {
        if (cancelled) return
        onError(failure)
        void startExample('lowpass')
      }
    })()
    return () => { cancelled = true }
  }, [api]) // eslint-disable-line react-hooks/exhaustive-deps

  // Measure the canvas; the frame only exists once a document is loaded.
  React.useEffect(() => {
    const element = frameRef.current
    if (element === null) return undefined
    const measure = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setViewport({ w: Math.round(rect.width), h: Math.round(rect.height) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [doc !== null])

  React.useEffect(() => {
    if (docRef.current === null) return
    setView(circuitFitView(docRef.current, symbols, viewport))
  }, [docRef.current === null ? null : docRef.current.name, viewport.w, viewport.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: modal editing (upstream key table).
  React.useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target
      if (target !== null && typeof target.matches === 'function' && target.matches('input, textarea, select')) return
      if (docRef.current === null || hooksRef.current === null) return
      const editor = hooksRef.current
      const current = modeRef.current
      const accel = event.metaKey || event.ctrlKey
      if (accel && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return }
      if (accel && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
      if (accel && event.key.toLowerCase() === 'r') { event.preventDefault(); circuitToggleRotate(current, editor); return }
      if (accel && event.key.toLowerCase() === 'e') { event.preventDefault(); circuitToggleMirror(current, editor); return }
      switch (event.key) {
        case 'Escape':
          circuitCancel(current, editor)
          setSelection({ partId: null, wireId: null })
          setPaletteOpen(false)
          setHelpOpen(false)
          return
        case ' ':
          event.preventDefault()
          setPaletteOpen(true)
          return
        case 'r': circuitEnterPlace('resistor', editor, cursorMmRef.current); return
        case 'c': circuitEnterPlace('capacitor', editor, cursorMmRef.current); return
        case 'g': circuitEnterPlace('earth', editor, cursorMmRef.current); return
        case 'l': circuitEnterPlace('inductor', editor, cursorMmRef.current); return
        case 'h': event.preventDefault(); setHelpOpen((open) => !open); return
        case 'w': setMode({ kind: 'wire', from: null }); editor.status('画线：点击起点（只走上下左右），esc 退出'); return
        case 'q': setMode({ kind: 'delete' }); editor.status('删除：点元件删元件；点导线只删该段'); return
        case 'm': moveArmedRef.current = true; setMode({ kind: 'view' }); editor.status('移动：点一个元件拿起（点击画布放下，esc 放回）'); return
        case 'd': setMode({ kind: 'copy' }); editor.status('复制：点要复制的元件'); return
        default: return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A fresh selection brings the floating panel back.
  React.useEffect(() => {
    if (selection.partId !== null || selection.wireId !== null) setPropsOpen(true)
  }, [selection.partId, selection.wireId])

  /** Base name of the file currently open (`circuit/<base>.design.json`). */
  const currentBase = savedFile === null
    ? null
    : savedFile.replace(/^circuit\//, '').replace(/\.design\.json$/, '')
  currentBaseRef.current = currentBase

  /** Save into the file the canvas opened (or `<doc name>` on first save). */
  const saveDocument = async () => {
    if (api === null || docRef.current === null) return
    // An example is a template: the first save must become a "save as".
    if (isTemplate) {
      setSaveAsName(docRef.current.name ?? '')
      setSaveAsOpen(true)
      return
    }
    setBusy('save')
    try {
      const result = await api.save(docRef.current, currentBase ?? docRef.current.name)
      setSavedFile(result.file)
      setDirty(false)
      setStatus(`已保存布局 ${result.file}（${result.bytes} B）`)
      await refreshLayouts()
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy('')
    }
  }

  /** Save under a new file name; it becomes the document name as well. */
  const saveAsDocument = async () => {
    const name = saveAsName.trim()
    if (name === '') {
      onError(new Error(t('circuit.saveAs.needName')))
      return
    }
    if (api === null || docRef.current === null) return
    setBusy('saveas')
    try {
      docRef.current.name = name
      const result = await api.save(docRef.current, name)
      setSavedFile(result.file)
      setSaveAsOpen(false)
      setDirty(false)
      setIsTemplate(false)
      repaint()
      setStatus(`已另存为 ${result.file}（${result.bytes} B）`)
      await refreshLayouts()
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy('')
    }
  }

  /** Write the generated netlist into `circuit/netlist/`. */
  const exportNetlist = async () => {
    if (api === null) return
    setBusy('netlist')
    try {
      const result = await api.exportNetlist(docRef.current, generateNetlist(docRef.current, CIRCUIT_SYMBOLS).cir)
      setStatus(`已导出 ${result.file}（${result.bytes} B）`)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy('')
    }
  }

  /** Rasterize the current view to PNG and save it next to the circuit. */
  const exportPreview = async () => {
    if (api === null) return
    setBusy('preview')
    try {
      const png = await rasterizeCircuit()
      const result = await api.savePreview(docRef.current, png)
      setStatus(`预览已保存 ${result.file}（${(result.bytes / 1024).toFixed(1)} KB）`)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy('')
    }
  }

  /**
   * Serialize the current view to a PNG (grid and dangling markers removed,
   * like the upstream preview).
   * @returns a `data:image/png` URL.
   */
  const rasterizeCircuit = () => new Promise((resolve, reject) => {
    const source = frameRef.current?.querySelector('svg')
    if (source === null || source === undefined) {
      reject(new Error('画布还没准备好'))
      return
    }
    const clone = source.cloneNode(true)
    for (const node of clone.querySelectorAll('.c2v-circuit-grid, [data-dangling]')) node.remove()
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('viewBox', `0 0 ${viewport.w} ${viewport.h}`)
    clone.setAttribute('width', String(viewport.w * 2))
    clone.setAttribute('height', String(viewport.h * 2))
    const markup = new XMLSerializer().serializeToString(clone)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = viewport.w * 2
      canvas.height = viewport.h * 2
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('预览光栅化失败'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })

  // Live netlist; recomputed on every repaint.
  const generated = doc === null ? null : generateNetlist(doc, CIRCUIT_SYMBOLS)
  // The ported engine stays byte-identical to upstream; this advisory is a
  // plugin-side extra: pins tapping a wire from the middle connect without a
  // junction dot in the designer, so surface them next to the real lints.
  const implicit = doc === null ? [] : auditImplicitConnections(doc, CIRCUIT_SYMBOLS)
  const lints = generated === null
    ? []
    : [...generated.lints, ...implicit.map((entry) => ({ level: entry.level, code: 'implicit-connection', msg: entry.msg }))]
  const errors = lints.filter((lint) => lint.level === 'error').length
  const warnings = lints.length - errors

  /** Test points become extra probes; the IN symbol supplies the stimulus. */
  const simProbes = (() => {
    if (doc === null || generated === null) return []
    const nets = []
    for (const part of doc.parts) {
      if (part.symbol !== 'test-point') continue
      const pin = (symbols[part.symbol]?.pins ?? [])[0]
      if (pin === undefined) continue
      const net = generated.nets.find((entry) => entry.pins.includes(`${part.ref}.${pin.id}`))
      if (net !== undefined && !nets.includes(net.name)) nets.push(net.name)
    }
    return nets
  })()
  const simSignals = (() => {
    const input = doc?.parts.find((part) => part.symbol === 'node-in')
    return input === undefined ? null : { amp: input.amp ?? 0.2, freq: input.freq ?? 1000 }
  })()

  const selectedPart = doc === null ? null : doc.parts.find((part) => part.id === selection.partId) ?? null
  /** Closed model set for the selected symbol (diodes / transistors / op-amps …). */
  const modelChoices = selectedPart === null ? [] : (symbols[selectedPart.symbol]?.models ?? [])
  const selectedWire = doc === null ? null : doc.wires.find((wire) => wire.id === selection.wireId) ?? null

  /** Update one part through an undo step. */
  const updatePart = (partId, mutate) => {
    const part = docRef.current.parts.find((candidate) => candidate.id === partId)
    if (part === undefined) return
    commit()
    mutate(part)
    repaint()
  }

  /**
   * Cursor position in millimetres for a pointer event.
   * @param event - pointer event.
   * @returns mm point.
   */
  const pointOf = (event) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (rect === undefined) return null
    return circuitScreenToMm({ x: event.clientX - rect.left, y: event.clientY - rect.top }, view)
  }

  /** `m` is two-phase: the next click on a part picks it up. */
  const afterArmPick = (partId) => {
    if (!moveArmedRef.current) return false
    moveArmedRef.current = false
    if (partId === null) return false
    const picked = circuitPickUp(partId, docRef.current)
    if (picked === null) return false
    commit()
    setMode(picked)
    setStatus('移动：点击画布放下，esc 放回原位')
    return true
  }

  const onPointerDown = (event) => {
    if (doc === null) return
    const point = pointOf(event)
    if (point === null) return
    cursorMmRef.current = { x: circuitSnap(point.x), y: circuitSnap(point.y) }
    const hit = circuitHitTest(doc, symbols, point, HIT_TOLERANCE_MM)
    const current = modeRef.current

    // Middle button pans in every mode.
    if (event.button === 1) {
      dragRef.current = { start: { x: event.clientX, y: event.clientY }, startPan: { ...view.pan }, moved: false, pan: true }
      event.currentTarget.setPointerCapture?.(event.pointerId)
      return
    }
    if (event.button !== 0) return

    // Double click on a part opens its properties (single click already selects);
    // on OUT / a test point it opens the scope for that net instead. Only in
    // view mode: copy/move/place must consume the click themselves.
    const now = performance.now()
    const canDoubleClick = current.kind === 'view' && !moveArmedRef.current && dragRef.current === null
    if (canDoubleClick && hit.partId !== null && lastClickRef.current.id === hit.partId && now - lastClickRef.current.at < 400) {
      lastClickRef.current = { id: null, at: 0 }
      const part = doc.parts.find((candidate) => candidate.id === hit.partId)
      const instrument = part !== undefined && (part.symbol === 'node-out' || part.symbol === 'test-point')
      if (instrument) {
        const pin = (symbols[part.symbol]?.pins ?? [])[0]
        const net = pin === undefined
          ? undefined
          : generated?.nets.find((entry) => entry.pins.includes(`${part.ref}.${pin.id}`))?.name
        if (net === undefined) {
          setStatus(`${part.ref} 还没接到电路上（找不到它的网络）`)
          return
        }
        setScopeFocus({ net, label: part.ref })
        setSimOpen(true)
        return
      }
      setSelection(hit)
      return
    }
    lastClickRef.current = { id: hit.partId, at: now }

    if (afterArmPick(hit.partId)) return

    switch (current.kind) {
      case 'place':
        // Place at the click, not at the position captured when `r` was pressed.
        circuitCommitPlace({ ...current, at: { x: circuitSnap(point.x), y: circuitSnap(point.y) } }, hooksRef.current)
        return
      case 'wire': {
        const snapped = { x: circuitSnap(point.x), y: circuitSnap(point.y) }
        if (current.from === null) {
          setMode({ ...current, from: snapped })
          return
        }
        const next = circuitCommitWire(current.from, snapped, hooksRef.current)
        const trimmed = circuitTrimWiresUnderParts(docRef.current, symbols)
        const before = docRef.current.wires.length
        docRef.current.wires = circuitNormalizeWires(docRef.current.wires)
        if (trimmed || docRef.current.wires.length !== before) repaint()
        setMode({ ...current, from: next })
        return
      }
      case 'delete':
        circuitDeleteAt(hooksRef.current, hit.partId, hit.wireId)
        docRef.current.wires = circuitNormalizeWires(docRef.current.wires)
        repaint()
        return
      case 'copy': {
        if (hit.partId === null) return
        const source = doc.parts.find((part) => part.id === hit.partId)
        if (source === undefined) return
        circuitEnterPlace(source.symbol, hooksRef.current, { x: circuitSnap(point.x), y: circuitSnap(point.y) }, circuitCopyAttrs(source))
        setMode({ ...modeRef.current, rot: source.rot, mirror: source.mirror })
        const carried = [source.value, source.model].filter(Boolean).join(' / ')
        setStatus(`复制 ${source.ref}${carried === '' ? '' : `（${carried}）`}：点击落点（ctrl+r 旋转，esc 退出）`)
        return
      }
      case 'move':
        // A held part follows the cursor, so any click drops it (upstream does
        // not require the drop point to hit something).
        circuitDropAt(current, point, hooksRef.current)
        setMode({ kind: 'view' })
        return
      default:
        dragRef.current = {
          start: { x: event.clientX, y: event.clientY },
          startPan: { ...view.pan },
          moved: false,
          pan: true,
          point,
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }
  }

  const onPointerMove = (event) => {
    const point = pointOf(event)
    if (point === null) return
    setCursor(point)
    cursorMmRef.current = { x: circuitSnap(point.x), y: circuitSnap(point.y) }
    const drag = dragRef.current
    if (drag !== null && drag.pan === true) {
      const dx = event.clientX - drag.start.x
      const dy = event.clientY - drag.start.y
      if (!drag.moved && Math.hypot(dx, dy) > 2) drag.moved = true
      if (drag.moved) setView((previous) => ({ ...previous, pan: { x: drag.startPan.x + dx, y: drag.startPan.y + dy } }))
      return
    }
    if (modeRef.current.kind === 'place') {
      modeRef.current = { ...modeRef.current, at: { x: circuitSnap(point.x), y: circuitSnap(point.y) } }
      return
    }
    if (modeRef.current.kind === 'move') {
      const part = docRef.current.parts.find((candidate) => candidate.id === modeRef.current.partId)
      if (part !== undefined) {
        part.at = { x: circuitSnap(point.x), y: circuitSnap(point.y) }
        repaint()
      }
      return
    }
    if (doc !== null) setHover(circuitHitTest(doc, symbols, point, HIT_TOLERANCE_MM))
  }

  const onPointerUp = (event) => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag === null || doc === null) return
    if (drag.moved || drag.point === undefined) return
    // A click in view mode selects what is under the cursor.
    const hit = circuitHitTest(doc, symbols, drag.point)
    setSelection(hit)
  }

  const onWheel = (event) => {
    event.preventDefault()
    const rect = frameRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    const cursorPx = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const before = circuitScreenToMm(cursorPx, view)
    const nextScale = Math.min(60, Math.max(2, view.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15)))
    setView({ scale: nextScale, pan: { x: cursorPx.x - before.x * nextScale, y: cursorPx.y - before.y * nextScale } })
  }

  if (doc === null) {
    return React.createElement('div', { style: { padding: '24px', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' } }, t('circuit.loading'))
  }

  const style = {
    card: {
      border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '12px',
      background: 'var(--dsw-alias-bg-layer-1)', padding: '12px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    },
    title: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--dsw-alias-label-secondary)' },
    label: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' },
    input: {
      font: 'inherit', fontSize: '12px', padding: '4px 6px', borderRadius: '6px',
      border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
      color: 'var(--dsw-alias-label-primary)', width: '100%', boxSizing: 'border-box',
    },
    button: {
      font: 'inherit', fontSize: '12px', padding: '4px 9px', borderRadius: '7px',
      border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
      color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
    },
  }
  const node = (tag, props, ...children) => React.createElement(tag, props, ...children)
  const S_ = {
    badge: {
      fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
      border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)',
    },
  }

  // ---- grid for the current view
  const gridLines = []
  {
    const topLeft = circuitScreenToMm({ x: 0, y: 0 }, view)
    const bottomRight = circuitScreenToMm({ x: viewport.w, y: viewport.h }, view)
    const firstX = Math.floor(topLeft.x / CIRCUIT_GRID) * CIRCUIT_GRID
    const firstY = Math.floor(topLeft.y / CIRCUIT_GRID) * CIRCUIT_GRID
    for (let x = firstX; x <= bottomRight.x; x += CIRCUIT_GRID) {
      const major = Math.abs(x / CIRCUIT_GRID) % 4 === 0
      const a = circuitMmToScreen({ x, y: topLeft.y }, view)
      const b = circuitMmToScreen({ x, y: bottomRight.y }, view)
      gridLines.push({ key: `vx${x}`, major, x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    for (let y = firstY; y <= bottomRight.y; y += CIRCUIT_GRID) {
      const major = Math.abs(y / CIRCUIT_GRID) % 4 === 0
      const a = circuitMmToScreen({ x: topLeft.x, y }, view)
      const b = circuitMmToScreen({ x: bottomRight.x, y }, view)
      gridLines.push({ key: `hy${y}`, major, x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
  }

  const junctions = circuitWireJunctions(doc.wires)
  const activeWire = hover.wireId ?? selection.wireId
  const activePartId = hover.partId ?? selection.partId
  const currentMode = mode
  const ghostAt = cursor === null ? null : { x: circuitSnap(cursor.x), y: circuitSnap(cursor.y) }

  /** One symbol, drawn at a screen position with the current view transform. */
  const symbolNode = (part, screen, ghost) => {
    const symbol = symbols[part.symbol]
    const art = CIRCUIT_ART[part.symbol]
    if (symbol === undefined) return null
    const mirror = part.mirror === 'x' ? ' scale(-1,1)' : part.mirror === 'y' ? ' scale(1,-1)' : ''
    return node('g', {
      key: `${part.id}-art`,
      transform: `translate(${screen.x} ${screen.y}) scale(${view.scale}) rotate(${part.rot})${mirror}`,
      opacity: ghost ? 0.55 : 1,
    },
      art === undefined ? null : node('svg', {
        x: -symbol.origin.x, y: -symbol.origin.y,
        width: symbol.canvas.w, height: symbol.canvas.h,
        viewBox: art.viewBox, overflow: 'visible',
        dangerouslySetInnerHTML: { __html: art.inner },
      }),
      ghost ? null : node('g', null, (symbol.pins ?? []).map((pin) => node('circle', {
        key: pin.id, cx: pin.at.x, cy: pin.at.y, r: 0.7,
        fill: selection.partId === part.id ? 'var(--dsw-alias-brand-primary)' : 'transparent',
        opacity: selection.partId === part.id ? 0.35 : 0,
      }))),
    )
  }

  /** Labels live in their own group so they never rotate. */
  const labelNodes = (part, symbol) => {
    const anchor = circuitLabelAnchor(part, symbol)
    const vertical = symbol.canvas.h > symbol.canvas.w
    const art = CIRCUIT_ART[part.symbol]
    return node('g', { key: `${part.id}-labels` },
      node('text', {
        x: anchor.x, y: anchor.y, textAnchor: vertical ? 'start' : 'middle',
        fontSize: 3.2, fill: '#334155', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
      }, part.alias ? `${part.ref} (${part.alias})` : part.ref),
      (part.value || part.model)
        ? node('text', {
          x: anchor.x, y: anchor.y + 3.4, textAnchor: vertical ? 'start' : 'middle',
          fontSize: 2.8, fill: '#64748b', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        }, String(part.value ?? part.model ?? ''))
        : null,
      (art?.texts ?? []).map((text, index) => {
        const world = toWorld({ x: text.x - symbol.origin.x, y: text.y - symbol.origin.y }, part)
        return node('text', {
          key: `t${index}`, x: world.x, y: world.y,
          fontSize: text.size, fill: text.fill, textAnchor: text.anchor,
          fontFamily: text.family, stroke: 'none',
        }, text.content)
      }),
    )
  }

  const palette = paletteOpen
    ? node('div', {
      style: {
        position: 'absolute', inset: '10px', overflow: 'auto', background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '10px', padding: '10px',
        boxShadow: '0 8px 24px rgba(15,23,42,.18)', zIndex: 5,
      },
      onPointerDown: (event) => { event.stopPropagation() },
      onWheel: (event) => { event.stopPropagation() },
    },
      node('div', { style: { ...style.title, marginBottom: '8px' } }, t('circuit.palette')),
      node('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: '8px' } },
        Object.keys(symbols).map((key) => {
          const symbol = symbols[key]
          const art = CIRCUIT_ART[key]
          return node('button', {
            key,
            'data-symbol': key,
            style: {
              ...style.button,
              // Symbol art is ink on transparent; give the card paper so it stays
              // readable in dark mode, and pin the text colour to that paper.
              background: '#f7f5f0', borderColor: '#e2ddd2', color: '#231815',
              display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', padding: '8px 6px',
            },
            onClick: () => {
              setPaletteOpen(false)
              circuitEnterPlace(key, hooksRef.current, cursorMmRef.current)
            },
          },
            art === undefined ? null : node('svg', {
              width: 52, height: 34, viewBox: art.viewBox,
              dangerouslySetInnerHTML: { __html: art.inner },
            }),
            node('span', { style: { fontSize: '11px', color: '#231815' } }, symbol.name?.zh ?? key),
            node('span', { style: { fontSize: '10px', color: '#6b6259' } }, (symbol.pins ?? []).map((pin) => pin.id).join(' ')),
          )
        })))
    : null

  const help = helpOpen
    ? node('div', {
      style: {
        position: 'absolute', right: '10px', top: '10px', width: '300px', zIndex: 6,
        background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '10px', padding: '12px', boxShadow: '0 8px 24px rgba(15,23,42,.18)',
        display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px',
      },
      onPointerDown: (event) => { event.stopPropagation() },
      onWheel: (event) => { event.stopPropagation() },
    },
      node('div', { style: style.title }, t('circuit.help')),
      [
        ['esc', t('circuit.key.esc')], ['r / c / g', t('circuit.key.place')], ['w', t('circuit.key.wire')],
        ['q', t('circuit.key.delete')], ['m', t('circuit.key.move')], ['d', t('circuit.key.copy')],
        ['空格', t('circuit.key.palette')], ['ctrl+r / ctrl+e', t('circuit.key.rotmirror')],
        ['ctrl+z / ctrl+y', t('circuit.key.undo')], ['h', t('circuit.key.help')],
      ].map(([keys, text]) => node('div', { key: keys, style: { display: 'flex', gap: '8px' } },
        node('code', { style: { width: '92px', color: 'var(--dsw-alias-brand-primary)' } }, keys),
        node('span', { style: { flex: 1, color: 'var(--dsw-alias-label-secondary)' } }, text)),
      ))
    : null

  const propsCard = (selection.partId === null && selection.wireId === null) || !propsOpen
    ? null
    : node('div', {
      style: {
        position: 'absolute', top: '10px', right: '10px', width: '300px', zIndex: 4,
        background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '10px', padding: '12px', boxShadow: '0 8px 24px rgba(15,23,42,.18)',
        display: 'flex', flexDirection: 'column', gap: '8px',
      },
      // Keep canvas gestures out of the panel: clicks and wheel stay inside.
      onPointerDown: (event) => { event.stopPropagation() },
      onWheel: (event) => { event.stopPropagation() },
    },
      node('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        node('div', { style: { ...style.title, flex: 1 } }, t('circuit.props')),
        node('button', {
          style: { ...style.button, padding: '0 6px', lineHeight: '18px' },
          onClick: () => setPropsOpen(false),
        }, '×')),
        selectedPart === null
          ? node('div', { style: style.label }, selection.wireId === null ? t('circuit.props.hint') : `${t('circuit.wire')} ${selection.wireId} · (${selectedWire?.points[0].x}, ${selectedWire?.points[0].y}) → (${selectedWire?.points[1].x}, ${selectedWire?.points[1].y})`)
          : node('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            node('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' } },
              node('span', { style: { fontWeight: 600 } }, `${symbols[selectedPart.symbol]?.name?.zh ?? selectedPart.symbol} ${selectedPart.ref}`),
              node('span', { style: style.label }, symbols[selectedPart.symbol]?.standard ?? '')),
            node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
              node('span', { style: style.label }, t('circuit.field.ref')),
              node('input', {
                style: style.input, value: selectedPart.ref,
                onChange: (event) => updatePart(selectedPart.id, (part) => { part.ref = event.target.value.trim() || part.ref }),
              })),
            node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
              node('span', { style: style.label }, t('circuit.field.alias')),
              node('input', {
                style: style.input, value: selectedPart.alias ?? '',
                onChange: (event) => updatePart(selectedPart.id, (part) => {
                  if (event.target.value.trim() === '') delete part.alias
                  else part.alias = event.target.value
                }),
              })),
            modelChoices.length === 0 ? null : node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
              node('span', { style: style.label }, t('circuit.field.model')),
              node('select', {
                style: style.input,
                value: selectedPart.model ?? '',
                onChange: (event) => updatePart(selectedPart.id, (part) => {
                  if (event.target.value === '') delete part.model
                  else part.model = event.target.value
                }),
              },
                selectedPart.model === undefined ? node('option', { value: '' }, t('circuit.field.model.none')) : null,
                modelChoices.map((model) => node('option', { key: model, value: model }, model)),
                // A model outside the closed set (hand-edited file) stays visible so
                // the user can see what the linter is complaining about.
                selectedPart.model !== undefined && !modelChoices.includes(selectedPart.model)
                  ? node('option', { key: selectedPart.model, value: selectedPart.model }, `${selectedPart.model}（不在闭集）`)
                  : null)),
            CIRCUIT_VALUE_UNITS[selectedPart.symbol] === undefined ? null : node('div', { style: { display: 'flex', gap: '6px' } },
              node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 } },
                node('span', { style: style.label }, t('circuit.field.value')),
                node('input', {
                  style: style.input,
                  value: circuitSplitValue(selectedPart.value, CIRCUIT_VALUE_UNITS[selectedPart.symbol]).num,
                  onChange: (event) => updatePart(selectedPart.id, (part) => {
                    const current = circuitSplitValue(part.value, CIRCUIT_VALUE_UNITS[part.symbol])
                    part.value = circuitJoinValue(event.target.value, current.unit)
                  }),
                })),
              node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px', width: '84px' } },
                node('span', { style: style.label }, t('circuit.field.unit')),
                node('select', {
                  style: style.input,
                  value: circuitSplitValue(selectedPart.value, CIRCUIT_VALUE_UNITS[selectedPart.symbol]).unit,
                  onChange: (event) => updatePart(selectedPart.id, (part) => {
                    const current = circuitSplitValue(part.value, CIRCUIT_VALUE_UNITS[part.symbol])
                    part.value = circuitJoinValue(current.num, event.target.value)
                  }),
                }, CIRCUIT_VALUE_UNITS[selectedPart.symbol].map((unit) => node('option', { key: unit, value: unit }, circuitUnitLabel(selectedPart.symbol, unit))))),
            ),
            selectedPart.symbol === 'transformer' ? node('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
              node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                node('span', { style: style.label }, t('circuit.field.ratio')),
                node('input', {
                  style: style.input, type: 'number', step: '0.1', min: '0.1',
                  value: String(selectedPart.ratio ?? 2),
                  onChange: (event) => updatePart(selectedPart.id, (part) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next) && next > 0) part.ratio = next
                  }),
                })),
              node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                node('span', { style: style.label }, t('circuit.field.k')),
                node('input', {
                  style: style.input, type: 'number', step: '0.001', min: '0.001', max: '0.999',
                  value: String(selectedPart.k ?? 0.999),
                  onChange: (event) => updatePart(selectedPart.id, (part) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next) && next > 0 && next < 1) part.k = next
                  }),
                })),
              node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                node('span', { style: style.label }, t('circuit.field.tapP')),
                node('input', {
                  style: style.input, type: 'number', step: '1', min: '5', max: '95',
                  value: String(Math.round((selectedPart.tap_p ?? 0.5) * 100)),
                  onChange: (event) => updatePart(selectedPart.id, (part) => {
                    const next = Number(event.target.value) / 100
                    if (Number.isFinite(next) && next > 0 && next < 1) part.tap_p = next
                  }),
                })),
              node('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
                node('span', { style: style.label }, t('circuit.field.tapS')),
                node('input', {
                  style: style.input, type: 'number', step: '1', min: '5', max: '95',
                  value: String(Math.round((selectedPart.tap_s ?? 0.5) * 100)),
                  onChange: (event) => updatePart(selectedPart.id, (part) => {
                    const next = Number(event.target.value) / 100
                    if (Number.isFinite(next) && next > 0 && next < 1) part.tap_s = next
                  }),
                }))) : null,
            node('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
              node('span', { style: { ...style.label, flex: 1 } }, t('circuit.field.rot')),
              [0, 90, 180, 270].map((rotation) => node('button', {
                key: rotation,
                style: {
                  ...style.button,
                  ...(selectedPart.rot === rotation ? { background: 'var(--dsw-alias-brand-primary)', borderColor: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-bg-base)' } : {}),
                },
                onClick: () => updatePart(selectedPart.id, (part) => { part.rot = rotation }),
              }, `${rotation}°`))),
            node('div', { style: style.label }, `位置 ${selectedPart.at.x}, ${selectedPart.at.y} mm`),
          ),
    )

  // The whole tab is one flex column: header + toolbar are fixed, the canvas
  // takes every pixel that is left, the status bar is fixed. `minHeight: 0`
  // lets the canvas shrink below its content size instead of overflowing.
  return node('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: '1 1 auto', minHeight: 0 } },
      node('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        // Row 1: what is open, and whether it needs saving.
        node('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
          node('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' } },
            `${doc.name ?? '未命名电路'} · ${doc.parts.length} 元件 · ${doc.wires.length} 导线`),
          node('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, savedFile ?? '未保存'),
          isTemplate ? node('span', { style: S_.badge }, t('circuit.template')) : null,
          dirty ? node('span', { style: S_.badge }, t('circuit.dirty')) : null,
          paramReport === null
            ? null
            : node('span', {
              style: {
                ...S_.badge,
                color: paramReport.issues.length === 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-warn-primary)',
                borderColor: paramReport.issues.length === 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-warn-primary)',
              },
              title: paramReport.issues.map((issue) => issue.msg).join('\n'),
            }, paramReport.issues.length === 0
              ? t('circuit.params.ok')
              : `${t('circuit.params.issues')} ${paramReport.issues.length}`)),
        // Row 2: every action lives here.
        node('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          node('button', { style: { ...style.button, opacity: pastRef.current.length === 0 ? 0.45 : 1 }, onClick: undo }, '↶'),
          node('button', { style: { ...style.button, opacity: futureRef.current.length === 0 ? 0.45 : 1 }, onClick: redo }, '↷'),
          node('select', {
            style: { ...style.input, width: 'auto', maxWidth: '190px' },
            value: currentBase ?? '',
            disabled: api === null || layouts.length === 0,
            title: t('circuit.loadLayout.title'),
            onChange: (event) => { void switchLayout(event.target.value) },
          }, currentBase === null
            ? node('option', { value: '' }, t('circuit.loadLayout.empty'))
            : null,
            layouts.map((entry) => node('option', { key: entry.file, value: entry.name }, entry.name))),
          node('select', {
            style: { ...style.input, width: 'auto' },
            value: '',
            onChange: (event) => { void startExample(event.target.value) },
          }, node('option', { value: '' }, t('circuit.example')),
            Object.keys(CIRCUIT_EXAMPLES).map((name) => node('option', { key: name, value: name }, name))),
          node('button', { style: style.button, onClick: () => setView(circuitFitView(doc, symbols, viewport)) }, t('circuit.fit')),
          node('button', {
            style: style.button,
            onClick: () => {
              setShowNetlist((open) => !open)
              void refreshParamReport()
            },
          },
            `${t('circuit.netlist')} ${errors} error / ${warnings} warn`),
          node('button', {
            style: { ...style.button, opacity: generated === null || errors > 0 ? 0.45 : 1 },
            disabled: generated === null || errors > 0,
            onClick: () => setSimOpen(true),
          }, t('circuit.simulate')),
          node('span', { style: { width: '1px', height: '18px', background: 'var(--dsw-alias-border-l1)' } }),
          node('button', {
            style: { ...style.button, opacity: api === null || busy !== '' ? 0.45 : 1 },
            disabled: api === null || busy !== '',
            onClick: () => { void saveDocument() },
          }, busy === 'save' ? t('circuit.saving') : t('circuit.saveLayout')),
          node('button', {
            style: { ...style.button, opacity: api === null || busy !== '' ? 0.45 : 1 },
            disabled: api === null || busy !== '',
            onClick: () => {
              setSaveAsName(docRef.current.name ?? '')
              setSaveAsOpen(true)
            },
          }, t('circuit.saveAs')),
          node('button', {
            style: { ...style.button, opacity: api === null || busy !== '' ? 0.45 : 1 },
            disabled: api === null || busy !== '',
            onClick: () => { void exportNetlist() },
          }, busy === 'netlist' ? t('circuit.saving') : t('circuit.exportNetlist')),
          node('button', {
            style: { ...style.button, opacity: api === null || busy !== '' ? 0.45 : 1 },
            disabled: api === null || busy !== '',
            onClick: () => { void exportPreview() },
          }, busy === 'preview' ? t('circuit.saving') : t('circuit.preview')),
        ),
      ),
      node('div', {
        ref: frameRef,
        tabIndex: 0,
        'data-c2v-circuit': 'true',
        style: {
          position: 'relative', flex: '1 1 auto', minHeight: '360px', overflow: 'hidden',
          borderRadius: '12px', border: '1px solid var(--dsw-alias-border-l1)',
          background: '#ffffff', cursor: circuitCursorFor(currentMode),
          touchAction: 'none',
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave: () => {
          dragRef.current = null
          setHover({ partId: null, wireId: null })
          setCursor(null)
        },
        onWheel,
      },
        node('svg', { width: viewport.w, height: viewport.h, style: { display: 'block' } },
          node('g', { className: 'c2v-circuit-grid' }, gridLines.map((line) => node('line', {
            key: line.key, x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2,
            stroke: line.major ? '#cbd5e1' : '#e2e8f0', strokeWidth: 1,
          }))),
          node('g', null, doc.wires.map((wire) => {
            const a = circuitMmToScreen(wire.points[0], view)
            const b = circuitMmToScreen(wire.points[1], view)
            const active = activeWire === wire.id
            return node('line', {
              key: wire.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
              stroke: active ? 'var(--dsw-alias-brand-primary)' : '#0f172a',
              strokeWidth: active ? 2.4 : 1.6,
            })
          })),
          // wire being drawn
          currentMode.kind === 'wire' && currentMode.from !== null && ghostAt !== null
            ? (() => {
              const [a, b] = circuitOrtho(currentMode.from, ghostAt)
              const from = circuitMmToScreen(a, view)
              const to = circuitMmToScreen(b, view)
              return node('line', {
                x1: from.x, y1: from.y, x2: to.x, y2: to.y,
                stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 1.8, strokeDasharray: '4 3',
              })
            })()
            : null,
          node('g', null, junctions.map((point, index) => {
            const screen = circuitMmToScreen(point, view)
            return node('circle', { key: `j${index}`, cx: screen.x, cy: screen.y, r: Math.max(2.5, view.scale * 1.2), fill: '#0f172a' })
          })),
          node('g', null, doc.parts.map((part) => {
            const symbol = symbols[part.symbol]
            if (symbol === undefined) return null
            const screen = circuitMmToScreen(part.at, view)
            const hovered = activePartId === part.id && currentMode.kind === 'view'
            return node('g', {
              key: part.id,
              'data-part-id': part.id,
              style: hovered ? { filter: 'drop-shadow(0 0 2px var(--dsw-alias-brand-primary))' } : undefined,
            },
              symbolNode(part, screen, false),
              node('g', { transform: `translate(${view.pan.x} ${view.pan.y}) scale(${view.scale})` }, labelNodes(part, symbol)),
            )
          })),
          // ghost while placing
          currentMode.kind === 'place' && ghostAt !== null
            ? node('g', { style: { pointerEvents: 'none' } },
              symbolNode({ ...currentMode, id: 'ghost', ref: '?', symbol: currentMode.symbol, at: ghostAt, rot: currentMode.rot, mirror: currentMode.mirror }, circuitMmToScreen(ghostAt, view), true),
              node('g', { transform: `translate(${view.pan.x} ${view.pan.y}) scale(${view.scale})` },
                node('text', {
                  x: circuitLabelAnchor({ at: ghostAt, rot: currentMode.rot, mirror: currentMode.mirror }, symbols[currentMode.symbol]).x,
                  y: circuitLabelAnchor({ at: ghostAt, rot: currentMode.rot, mirror: currentMode.mirror }, symbols[currentMode.symbol]).y,
                  textAnchor: 'middle', fontSize: 3.2, fill: '#94a3b8', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
                }, currentMode.attrs?.value ?? currentMode.attrs?.model ?? '')))
            : null,
          node('g', null, (generated?.dangling ?? []).map((entry, index) => {
            const screen = circuitMmToScreen(entry.at, view)
            return node('circle', {
              key: `d${index}`, 'data-dangling': 'true', cx: screen.x, cy: screen.y,
              r: Math.max(4, view.scale * 1.4), fill: 'rgba(220, 38, 38, .18)',
              stroke: '#dc2626', strokeWidth: 1.2, strokeDasharray: '3 2',
            }, node('title', null, `${entry.ref}.${entry.pin} 悬空`))
          })),
        ),
        palette,
        help,
        propsCard,
        saveAsOpen
          ? node('div', {
            style: {
              position: 'absolute', top: '12px', left: '12px', zIndex: 6, width: '260px',
              background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)',
              borderRadius: '10px', padding: '10px', boxShadow: '0 8px 24px rgba(15,23,42,.18)',
              display: 'flex', flexDirection: 'column', gap: '8px',
            },
            onPointerDown: (event) => { event.stopPropagation() },
            onWheel: (event) => { event.stopPropagation() },
          },
            node('div', { style: style.title }, t('circuit.saveAs.title')),
            node('input', {
              style: style.input,
              value: saveAsName,
              autoFocus: true,
              placeholder: t('circuit.saveAs.placeholder'),
              onChange: (event) => setSaveAsName(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') { event.preventDefault(); void saveAsDocument() }
                if (event.key === 'Escape') { event.preventDefault(); setSaveAsOpen(false) }
              },
            }),
            node('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } },
              node('button', { style: style.button, onClick: () => setSaveAsOpen(false) }, t('circuit.cancel')),
              node('button', {
                style: { ...style.button, borderColor: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-brand-primary)' },
                onClick: () => { void saveAsDocument() },
              }, busy === 'saveas' ? t('circuit.saving') : t('circuit.saveAs.confirm'))))
          : null,
        node(CircuitSimDialog, {
          open: simOpen,
          onClose: () => { setSimOpen(false); setScopeFocus(null) },
          api,
          cir: generated?.cir ?? '',
          ports: generated?.ports ?? null,
          probes: simProbes,
          signals: simSignals,
          focus: scopeFocus,
          onSignals: (next) => {
            const input = docRef.current?.parts.find((part) => part.symbol === 'node-in')
            if (input === undefined) return
            updatePart(input.id, (part) => { part.amp = next.amp; part.freq = next.freq })
          },
          t,
          onError,
        }),
      ),
      node('div', { style: { display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', flexWrap: 'wrap', alignItems: 'baseline' } },
        node('span', { style: { color: 'var(--dsw-alias-brand-primary)', fontWeight: 600 } }, circuitModeLabel(currentMode, symbols)),
        node('span', null, status === '' ? t('circuit.hint') : status),
        node('span', { style: { flex: 1 } }),
        cursor === null ? null : node('span', null, `${cursor.x.toFixed(1)}, ${cursor.y.toFixed(1)} mm`),
        node('span', null, `${view.scale.toFixed(1)} px/mm`),
      ),
      showNetlist
        ? node('div', { style: style.card },
          node('div', { style: style.title }, `${t('circuit.netlist')} · ${errors} error / ${warnings} warn`),
          paramReport === null
            ? null
            : node('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
              node('div', { style: style.label }, t('circuit.params')),
              paramReport.issues.length === 0
                ? node('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-state-success-primary)' } }, t('circuit.params.ok'))
                : paramReport.issues.map((issue, index) => node('div', {
                  key: `p${index}`,
                  style: {
                    fontSize: '11px',
                    color: issue.level === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-warn-primary)',
                  },
                }, `${issue.level === 'error' ? '✗' : '!'} ${issue.msg}`))),
          lints.length === 0
            ? node('div', { style: { ...style.label, color: 'var(--dsw-alias-state-success-primary)' } }, t('circuit.lint.ok'))
            : lints.map((lint, index) => node('div', {
              key: index,
              style: {
                fontSize: '11px',
                color: lint.level === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-warn-primary)',
              },
            }, `${lint.level === 'error' ? '✗' : '!'} ${lint.msg}`)),
          node('pre', {
            style: {
              margin: 0, maxHeight: '260px', overflow: 'auto', fontSize: '10px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'pre-wrap',
            },
          }, generated?.cir ?? ''))
        : null,
  )
}
