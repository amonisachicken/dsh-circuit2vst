/**
 * Document → SPICE netlist, ported function-for-function from the upstream
 * designer's `backend/src/netlist.rs` (commit f4eaa45, see `vendor/circuit/PROVENANCE.md`).
 *
 * Three properties the port must keep, because the whole toolchain relies on them:
 *
 * 1. **Deterministic bytes** — same drawing, same text: parts sorted by reference
 *    (natural order), nets named in ascending key order, the union-find always
 *    rooting at the lexicographically smaller key;
 * 2. **Nodes are taken by pin name** (`spice.pinOrder`), never by the order the
 *    artwork lists its pins;
 * 3. **No switches** (upstream decision D-007): one document, one netlist.
 *
 * Rust specifics that matter for byte parity and are therefore mirrored here:
 * `f64::round` rounds half away from zero, coordinates are quantised to 0.001 mm
 * before becoming map keys, and `on_segment` uses a 1e-6 mm tolerance.
 */

/** Symbol grid, in millimetres. */
export const GRID = 2.5

/** Coordinate quantisation: 0.001 mm. Floating-point sums need a stable key. */
const Q = 1000

/**
 * Round half away from zero, exactly like Rust's `f64::round`.
 * @param value - number to round.
 * @returns the rounded integer.
 */
function roundHalfAway(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/**
 * Quantised map key for a point.
 * @param point - `{x, y}` in millimetres.
 * @returns `[x, y]` in thousandths of a millimetre.
 */
function keyOf(point) {
  return [roundHalfAway(point.x * Q), roundHalfAway(point.y * Q)]
}

/**
 * Stable string id for a quantised key, for use in `Map`s.
 * @param key - `[x, y]`.
 * @returns `"x,y"`.
 */
function keyId(key) {
  return `${key[0]},${key[1]}`
}

/**
 * Lexicographic comparison of two quantised keys (Rust tuple ordering).
 * @param left - `[x, y]`.
 * @param right - `[x, y]`.
 * @returns negative, zero, or positive.
 */
function compareKeys(left, right) {
  return left[0] - right[0] || left[1] - right[1]
}

/**
 * Local pin coordinates → world coordinates.
 * Must stay identical to the editor's own `toWorld`.
 * @param local - pin position in symbol space.
 * @param part - placed part (mirror, rot, at).
 * @returns `{x, y}` in millimetres.
 */
export function toWorld(local, part) {
  let x = local.x
  let y = local.y
  if (part.mirror === 'x') x = -x
  else if (part.mirror === 'y') y = -y
  const angle = (part.rot ?? 0) * Math.PI / 180
  const s = Math.sin(angle)
  const c = Math.cos(angle)
  return { x: c * x - s * y + part.at.x, y: s * x + c * y + part.at.y }
}

/**
 * Whether a point lies on a segment, endpoints included (1e-6 mm tolerance).
 * @param point - candidate point.
 * @param start - segment start.
 * @param end - segment end.
 * @returns true when the point is on the segment.
 */
export function onSegment(point, start, end) {
  const cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)
  if (Math.abs(cross) > 1e-6) return false
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2
  return dot >= -1e-6 && dot <= lengthSquared + 1e-6
}

/** Union-find over quantised keys; the smaller key is always the root. */
class UnionFind {
  constructor() {
    /** @type {Map<string, number[]>} */
    this.parent = new Map()
  }

  /**
   * Find the representative of a key, compressing the path.
   * @param key - quantised key.
   * @returns the root key.
   */
  find(key) {
    const id = keyId(key)
    const parent = this.parent.get(id) ?? key
    if (compareKeys(parent, key) === 0) {
      if (!this.parent.has(id)) this.parent.set(id, key)
      return key
    }
    const root = this.find(parent)
    this.parent.set(id, root)
    return root
  }

  /**
   * Merge two sets, rooting at the lexicographically smaller key.
   * @param left - quantised key.
   * @param right - quantised key.
   */
  union(left, right) {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (compareKeys(leftRoot, rightRoot) === 0) return
    const [low, high] = compareKeys(leftRoot, rightRoot) <= 0 ? [leftRoot, rightRoot] : [rightRoot, leftRoot]
    this.parent.set(keyId(high), low)
  }

  /**
   * Read-only root lookup (no compression), as used when emitting nets.
   * @param key - quantised key.
   * @returns the root key.
   */
  rootOf(key) {
    let current = key
    for (;;) {
      const parent = this.parent.get(keyId(current))
      if (parent === undefined || compareKeys(parent, current) === 0) break
      current = parent
    }
    return current
  }
}

