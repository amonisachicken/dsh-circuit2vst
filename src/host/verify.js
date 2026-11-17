/**
 * Pre-build circuit verification against ngspice (契约 A/B 之外的第 2 道闸门).
 *
 * The Rust engine and ngspice are two independent implementations of the same
 * circuit. A build is only allowed when the **design** — not the hand-written
 * Rust — produces a live signal in ngspice:
 *
 *  - the netlist generator reports no lints (dangling wires, unknown models …);
 *  - the stimulus reaches the input;
 *  - with a 0.1 V / 440 Hz sine the output RMS is above `SILENCE_RMS`.
 *
 * This catches the class of bug that no type-checker sees: accidental shorts
 * (e.g. a wire crossing a ground pin) and dead stages — the plugin builds fine
 * and is simply silent.
 *
 * ngspice is optional infrastructure: when it is missing the result is
 * `{ok: null, skipped: true}` and the caller decides whether that is fatal.
 */
import { existsSync, readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { auditImplicitConnections, generateNetlist } from '../client/circuit-netlist.js'
import { PLUGIN_ROOT } from './config.js'

const execFileAsync = promisify(execFile)

/** Output RMS below this (with a 0.1 V drive) counts as silence. */
export const SILENCE_RMS = 5e-3
/** Stimulus used by the parity run. */
export const STIMULUS = { amplitude: 0.1, frequency: 440 }
/** Transient window / step for the parity run. */
export const TRANSIENT = { step: '2u', stop: '30m' }

/**
 * Locate the design file a project should be verified against.
 * @param projectDir - project root.
 * @returns absolute path, or null.
 */
export async function findDesign(projectDir) {
  const circuitDir = join(projectDir, 'circuit')
  if (!existsSync(circuitDir)) return null
  const names = (await readdir(circuitDir)).filter((name) => name.endsWith('.design.json'))
  if (names.length === 0) return null
  const entries = []
  for (const name of names) {
    const path = join(circuitDir, name)
    entries.push({ path, mtime: (await stat(path)).mtimeMs })
  }
  entries.sort((a, b) => b.mtime - a.mtime)
  return entries[0].path
}

/**
 * Build the ngspice batch for one netlist.
 * @param cir - SPICE netlist text (already includes `.end`).
 * @param models - model library text.
 * @returns batch text.
 */
export function buildBatch(cir, models) {
  const body = cir.replace(/^\s*\.end\s*$/m, '')
  const wantsVcc = /\bVCC\b/.test(body)
  const prints = wantsVcc ? 'v(IN) v(OUT) v(VCC)' : 'v(IN) v(OUT)'
  return `${models}
* --- parity stimulus ---
VIN IN 0 SIN(0 ${STIMULUS.amplitude} ${STIMULUS.frequency})
${body}
.tran ${TRANSIENT.step} ${TRANSIENT.stop}
.print tran ${prints}
.end
`
}

/** A missing `vendor/` means a trimmed install, not a broken design. */
function readVendor(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `安装包缺少 ${path.slice(path.indexOf('vendor/'))}（对拍需要 vendor/）。`
        + '这是打包裁剪问题：package.json 的 files 必须包含 "vendor"；请升级或从仓库重新安装插件。',
        { cause: error },
      )
    }
    throw error
  }
}

/**
 * Parse `.print tran` ASCII rows.
 * @param text - ngspice stdout.
 * @returns array of number arrays.
 */
export function parseRows(text) {
  const rows = []
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 3) continue
    if (!/^\d+$/.test(parts[0])) continue
    const numbers = parts.slice(1).map(Number)
    if (numbers.some((value) => Number.isNaN(value))) continue
    rows.push(numbers)
  }
  return rows
}

/**
 * Run the parity check for one project.
 * @param projectDir - project root.
 * @param options - `{ngspice?: string}`.
 * @returns `{ok, skipped?, reason?, checks, metrics, design}`.
 */
export async function verifyCircuit(projectDir, options = {}) {
  const design = await findDesign(projectDir)
  if (design === null) {
    return { ok: false, checks: [{ code: 'design-missing', level: 'error', msg: 'circuit/ 下没有 .design.json' }], metrics: {} }
  }

  const symbols = JSON.parse(readVendor(join(PLUGIN_ROOT, 'vendor/circuit/symbols.json')))
  const doc = JSON.parse(readFileSync(design, 'utf8'))
  const { cir, lints } = generateNetlist(doc, symbols)
  const checks = []
  for (const lint of lints) checks.push({ code: lint.code, level: lint.level, msg: lint.msg })
  // Hidden connections: a pin tapping a wire from the middle has no junction dot
  // in the designer but **is** connected by the engine. One that bridges two
  // wires is treated as an error — it cannot ship (Red Face 2026-11-16).
  for (const entry of auditImplicitConnections(doc, symbols)) {
    checks.push({ code: 'implicit-connection', level: entry.level, msg: entry.msg })
  }
  if (lints.some((lint) => lint.level === 'error')) {
    return { ok: false, design, checks, metrics: {} }
  }

  const ngspice = options.ngspice ?? 'ngspice'
  try {
    await execFileAsync(ngspice, ['--version'])
  } catch {
    return { ok: null, skipped: true, reason: '没有 ngspice（安装后才会真正对拍）', design, checks, metrics: {} }
  }

  const models = readVendor(join(PLUGIN_ROOT, 'vendor/circuit/models.lib'))
  const batchPath = join(tmpdir(), `c2v-verify-${process.pid}.cir`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(batchPath, buildBatch(cir, models), 'utf8')
  const { stdout } = await execFileAsync(ngspice, ['-b', batchPath], { maxBuffer: 64 * 1024 * 1024 })
  const rows = parseRows(stdout)
  if (rows.length < 100) {
    return {
      ok: false,
      design,
      checks: [...checks, { code: 'sim-failed', level: 'error', msg: `ngspice 只返回 ${rows.length} 个采样点` }],
      metrics: {},
    }
  }

  // Ignore the first half: the fuzz stage needs time to settle.
  const tail = rows.slice(Math.floor(rows.length / 2))
  const hasVcc = /\bvcc\b/i.test(cir)
  const inPeak = Math.max(...tail.map((row) => Math.abs(row[1])))
  const outRms = Math.sqrt(tail.reduce((sum, row) => sum + row[2] ** 2, 0) / tail.length)
  const outPeak = Math.max(...tail.map((row) => Math.abs(row[2])))
  const vcc = hasVcc ? tail[tail.length - 1][3] : undefined
  const metrics = { samples: tail.length, inPeak, outRms, outPeak, vcc, drive: STIMULUS }

  if (inPeak < STIMULUS.amplitude * 0.5) {
    checks.push({ code: 'input-dead', level: 'error', msg: `激励没有到达输入（峰值 ${inPeak.toFixed(4)} V）` })
  }
  if (outRms < SILENCE_RMS) {
    checks.push({
      code: 'silent-output',
      level: 'error',
      msg: `输出几乎静音（RMS ${outRms.toExponential(2)} V < ${SILENCE_RMS} V）：检查接地/短接/偏置`,
    })
  }
  if (vcc !== undefined && Math.abs(vcc) < 1) {
    checks.push({ code: 'supply-dead', level: 'error', msg: `供电节点 VCC = ${vcc} V` })
  }
  const ok = !checks.some((check) => check.level === 'error')
  return { ok, design, checks, metrics }
}
