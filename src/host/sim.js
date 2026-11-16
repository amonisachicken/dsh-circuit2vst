/**
 * SPICE simulation for the circuit designer (M5).
 *
 * The netlist itself is produced by the ported JS engine in the browser; the Host
 * only does what a browser cannot: write a temporary batch netlist, spawn
 * `ngspice`, and read the ASCII rawfile back. Everything here is a direct port of
 * the upstream `backend/src/sim.rs` (commit f4eaa45), including the two quirks
 * that matter:
 *
 * - `VCC` / `VEE` are net labels in the drawing, so simulation must attach real
 *   supplies to them (otherwise an amplifier stage looks like it has unity gain);
 * - the `IN` symbol doubles as the waveform generator: transient gets
 *   `SIN(0 amp freq 0 0 0)`, AC gets `AC 1`.
 */
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import { tail } from './exec.js'

const MODELS_PATH = new URL('../../vendor/circuit/models.lib', import.meta.url)

/** Default transient window; 3 ms only shows the start-up transient. */
const DEFAULT_STEP = 1e-5
const DEFAULT_DURATION = 0.01
const DEFAULT_AMP = 0.2
const DEFAULT_FREQ = 1000

/**
 * Device models, inlined into the batch netlist (simulation only).
 * @returns the model library text.
 */
function modelsLib() {
  return readFileSync(MODELS_PATH, 'utf8')
}

/**
 * The `.tran` / `.ac` / `.dc` / `.op` line for an analysis.
 * @param kind - `op` | `dc` | `ac` | `tran`.
 * @param params - analysis parameters.
 * @returns the directive.
 */
export function analysisLine(kind, params) {
  const p = params ?? {}
  if (kind === 'op') return '.op'
  if (kind === 'dc') {
    return `.dc ${p.dcSource ?? 'VSIM'} ${p.dcStart ?? 0} ${p.dcStop ?? 9} ${p.dcStep ?? 0.1}`
  }
  if (kind === 'ac') {
    const sweep = ['dec', 'oct', 'lin'].includes(p.sweep) ? p.sweep : 'dec'
    return `.ac ${sweep} ${p.points ?? 100} ${p.fStart ?? 10} ${p.fStop ?? 100000}`
  }
  const step = p.step ?? DEFAULT_STEP
  const start = p.start ?? 0
  const duration = p.duration ?? DEFAULT_DURATION
  return `.tran ${step} ${start + duration} ${start}`
}

/**
 * Probe list: `v(in)`, `v(out)` plus any extra net (test points), lower-cased.
 * @param ports - `{in, out}` net names (maybe null).
 * @param extra - extra net names.
 * @returns probe names like `v(out)`.
 */
export function probesOf(ports, extra) {
  const list = []
  for (const net of [ports?.in, ports?.out]) {
    if (net !== null && net !== undefined && net !== '') list.push(`v(${String(net).toLowerCase()})`)
  }
  for (const net of extra ?? []) {
    const name = `v(${String(net).toLowerCase()})`
    if (!list.includes(name)) list.push(name)
  }
  return list
}

/**
 * Whether the drawing already drives the input net with a voltage source.
 * @param body - netlist lines without `.end`.
 * @param input - input net name.
 * @returns true when a `V…` element is connected to the input net.
 */
function inputDriven(body, input) {
  if (input === null || input === undefined) return false
  return body.some((line) => {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2) return false
    return /^v/i.test(parts[0]) && parts[1] === input
  })
}

/**
 * Turn the delivered netlist into a simulatable batch: supplies, stimulus,
 * device models, probes and the analysis line.
 * @param request - `{cir, ports, kind, params, probes}`.
 * @returns the batch netlist text.
 */