/**
 * Reference split for natural ordering: head, number, tail.
 * `R10A` parses as head `R`, tail `10A` — the number then falls back to 0,
 * exactly like the Rust `parse::<i64>().unwrap_or(0)`.
 * @param reference - part reference, e.g. `R12`.
 * @returns `[head, number, tail]`.
 */
export function refKey(reference) {
  const match = /[0-9]/.exec(reference)
  const split = match === null ? reference.length : match.index
  const head = reference.slice(0, split)
  const tail = reference.slice(split)
  const number = /^[0-9]+$/.test(tail) ? Number(tail) : 0
  return [head, number, tail]
}

/**
 * Sort parts by reference, the way the Rust generator does.
 * @param parts - document parts.
 * @returns a new array.
 */
function sortParts(parts) {
  return [...parts].sort((left, right) => {
    const a = refKey(left.ref)
    const b = refKey(right.ref)
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
    if (a[1] !== b[1]) return a[1] - b[1]
    if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1
    return 0
  })
}

/**
 * Panel resistance text → ohms, using the same suffixes as SPICE (`M` = milli,
 * exactly like SPICE). The one place a bare `M` is treated as mega is
 * {@link halfValue}: a potentiometer has no legitimate milliohm value.
 * @param value - panel value text.
 * @returns ohms, or null when it does not parse.
 */
export function panelValueOhms(value) {
  const text = String(value).trim().toLowerCase()
  const split = text.search(/[^0-9.+\-e]/)
  const number = split < 0 ? text : text.slice(0, split)
  const unit = split < 0 ? '' : text.slice(split)
  const parsed = Number(number)
  if (!Number.isFinite(parsed)) return null
  const multiplier = unit.startsWith('meg')
    ? 1e6
    : unit.startsWith('mil')
      ? 25.4e-6
      : unit.startsWith('t') ? 1e12
        : unit.startsWith('g') ? 1e9
          : unit.startsWith('k') ? 1e3
            : unit.startsWith('m') ? 1e-3
              : unit.startsWith('u') ? 1e-6
                : unit.startsWith('n') ? 1e-9
                  : unit.startsWith('p') ? 1e-12
                    : 1
  return parsed * multiplier
}

/**
 * `1M` / `0.5m` style values: ends with `m` but is not `meg`/`mil`.
 * @param raw - panel value text.
 * @returns whether the value looks like a mega typo.
 */
export function looksLikeMegaTypo(raw) {
  return String(raw).trim().toLowerCase().endsWith('m')
}

/**
 * Nominal resistance of one half of a potentiometer (50 % tap), keeping the
 * unit suffix: `500k` → `250k`.
 * @param value - manifest value, e.g. `500k`.
 * @returns the halved value with its unit.
 */
export function halfValue(value) {
  const text = String(value).trim()
  const split = /[^0-9.+\-eE]/.exec(text)
  const number = split === null ? text : text.slice(0, split.index)
  const unit = split === null ? '' : text.slice(split.index)
  // `M` is milli in SPICE, but a potentiometer labelled `1M` is 1 MΩ and a
  // potentiometer has no milliohm value, so only this pot path normalises it.
  const normalised = unit.toLowerCase() === 'm' ? 'meg' : unit
  const parsed = Number(number)
  if (!Number.isFinite(parsed) || number.trim() === '') return String(value)
  const half = parsed / 2
  // Rust prints `{:.6}` then trims trailing zeros and a bare dot.
  let rendered = half.toFixed(6)
  rendered = rendered.replace(/0+$/, '').replace(/\.$/, '')
  return `${rendered}${normalised}`
}

/**
 * Lint record.
 * @typedef {{ level: 'error' | 'warn', code: string, msg: string }} Lint
 */

/**
 * Generate the SPICE netlist for a design document.
 *
 * @param doc - `.design.json` document (`{name, parts, wires}`).
 * @param table - parsed `symbols.json` (`{symbols: {...}}`).
 * @returns `{cir, lints, ports, nets, dangling}` — the same shape as the Rust `Generated`.
 */
