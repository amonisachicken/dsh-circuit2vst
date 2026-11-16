/**
 * Netlist parity: the ported JS generator must produce the same bytes as the
 * upstream Rust backend for the same `.design.json`.
 *
 * Goldens are **produced by the upstream backend**, never by the port, so this
 * test can fail for real. Two modes:
 *
 *   node test/netlist-parity.mjs --refresh   # needs the upstream backend on :3600
 *   node --test test/netlist-parity.mjs      # compares against the goldens
 *
 * When the backend is reachable it also compares live, which catches drift in
 * the vendored symbols without refreshing anything.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateNetlist } from '../src/client/circuit-netlist.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SYMBOLS = JSON.parse(readFileSync(join(ROOT, 'vendor/circuit/symbols.json'), 'utf8'))
const EXAMPLE_DIRS = [
  join(ROOT, 'vendor/circuit/examples'),
  join(HERE, 'fixtures', 'parity'),
]
const GOLDEN = join(HERE, 'fixtures', 'netlist')
const RPC = process.env.DESIGNER_RPC ?? 'http://127.0.0.1:3600/rpc'
const refresh = process.argv.includes('--refresh')

/**
 * Call the upstream backend.
 * @param method - RPC method name.
 * @param params - request params.
 * @returns the `result` payload.
 */
async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
  })
  const body = await response.json()
  if (body.ok !== true) throw new Error(`${method} 失败：${body.error}`)
  return body.result
}

/**
 * Whether the upstream backend answers.
 * @returns true when `designer.ping` succeeds.
 */
async function backendUp() {
  try {
    const result = await rpc('designer.ping', {})
    return result?.pong === true
  } catch {
    return false
  }
}

/**
 * Compare two lint lists as multisets (the Rust side collects them from a
 * HashMap, so their order is not stable).
 * @param actual - ported lints.
 * @param expected - backend lints.
 * @returns a human-readable difference, or null when equal.
 */
function lintDiff(actual, expected) {
  const normalize = (lints) => [...lints]
    .map((lint) => `${lint.level}|${lint.code}|${lint.msg}`)
    .sort()
  const left = normalize(actual)
  const right = normalize(expected)
  if (left.length !== right.length) return `lint 数量不同：${left.length} vs ${right.length}`
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return `lint 不同：\n  ${left[index]}\n  ${right[index]}`
  }
  return null
}

/**
 * Round a coordinate so float noise from libm differences does not fail the test.
 * @param value - millimetre coordinate.
 * @returns the value rounded to 1e-6 mm.
 */
const round6 = (value) => Math.round(value * 1e6) / 1e6

/**
 * Compare dangling pins structurally.
 * @param actual - ported dangling list.
 * @param expected - backend dangling list.
 * @returns a human-readable difference, or null when equal.
 */
function danglingDiff(actual, expected) {
  if (actual.length !== expected.length) return `悬空引脚数量不同：${actual.length} vs ${expected.length}`
  for (let index = 0; index < actual.length; index += 1) {
    const a = actual[index]
    const b = expected[index]
    if (a.ref !== b.ref || a.pin !== b.pin
      || round6(a.at.x) !== round6(b.at.x) || round6(a.at.y) !== round6(b.at.y)) {
      return `悬空引脚不同：${JSON.stringify(a)} vs ${JSON.stringify(b)}`
    }
  }
  return null
}

const cases = EXAMPLE_DIRS.flatMap((dir) => readdirSync(dir)
  .filter((file) => file.endsWith('.design.json'))
  .map((file) => ({ name: basename(file, '.design.json'), path: join(dir, file) })))
  .sort((left, right) => left.name.localeCompare(right.name))
const names = cases.map((entry) => entry.name)

if (refresh) {
  if (!(await backendUp())) {
    console.error(`✗ 刷新黄金文件需要上游后端：${RPC}（先 cd backend && cargo run）`)
    process.exit(2)
  }
  for (const { name, path } of cases) {
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    const generated = await rpc('designer.netlist', doc)
    writeFileSync(join(GOLDEN, `${name}.cir`), generated.cir)
    writeFileSync(join(GOLDEN, `${name}.json`), `${JSON.stringify({
      lints: generated.lints,
      ports: generated.ports,
      dangling: generated.dangling,
      nets: generated.nets,
    }, null, 2)}\n`)
    console.log(`✓ ${name}.cir（${generated.cir.split('\n').length - 1} 行，${generated.lints.length} 条 lint）`)
  }
  process.exit(0)
}

const live = await backendUp()
const failures = []
for (const { name, path } of cases) {
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  const goldenCir = readFileSync(join(GOLDEN, `${name}.cir`), 'utf8')
  const goldenMeta = JSON.parse(readFileSync(join(GOLDEN, `${name}.json`), 'utf8'))
  const mine = generateNetlist(doc, SYMBOLS)

  const problems = []
  if (mine.cir !== goldenCir) {
    const actualLines = mine.cir.split('\n')
    const expectedLines = goldenCir.split('\n')
    const line = actualLines.findIndex((text, index) => text !== expectedLines[index])
    problems.push(`网表第 ${line + 1} 行不同：\n    我: ${JSON.stringify(actualLines[line])}\n    上游: ${JSON.stringify(expectedLines[line])}`)
  }
  const lintProblem = lintDiff(mine.lints, goldenMeta.lints)
  if (lintProblem !== null) problems.push(lintProblem)
  if (mine.ports.in !== goldenMeta.ports.in || mine.ports.out !== goldenMeta.ports.out) {
    problems.push(`端口不同：${JSON.stringify(mine.ports)} vs ${JSON.stringify(goldenMeta.ports)}`)
  }
  const danglingProblem = danglingDiff(mine.dangling, goldenMeta.dangling)
  if (danglingProblem !== null) problems.push(danglingProblem)

  if (live) {
    const generated = await rpc('designer.netlist', doc)
    if (generated.cir !== mine.cir) problems.push('活体比对：网表与上游后端不同')
    const liveLint = lintDiff(mine.lints, generated.lints)
    if (liveLint !== null) problems.push(`活体比对：${liveLint}`)
  }

  if (problems.length === 0) {
    console.log(`✓ ${name}${live ? '（含活体）' : ''}`)
  } else {
    failures.push({ name, problems })
    console.log(`✗ ${name}`)
    for (const problem of problems) console.log(`    ${problem}`)
  }
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length}/${names.length} 个示例不一致`)
  process.exit(1)
}
console.log(`\n全部一致：${names.length} 个示例，网表逐字节相同${live ? '（含上游后端活体比对）' : ''}`)