export function buildBatch({ cir, ports, kind, params, probes }) {
  const p = params ?? {}
  const body = String(cir ?? '')
    .split('\n')
    .filter((line) => line.trim().toLowerCase() !== '.end')
  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop()

  const out = ['* ==== 以下为仿真附加（不写进交付的 .cir）====']

  // Supplies: VCC / VEE are labels in the drawing, not elements.
  for (const [net, volt] of [['VCC', 9], ['VEE', -9]]) {
    const used = body.some((line) => {
      const parts = line.trim().split(/\s+/)
      return parts.length > 2 && parts.slice(1).includes(net)
    })
    const driven = body.some((line) => {
      const parts = line.trim().split(/\s+/)
      return parts.length > 2 && /^v/i.test(parts[0]) && parts[1] === net
    })
    if (used && !driven) out.push(`VSUP_${net} ${net} 0 DC ${volt}`)
  }

  // Stimulus: the IN symbol is the generator when no source drives that net.
  if (!inputDriven(body, ports?.in)) {
    if (ports?.in !== null && ports?.in !== undefined) {
      const amp = p.amp ?? DEFAULT_AMP
      const freq = p.freq ?? DEFAULT_FREQ
      out.push(kind === 'ac'
        ? `VSIM ${ports.in} 0 DC 0 AC 1`
        : `VSIM ${ports.in} 0 DC 0 SIN(0 ${amp} ${freq} 0 0 0)`)
    }
  }

  out.push(body.join('\n'))
  const models = modelsLib().trim()
  if (models !== '') {
    out.push('* ---- 器件模型（仅仿真）----')
    out.push(models)
  }

  const probeList = probesOf(ports, probes)
  if (probeList.length > 0 && kind !== 'op') {
    out.push(`.save ${probeList.join(' ')}`)
    out.push(`.print ${kind} ${probeList.join(' ')}`)
  }
  out.push(analysisLine(kind, p))
  out.push('.end')
  return `${out.join('\n')}\n`
}

/**
 * Parse ngspice's ASCII rawfile into variable names and points.
 * @param text - rawfile contents.
 * @returns `{variables, points}` where each point is `[var0, var1, …]`.
 */
export function parseRawfile(text) {
  let flags = ''
  let count = 0
  const variables = []
  const values = []
  let section = 'header'
  for (const line of text.split('\n')) {
    if (section === 'header') {
      if (line.startsWith('Flags: ')) flags = line.slice(7).trim()
      else if (line.startsWith('No. Variables: ')) {
        count = Number(line.slice(15).trim())
        if (!Number.isFinite(count)) throw new Error('No. Variables 解析失败')
      } else if (line.trim() === 'Variables:') section = 'variables'
      continue
    }
    if (section === 'variables') {
      if (line.trim() === 'Values:') { section = 'values'; continue }
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2) variables.push(parts[1])
      continue
    }
    if (line.trim() === '') continue
    const token = line.trim().split(/\s+/).pop()
    if (token === undefined) continue
    let value
    if (flags === 'complex') {
      const [re, im] = token.split(',')
      if (re === undefined || im === undefined) throw new Error(`非法复数 ${token}`)
      const real = Number(re.trim())
      const imaginary = Number(im.trim())
      if (!Number.isFinite(real) || !Number.isFinite(imaginary)) throw new Error(`非法复数 ${token}`)
      value = values.length % count === 0 ? real : Math.hypot(real, imaginary)
    } else {
      value = Number(token)
      if (!Number.isFinite(value)) throw new Error(`非法数值 ${token}`)
    }
    values.push(value)
    if (count === 0) throw new Error('rawfile 缺少 No. Variables')
  }
  if (count === 0) throw new Error('rawfile 缺少 No. Variables')
  if (values.length < count) throw new Error(`rawfile 数值不足一个点：读取 ${values.length} 个值`)
  const points = []
  for (let index = 0; index + count <= values.length; index += count) points.push(values.slice(index, index + count))
  return { variables, points }
}

/**
 * Total harmonic distortion of the last 8 periods (upstream formula).
 * @param time - time axis.
 * @param volts - samples.
 * @param f0 - fundamental frequency.
 * @returns THD as a fraction, or null.
 */