export function generateNetlist(doc, table) {
  const symbols = table?.symbols ?? {}
  const parts = Array.isArray(doc?.parts) ? doc.parts : []
  const wires = Array.isArray(doc?.wires) ? doc.wires : []
  /** @type {Lint[]} */
  const lints = []
  const dsu = new UnionFind()

  // 0) Duplicate references
  const seenRef = new Map()
  for (const part of parts) seenRef.set(part.ref, (seenRef.get(part.ref) ?? 0) + 1)
  for (const [reference, count] of seenRef) {
    if (count > 1) lints.push({ level: 'error', code: 'dup-ref', msg: `参考编号 ${reference} 出现 ${count} 次` })
  }

  // 1) Wires: union both ends, then T-junctions (an endpoint landing on another
  //    segment joins the two nets).
  const segments = []
  for (const wire of wires) {
    if (!Array.isArray(wire.points) || wire.points.length < 2) {
      lints.push({ level: 'warn', code: 'bad-wire', msg: `导线 ${wire.id} 少于两个锚点，已忽略` })
      continue
    }
    segments.push([wire.points[0], wire.points[1]])
    dsu.union(keyOf(wire.points[0]), keyOf(wire.points[1]))
  }
  for (let i = 0; i < segments.length; i += 1) {
    const [a, b] = segments[i]
    for (let j = 0; j < segments.length; j += 1) {
      if (i === j) continue
      const [c, d] = segments[j]
      for (const point of [a, b]) {
        if (onSegment(point, c, d)) dsu.union(keyOf(point), keyOf(c))
      }
    }
  }

  // 2) Pins → world coordinates, then join whatever wire they sit on.
  /** @type {{part: any, pinId: string, at: {x: number, y: number}}[]} */
  const pins = []
  /** @type {Set<string>} `partId.pinId` of pins on `nc` symbols (intentionally open). */
  const ncPins = new Set()
  /** @type {Map<string, string>} quantised key → explicit net name. */
  const explicit = new Map()
  const ports = { in: null, out: null }

  for (const part of parts) {
    const symbol = symbols[part.symbol]
    if (symbol === undefined) {
      lints.push({ level: 'error', code: 'unknown-symbol', msg: `${part.ref}：未知符号 ${part.symbol}` })
      continue
    }
    const models = Array.isArray(symbol.models) ? symbol.models : []
    if (part.model !== undefined && part.model !== null) {
      if (!models.includes(part.model)) {
        lints.push({
          level: 'error',
          code: 'model-not-allowed',
          msg: `${part.ref}：型号 ${part.model} 不在该符号的闭集里（${models.join('/')}）`,
        })
      }
    } else if (models.length > 0) {
      lints.push({ level: 'error', code: 'model-missing', msg: `${part.ref}：没选型号（${models.join('/')} 之一）` })
    }

    // 电位器阻值：`1M` is 1 mΩ in SPICE, which pins the bias network while the
    // export stays silent — this is the Freedist P2 report. The netlist already
    // normalises a pot's bare `M` to `meg`; say so, and reject implausible ohms.
    if (part.symbol === 'potentiometer' && part.value !== undefined && part.value !== null) {
      const raw = String(part.value)
      const ohms = panelValueOhms(raw)
      if (ohms === null) {
        lints.push({ level: 'error', code: 'pot-value-bad', msg: `${part.ref}：电位器阻值 \`${raw}\` 读不出数值` })
      } else if (!(ohms >= 1 && ohms <= 1e9)) {
        if (looksLikeMegaTypo(raw) && ohms > 0) {
          lints.push({
            level: 'warn',
            code: 'pot-value-milli',
            msg: `${part.ref}：电位器阻值 \`${raw}\` 在 SPICE 里是 ${ohms} Ω（\`M\` = milli）；导出时已按 **meg** 处理。建议直接写 \`${raw.trim().replace(/[Mm]+$/, '')}meg\`。`,
          })
        } else {
          lints.push({
            level: 'error',
            code: 'pot-value-range',
            msg: `${part.ref}：电位器阻值 \`${raw}\` = ${ohms} Ω，超出合理范围（1 Ω … 1 GΩ）。`,
          })
        }
      }
    }

    for (const pin of symbol.pins ?? []) {
      const at = toWorld(pin.at, part)
      dsu.find(keyOf(at))
      pins.push({ part, pinId: pin.id, at })
      if (symbol.category === 'nc') ncPins.add(`${part.id}.${pin.id}`)
      for (const [start, end] of segments) {
        if (onSegment(at, start, end)) dsu.union(keyOf(at), keyOf(start))
      }
    }

    const firstPin = symbol.pins?.[0]
    if (firstPin !== undefined && symbol.netName !== undefined && symbol.netName !== null) {
      const key = keyOf(toWorld(firstPin.at, part))
      const previous = explicit.get(keyId(key))
      if (previous !== undefined && previous !== symbol.netName) {
        lints.push({
          level: 'warn',
          code: 'net-name-conflict',
          msg: `${part.ref}：网络名 ${previous} 与 ${symbol.netName} 冲突`,
        })
      }
      explicit.set(keyId(key), symbol.netName)
    }
    if (firstPin !== undefined && symbol.port !== undefined && symbol.port !== null) {
      const key = keyOf(toWorld(firstPin.at, part))
      if (symbol.port === 'in') ports.in = firstPin.id
      else if (symbol.port === 'out') ports.out = firstPin.id
      explicit.set(keyId(key), firstPin.id)
    }
  }

  // 3) Collect nets by root; BTreeMap order becomes "sorted by smallest key".
  /** @type {Map<string, {root: number[], members: any[]}>} */
  const byRoot = new Map()
  for (const pin of pins) {
    const root = dsu.find(keyOf(pin.at))
    const id = keyId(root)
    const bucket = byRoot.get(id)
    if (bucket === undefined) byRoot.set(id, { root, members: [pin] })
    else bucket.members.push(pin)
  }
  const nets = [...byRoot.values()].sort((left, right) => compareKeys(left.root, right.root))

  // Explicit names are attached to their roots.
  const named = new Map()
  for (const [id, name] of explicit) {
    const root = dsu.find(id.split(',').map(Number))
    named.set(keyId(root), name)
  }

  // Auto names: ascending root order, n1, n2, …
  const netName = new Map()
  let counter = 0
  for (const net of nets) {
    const id = keyId(net.root)
    const name = named.get(id)
    if (name !== undefined) {
      netName.set(id, name)
    } else {
      counter += 1
      netName.set(id, `n${counter}`)
    }
  }

  // 4) Open pins, ground, ports.
  /** @type {{ref: string, pin: string, at: {x: number, y: number}}[]} */
  const dangling = []
  for (const net of nets) {
    if (net.members.length !== 1) continue
    const member = net.members[0]
    if (ncPins.has(`${member.part.id}.${member.pinId}`)) continue
    const name = netName.get(keyId(net.root)) ?? ''
    dangling.push({ ref: member.part.ref, pin: member.pinId, at: member.at })
    lints.push({
      level: 'warn',
      code: 'dangling-pin',
      msg: `${member.part.ref} 的引脚 ${member.pinId} 悬空（网络 ${name} 只连了自己）`,
    })
  }
  if (![...netName.values()].includes('0')) {
    lints.push({ level: 'error', code: 'no-ground', msg: '没有接地符号（网表里没有 0 节点）' })
  }
  if (ports.in === null || ports.out === null) {
    lints.push({ level: 'warn', code: 'no-port', msg: '缺少 IN 或 OUT 端口符号 → 无法生成 Circuit' })
  }

  // 5) Emit text.
  const lines = []
  lines.push(`* ${doc?.name ? doc.name : '未命名电路'} —— 由 rustomp-circuit-designer 生成`)
  if (ports.in !== null && ports.out !== null) lines.push(`* @rustomp in=${ports.in} out=${ports.out}`)

  const sorted = sortParts(parts)

  // Potentiometer directives come first (one pair per pot), in reference order.
  for (const part of sorted) {
    if (part.symbol !== 'potentiometer') continue
    if (symbols[part.symbol] === undefined) continue
    const field = part.alias ?? String(part.ref).toLowerCase()
    const max = part.value ?? '500k'
    lines.push(`* @rustomp param R${part.ref}A ${field} pot max=${max}`)
    lines.push(`* @rustomp param R${part.ref}B ${field} pot max=${max} invert`)
  }
  lines.push('')

  // Element lines.
  for (const part of sorted) {
    const symbol = symbols[part.symbol]
    if (symbol === undefined) continue
    const netOf = (pinId) => {
      const pin = pins.find((candidate) => candidate.part.id === part.id && candidate.pinId === pinId)
      if (pin === undefined) return '?'
      return netName.get(keyId(dsu.rootOf(keyOf(pin.at)))) ?? '?'
    }
    const pinOrder = symbol.spice?.pinOrder ?? []
    const nodes = pinOrder.map((id) => netOf(id))
    // SPICE needs d g s b; rustomp's Nmos ties the bulk to the source.
    if (part.symbol === 'mosfet-n' && nodes.length === 3) nodes.push(nodes[2])

    if (part.symbol === 'potentiometer' && nodes.length === 3) {
      const max = part.value ?? '500k'
      const half = halfValue(max)
      lines.push(`R${part.ref}A ${nodes[0]} ${nodes[1]} ${half}`)
      lines.push(`R${part.ref}B ${nodes[1]} ${nodes[2]} ${half}`)
      continue
    }
    if (part.symbol === 'voltage-source') {
      const value = part.value ?? '9'
      lines.push(`${part.ref} ${nodes[0]} ${nodes[1]} DC ${value}`)
      continue
    }
    const prefix = symbol.spice?.prefix ?? ''
    if (prefix === '') continue
    const tail = part.model !== undefined && part.model !== null
      ? ` ${part.model}`
      : part.value !== undefined && part.value !== null ? ` ${part.value}` : ''
    // Sub-circuit instances must start with X in SPICE; U1 becomes XU1.
    const element = prefix === 'X' && !String(part.ref).startsWith('X') ? `X${part.ref}` : part.ref
    lines.push(`${element} ${nodes.join(' ')}${tail}`)
  }
  lines.push('.end')

  const netInfos = nets.map((net) => ({
    name: netName.get(keyId(net.root)) ?? '',
    pins: net.members.map((member) => `${member.part.ref}.${member.pinId}`),
  }))

  return { cir: `${lines.join('\n')}\n`, lints, ports, nets: netInfos, dangling }
}

