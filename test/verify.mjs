/**
 * The build gate: a design must produce a live signal in ngspice.
 *
 * Skipped when ngspice is not installed (it is optional infrastructure on the
 * host; the check becomes mandatory wherever ngspice exists).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { verifyCircuit, parseRows, buildBatch, SILENCE_RMS } from '../src/host/verify.js'

const ROOT = new URL('..', import.meta.url).pathname
const GOOD = '/Users/gutoushanghaidai/deve/rustomp-projects/red-face/circuit/red-face.design.json'

/** Whether the host has ngspice. */
function hasNgspice() {
  try {
    execFileSync('ngspice', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Project with one design file. */
async function project(designPath) {
  const dir = await mkdtemp(join(tmpdir(), 'c2v-verify-'))
  await mkdir(join(dir, 'circuit'), { recursive: true })
  await copyFile(designPath, join(dir, 'circuit', 'demo.design.json'))
  return dir
}

test('the batch carries models, a stimulus and the prints', () => {
  const batch = buildBatch('* net\nR1 IN OUT 1k\n.end\n', '.model D D()\n')
  assert.match(batch, /VIN IN 0 SIN\(0 0\.1 440\)/)
  assert.match(batch, /\.tran/)
  assert.match(batch, /\.print tran/)
  assert.match(batch, /\.model D D\(\)/)
})

test('ascii rows are parsed', () => {
  const rows = parseRows('0\t0\t0.1\t0.2\n1\t1e-6\t-0.1\t0.3\nnoise\n')
  assert.deepEqual(rows, [[0, 0.1, 0.2], [1e-6, -0.1, 0.3]])
})

test('a live design passes the gate', async (t) => {
  if (!hasNgspice()) return t.skip('no ngspice')
  const dir = await project(GOOD)
  try {
    const report = await verifyCircuit(dir)
    assert.equal(report.ok, true)
    assert.ok(report.metrics.outRms > SILENCE_RMS * 10, `outRms=${report.metrics.outRms}`)
    assert.ok(report.metrics.inPeak > 0.05)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a shorted design is rejected as silent', async (t) => {
  if (!hasNgspice()) return t.skip('no ngspice')
  const dir = await project(GOOD)
  try {
    const path = join(dir, 'circuit', 'demo.design.json')
    const doc = JSON.parse(await readFile(path, 'utf8'))
    // Ground the base: the same class of bug as a wire crossing a ground pin.
    doc.wires.push(
      { id: 'wShort1', points: [{ x: 62.5, y: 20 }, { x: 90, y: 20 }] },
      { id: 'wShort2', points: [{ x: 90, y: 20 }, { x: 90, y: 27.5 }] },
    )
    await writeFile(path, JSON.stringify(doc), 'utf8')
    const report = await verifyCircuit(dir)
    assert.equal(report.ok, false)
    assert.ok(report.checks.some((check) => check.code === 'silent-output'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a project without a design is rejected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'c2v-verify-'))
  try {
    const report = await verifyCircuit(dir)
    assert.equal(report.ok, false)
    assert.equal(report.checks[0].code, 'design-missing')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