export function thd(time, volts, f0) {
  if (time.length < 32 || time.length !== volts.length || !(f0 > 0)) return null
  const period = 1 / f0
  const end = time[time.length - 1]
  const start = Math.max(end - 8 * period, time[0])
  const indices = []
  for (let index = 0; index < time.length; index += 1) {
    if (time[index] >= start && time[index] <= end) indices.push(index)
  }
  if (indices.length < 32) return null
  const n = indices.length
  const amplitude = (k) => {
    let re = 0
    let im = 0
    indices.forEach((index, j) => {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (n - 1))
      const phase = 2 * Math.PI * k * f0 * time[index]
      re += w * volts[index] * Math.cos(phase)
      im += w * volts[index] * Math.sin(phase)
    })
    return (Math.hypot(re, im) * 2) / n
  }
  const fundamental = amplitude(1)
  if (fundamental <= 1e-9) return null
  let acc = 0
  for (let k = 2; k <= 9; k += 1) {
    const a = amplitude(k)
    acc += a * a
  }
  return Math.sqrt(acc) / fundamental
}

/**
 * Run one simulation.
 *
 * @param request - `{cir, ports, kind, params, probes}`.
 * @returns `{kind, traces, thd, cir, log}`; `traces` is `[{name, x[], y[]}]`.
 */
export async function runSimulation(request) {
  const kind = String(request?.kind ?? 'tran')
  if (!['tran', 'ac', 'dc', 'op'].includes(kind)) throw new Error(`不支持的分析类型：${kind}`)
  const batch = buildBatch({ ...request, kind })
  const workdir = await mkdtemp(join(tmpdir(), 'c2v-sim-'))
  const binary = process.env.NGSPICE ?? 'ngspice'
  try {
    await writeFile(join(workdir, 'circuit.cir'), batch, 'utf8')
    // Force ASCII rawfiles; the parser below only understands that format.
    await writeFile(join(workdir, '.spiceinit'), 'set filetype=ascii\n', 'utf8')
    const result = await new Promise((resolve, reject) => {
      const child = spawn(binary, ['-b', '-r', 'result.raw', 'circuit.cir'], { cwd: workdir })
      let stderr = ''
      const timer = setTimeout(() => { child.kill('SIGKILL') }, 60_000)
      child.stderr.on('data', (chunk) => { stderr += String(chunk) })
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(new Error(`无法启动 ngspice（${binary}）：${error.message}；装它或用 NGSPICE=/path/to/ngspice`))
      })
      child.on('close', (code) => { clearTimeout(timer); resolve({ code, stderr }) })
    })
    const log = tail(result.stderr.trim(), 12)
    let raw
    try {
      raw = await readFile(join(workdir, 'result.raw'), 'utf8')
    } catch (error) {
      throw new Error(`读取 rawfile 失败：${error instanceof Error ? error.message : String(error)}\n${log}`)
    }
    let parsed
    try {
      parsed = parseRawfile(raw)
    } catch (error) {
      throw new Error(`ngspice 仿真失败：${error instanceof Error ? error.message : String(error)}\n退出码 ${result.code}\n${log}`)
    }
    const wanted = probesOf(request.ports, request.probes)
    const traces = parsed.variables
      .map((name, column) => ({
        name,
        x: parsed.points.map((row) => row[0]),
        y: parsed.points.map((row) => row[column]),
      }))
      .filter((trace) => wanted.includes(trace.name.toLowerCase()))
    const outName = request.ports?.out === undefined || request.ports?.out === null
      ? null
      : `v(${String(request.ports.out).toLowerCase()})`
    const distortion = kind === 'tran' && outName !== null
      ? (() => {
        const trace = traces.find((candidate) => candidate.name.toLowerCase() === outName)
        return trace === undefined ? null : thd(trace.x, trace.y, request.params?.freq ?? DEFAULT_FREQ)
      })()
      : null
    return { kind, traces, thd: distortion, cir: batch, log }
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
}