/**
 * Audit connections that the engine makes **implicitly**: a pin that lies in
 * the *interior* of a wire (not on one of its endpoints).
 *
 * The upstream UI only draws junction dots for wire-endpoint-on-wire and
 * three-or-more coincident endpoints — a pin sitting mid-wire connects with no
 * visible marker at all. That asymmetry let a circuit pass every check while a
 * stray wire shorted a stage to ground (Red Face, 2026-11-16).
 *
 * This is deliberately **not** part of `generateNetlist().lints`: the port must
 * stay byte-identical to the upstream backend. It is an extra advisory the
 * canvas and the pre-build gate use.
 *
 * Levels:
 *  - `error` when the wire continues on **both** sides of the pin (a wire
 *    crossing through a pin, silently bridging two nets);
 *  - `warn` when the pin merely sits inside a stub/overshoot (usually the
 *    ground symbol's connection point, harmless but worth knowing).
 *
 * @param doc - circuit document.
 * @param table - symbol table (`{symbols}` or a plain map).
 * @returns audit entries `{ref, pin, at, wire, level, msg}`.
 */
export function auditImplicitConnections(doc, table) {
  const symbols = table?.symbols ?? table ?? {}
  const wires = Array.isArray(doc?.wires) ? doc.wires : []
  const parts = Array.isArray(doc?.parts) ? doc.parts : []

  /** All pin world positions, for nothing but diagnostics. */
  const taps = []
  for (const part of parts) {
    const symbol = symbols[part.symbol]
    if (symbol === undefined) continue
    for (const pin of symbol.pins ?? []) {
      const at = toWorld(pin.at, part)
      for (const wire of wires) {
        const [start, end] = wire.points
        if (!onSegment(at, start, end)) continue
        const onEndpoint =
          (Math.abs(at.x - start.x) < 1e-6 && Math.abs(at.y - start.y) < 1e-6) ||
          (Math.abs(at.x - end.x) < 1e-6 && Math.abs(at.y - end.y) < 1e-6)
        if (onEndpoint) continue
        taps.push({ ref: part.ref, pin: pin.id, at: { x: at.x, y: at.y }, wire: wire.id })
      }
    }
  }

  // A pin sitting mid-wire on **two** wires is bridging them: that is exactly
  // how a crossing wire silently shorts two nets. One wire is usually just a
  // stub that overshoots the pin (the ground symbol's connection point).
  const byPin = new Map()
  for (const tap of taps) {
    const id = `${tap.ref}.${tap.pin}`
    const list = byPin.get(id) ?? []
    list.push(tap)
    byPin.set(id, list)
  }
  const entries = []
  for (const [id, list] of byPin) {
    const level = list.length >= 2 ? 'error' : 'warn'
    const wiresText = list.map((tap) => tap.wire).join(' / ')
    entries.push({
      ref: list[0].ref,
      pin: list[0].pin,
      at: list[0].at,
      wire: wiresText,
      level,
      msg:
        `${id} 位于导线 ${wiresText} 的中间（隐式连接，界面上没有黑点）` +
        (level === 'error' ? '——它同时穿过多根导线，等于把它们短接了' : ''),
    })
  }
  return entries
}
