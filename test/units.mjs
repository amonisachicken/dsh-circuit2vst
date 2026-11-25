/**
 * Unit checks for the pure helpers the panel and the tool share.
 *
 * Run with `node --test test/` from the bundle root. These never touch the
 * network or a real project: they pin the small contracts (packer arguments,
 * `ARTIFACT:` parsing, manifest reading, `[ui]` merging) that a refactor would
 * otherwise break silently.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readFileSync } from 'node:fs'
import { auditImplicitConnections, generateNetlist } from '../src/client/circuit-netlist.js'
import { ngspiceHint, pythonHint } from '../src/host/doctor.js'
import { parseArtifacts, packArgs } from '../src/host/pack.js'

const SYMBOLS = JSON.parse(readFileSync(new URL('../vendor/circuit/symbols.json', import.meta.url), 'utf8'))
import { parseManifest } from '../src/host/project.js'
import { slugOf } from '../src/host/framework.js'
import { findRegion, mergePanelToml, validateUiToml } from '../src/host/merge.js'

test('slugOf mirrors new-plugin.sh', () => {
  assert.equal(slugOf('My Drive'), 'my-drive')
  assert.equal(slugOf('C2V Test Drive'), 'c2v-test-drive')
  assert.equal(slugOf('  Fuzz   Face!! '), 'fuzz-face')
  assert.equal(slugOf('!!!'), 'plugin')
})

test('parseArtifacts reads only contract-B lines', () => {
  const stdout = [
    'ARTIFACT: /tmp/A.component',
    'noise that the packer should have sent to stderr',
    'ARTIFACT:/tmp/B.vst3',
    'ARTIFACT:   ',
    'ARTIFACT: /tmp/C.clap',
  ].join('\n')
  assert.deepEqual(parseArtifacts(stdout), ['/tmp/A.component', '/tmp/B.vst3', '/tmp/C.clap'])
})

test('packArgs defaults to both variants and no install', () => {
  const args = packArgs('/p', { allowedFormats: ['au', 'vst3'] })
  assert.deepEqual(args, ['/p', '--variant', 'mono', '--variant', 'stereo', '--no-install'])
})

test('packArgs drops formats the platform cannot produce', () => {
  const args = packArgs('/p', { formats: ['au', 'msi'], allowedFormats: ['au', 'vst3'], install: true, arch: 'both' })
  assert.deepEqual(args, ['/p', '--variant', 'mono', '--variant', 'stereo', '--format', 'au', '--arch', 'both'])
})

test('parseManifest reads the identity and shape of a project', () => {
  const toml = [
    '[plugin]',
    'package = "my-drive"',
    'name = "My Drive"',
    'vendor = "V"',
    'gui = false',
    '[build]',
    'gui = true',
    '[requires]',
    'framework = ">=0.1,<0.2"',
    'packer = ">=0.1"',
    '[[params]]',
    'id = "gain"',
    '[[params]]',
    'id = "level"',
    '[assets]',
    'panel = "assets/panel.png"',
    '[ui]',
    '[[ui.knobs]]',
    'id = "gain"',
    '[[ui.toggles]]',
    'id = "mode"',
  ].join('\n')
  const manifest = parseManifest(toml)
  assert.equal(manifest.name, 'My Drive')
  assert.equal(manifest.package, 'my-drive')
  assert.equal(manifest.gui, true)
  assert.equal(manifest.params, 2)
  assert.equal(manifest.uiControls, 2)
  assert.equal(manifest.hasUi, true)
  assert.equal(manifest.hasAssets, true)
  assert.equal(manifest.frameworkRequirement, '>=0.1,<0.2')
})

test('validateUiToml rejects documents the designer does not own', () => {
  assert.match(validateUiToml(''), /空/)
  assert.match(validateUiToml('[assets]\npanel = "a"\n'), /没有 \[ui\]/)
  assert.match(validateUiToml('[ui]\na = 1\n'), /没有 \[assets\]/)
  assert.match(validateUiToml('[assets]\na = 1\n[ui]\nb = 2\n[plugin]\nname = "x"\n'), /不拥有/)
  assert.equal(validateUiToml('[assets]\npanel = "a"\n[ui]\nb = 2\n'), null)
})

test('mergePanelToml replaces the designer region and keeps the rest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'c2v-merge-'))
  const manifest = join(dir, 'rustomp.toml')
  await writeFile(manifest, '[plugin]\nname = "Keep Me"\n\n[assets]\npanel = "old.png"\n', 'utf8')
  const result = await mergePanelToml(manifest, '# >>> rustomp-box-designer\n[assets]\npanel = "new.png"\n\n[ui]\nsvg_width = 1.0\n# <<< rustomp-box-designer\n')
  const text = await readFile(manifest, 'utf8')
  assert.equal(result.mode, 'sections')
  assert.match(text, /name = "Keep Me"/)
  assert.match(text, /panel = "new\.png"/)
  assert.doesNotMatch(text, /old\.png/)
  assert.equal(text.match(/\[assets\]/g)?.length, 1)
})

test('mergePanelToml keeps sections that follow the designer block', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'c2v-merge-tail-'))
  const manifest = join(dir, 'rustomp.toml')
  const before = [
    '[plugin]',
    'name = "Keep"',
    '',
    '# >>> rustomp-box-designer（自动生成）',
    '# >>> rustomp-box-designer（自动生成）',
    '[assets]',
    'panel = "old.png"',
    '[ui]',
    'svg_width = 1.0',
    '[[ui.knobs]]',
    'id = "a"',
    '# <<< rustomp-box-designer',
    '',
    '[requires]',
    'framework = ">=0.1,<0.2"',
    'packer_tag = "v0.1.7"',
  ].join('\n')
  await writeFile(manifest, before, 'utf8')
  const block = '# >>> rustomp-box-designer（自动生成）\n[assets]\npanel = "new.png"\n\n[ui]\nsvg_width = 2.0\n[[ui.knobs]]\nid = "b"\n# <<< rustomp-box-designer\n'
  const result = await mergePanelToml(manifest, block)
  const text = await readFile(manifest, 'utf8')
  assert.equal(result.mode, 'markers')
  assert.match(text, /\[requires\]/, 'the [requires] section must survive')
  assert.match(text, /packer_tag = "v0\.1\.7"/)
  assert.match(text, /svg_width = 2\.0/)
  assert.doesNotMatch(text, /old\.png/)
  assert.equal((text.match(/# >>> rustomp-box-designer/g) ?? []).length, 1, 'duplicate opening markers collapse')
})

test('findRegion falls back to the section scan without markers', () => {
  const lines = ['[plugin]', 'name = "x"', '[assets]', 'panel = "a.png"', '[ui]', 'svg_width = 1.0', '[[ui.knobs]]', 'id = "k"', '[requires]', 'framework = ">=0.1"']
  const region = findRegion(lines)
  assert.equal(region.mode, 'sections')
  assert.equal(region.start, 2)
  assert.equal(lines[region.end], 'id = "k"')
})

test('implicit connections: a pin tapping two wires is an error', () => {
  const doc = {
    parts: [
      { ref: 'X1', symbol: 'earth', at: { x: 0, y: 10 } },
      { ref: 'R1', symbol: 'resistor', at: { x: 0, y: -10 }, value: '1k' },
    ],
    wires: [
      { id: 'w1', points: [{ x: 0, y: -10 }, { x: 0, y: 5 }] },
      // The ground pin sits at (0, -2.5): interior to both wires.
      { id: 'w2', points: [{ x: -10, y: -2.5 }, { x: 10, y: -2.5 }] },
    ],
  }
  const entries = auditImplicitConnections(doc, SYMBOLS)
  const ground = entries.find((entry) => entry.ref === 'X1')
  assert.ok(ground, 'ground tap must be reported')
  assert.equal(ground.level, 'error')
  assert.match(ground.msg, /w1 \/ w2|w2 \/ w1/)
})

test('implicit connections: a single overshooting stub is only a warning', () => {
  const doc = {
    parts: [
      { ref: 'X1', symbol: 'earth', at: { x: 0, y: 10 } },
      { ref: 'R1', symbol: 'resistor', at: { x: 0, y: -10 }, value: '1k' },
    ],
    wires: [{ id: 'w1', points: [{ x: 0, y: -10 }, { x: 0, y: 5 }] }],
  }
  const entries = auditImplicitConnections(doc, SYMBOLS)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].level, 'warn')
})

test('implicit connections: a well-drawn design has none', () => {
  const doc = JSON.parse(readFileSync(new URL('../vendor/circuit/examples/diode-clip.design.json', import.meta.url), 'utf8'))
  assert.deepEqual(auditImplicitConnections(doc, SYMBOLS), [])
})

/** Minimal design with one potentiometer value, mirroring the upstream P2 test. */
function potDesign(value) {
  const part = (id, ref, symbol, x, y) => ({ id, ref, symbol, at: { x, y }, rot: 0, mirror: 'none' })
  return {
    name: 'pot',
    parts: [
      { ...part('p1', 'P1', 'potentiometer', 0, 0), value },
      part('p2', 'GND1', 'earth', -12.5, 12.5),
      part('p3', 'IN1', 'node-in', 25, 0),
    ],
    wires: [],
  }
}

test('a pot labelled 1M exports as meg and warns (Freedist P2)', () => {
  const generated = generateNetlist(potDesign('1M'), SYMBOLS)
  assert.ok(generated.cir.includes('0.5meg'), generated.cir)
  assert.ok(!generated.cir.includes('0.5M'))
  const lint = generated.lints.find((entry) => entry.code === 'pot-value-milli')
  assert.ok(lint, 'should warn about the milli reading')
  assert.equal(lint.level, 'warn')
  assert.match(lint.msg, /1meg/)
})

test('a sane pot value has no pot lint', () => {
  const generated = generateNetlist(potDesign('500k'), SYMBOLS)
  assert.deepEqual(generated.lints.filter((entry) => entry.code.startsWith('pot-')), [])
})

test('a pot below 1 Ω is an error', () => {
  const generated = generateNetlist(potDesign('0'), SYMBOLS)
  const lint = generated.lints.find((entry) => entry.code === 'pot-value-range')
  assert.ok(lint)
  assert.equal(lint.level, 'error')
})

test('the ngspice hint follows the platform and keeps the source recipe', () => {
  const linux = ngspiceHint('linux')
  assert.ok(!linux.includes('brew'), linux)
  assert.match(linux, /apt install ngspice/)
  assert.match(linux, /pacman -S ngspice/)
  assert.match(ngspiceHint('darwin'), /^brew install ngspice/)
  assert.match(ngspiceHint('win32'), /mingw-w64-x86_64-ngspice/)
  for (const platform of ['darwin', 'linux', 'win32']) {
    assert.match(ngspiceHint(platform), /git clone https:\/\/github\.com\/ngspice\/ngspice\.git/, platform)
  }
})

test('the python hint does not tell Linux users to brew', () => {
  assert.ok(!pythonHint('linux').includes('brew'))
  assert.match(pythonHint('darwin'), /brew install python/)
})

test('rotated sprites use a wrapping <g>, not a nested-svg transform (WebKitGTK)', async () => {
  const { newDoc, factory } = await import('../vendor/boxdesigner/model.js')
  const { panelSvg } = await import('../vendor/boxdesigner/exporter.js')
  const { ASSET_TEXT } = await import('../vendor/boxdesigner/assets.text.js')
  const { mergedAssets } = await import('../vendor/boxdesigner/model.js')

  const doc = newDoc({ name: 'rot', preset: '1590B' })
  const knob = factory.knob(doc, { asset: 'knob_round_dark', param: 'gain', center: [20, 20] })
  doc.elements.push(knob)
  const assets = mergedAssets(doc, ASSET_TEXT)

  const turned = panelSvg(doc, assets, { controls: true, values: { [knob.id]: 0.75 } })
  assert.match(turned, /<g transform="rotate\([\d.-]+ [\d.]+ [\d.]+\)">/, '旋转应写在 <g transform> 上')
  const sprite = turned.slice(turned.indexOf('<g transform="rotate('))
  assert.doesNotMatch(sprite.slice(0, 400), /<svg[^>]*\btransform=/, '内层 <svg> 不应再带 transform（WebKitGTK 忽略）')

  const centred = panelSvg(doc, assets, { controls: true, values: { [knob.id]: 0.5 } })
  assert.doesNotMatch(centred, /<g transform="rotate\(/, '0.5 时不需要旋转包裹')
})

/** Minimal two-terminal design around one part. */
function around(part, extra = []) {
  return {
    name: 'dev',
    parts: [
      part,
      { id: 'g1', ref: 'GND1', symbol: 'earth', at: { x: -12.5, y: 12.5 }, rot: 0, mirror: 'none' },
      { id: 'i1', ref: 'IN1', symbol: 'node-in', at: { x: 12.5, y: 0 }, rot: 0, mirror: 'none' },
      ...extra,
    ],
    wires: [],
  }
}

test('an inductor emits L<ref> a b <value> (default 10m)', () => {
  const part = { id: 'p1', ref: 'L1', symbol: 'inductor', at: { x: 0, y: 0 }, rot: 0, mirror: 'none', value: '10m' }
  const generated = generateNetlist(around(part), SYMBOLS)
  const line = generated.cir.split('\n').find((entry) => entry.startsWith('L1 '))
  assert.ok(line, generated.cir)
  assert.ok(line.endsWith('10m'), line)
  assert.equal(line.split(/\s+/).length, 4, line)
})

test('a transformer expands into four windings and six couplings', () => {
  const part = {
    id: 'p1', ref: 'T1', symbol: 'transformer', at: { x: 0, y: 0 }, rot: 0, mirror: 'none',
    value: '1', ratio: 2,
  }
  const out = { id: 'o1', ref: 'OUT1', symbol: 'node-out', at: { x: 20, y: 0 }, rot: 0, mirror: 'none' }
  const generated = generateNetlist(around(part, [out]), SYMBOLS)
  const windings = generated.cir.split('\n').filter((line) => line.startsWith('LT1'))
  const couplings = generated.cir.split('\n').filter((line) => line.startsWith('KT1'))
  assert.equal(windings.length, 4, generated.cir)
  assert.equal(couplings.length, 6, generated.cir)
  assert.ok(generated.cir.includes('0.25'), generated.cir)
  assert.ok(generated.cir.includes('0.0625'), generated.cir)
  assert.equal(couplings.filter((line) => line.endsWith('0.9999')).length, 2)
  assert.equal(couplings.filter((line) => line.endsWith('0.999')).length, 4)
})

test('transformer taps scale the winding split', () => {
  const part = {
    id: 'p1', ref: 'T1', symbol: 'transformer', at: { x: 0, y: 0 }, rot: 0, mirror: 'none',
    value: '1', ratio: 1, tap_p: 0.3, tap_s: 0.7,
  }
  const generated = generateNetlist(around(part), SYMBOLS)
  const windings = generated.cir.split('\n').filter((line) => line.startsWith('LT1'))
  assert.ok(windings[0].endsWith('0.09'), windings[0])
  assert.ok(windings[1].endsWith('0.49'), windings[1])
  assert.ok(windings[2].endsWith('0.49'), windings[2])
  assert.ok(windings[3].endsWith('0.09'), windings[3])
})

test('out-of-range transformer parameters are errors', () => {
  for (const [ratio, k, tap] of [[2, 1, 0.5], [2, 0.999, 1], [0, 0.999, 0.5]]) {
    const part = {
      id: 'p1', ref: 'T1', symbol: 'transformer', at: { x: 0, y: 0 }, rot: 0, mirror: 'none',
      value: '1', ratio, k, tap_p: tap,
    }
    const generated = generateNetlist(around(part), SYMBOLS)
    const errors = generated.lints.filter((lint) => lint.level === 'error')
    assert.ok(errors.length > 0, JSON.stringify({ ratio, k, tap, lints: generated.lints }))
  }
})

test('a triode emits a five-column subcircuit instance', () => {
  const part = { id: 'p1', ref: 'X1', symbol: 'triode', at: { x: 0, y: 0 }, rot: 0, mirror: 'none', model: '12AX7' }
  const generated = generateNetlist(around(part), SYMBOLS)
  const line = generated.cir.split('\n').find((entry) => entry.startsWith('X1 '))
  assert.ok(line, generated.cir)
  const columns = line.split(/\s+/)
  assert.equal(columns.length, 5, line)
  assert.equal(columns[4], '12AX7')
  assert.deepEqual(generated.lints.filter((lint) => lint.level === 'error'), [])
})

test('a triode without a model is an error', () => {
  const part = { id: 'p1', ref: 'X1', symbol: 'triode', at: { x: 0, y: 0 }, rot: 0, mirror: 'none' }
  const generated = generateNetlist(around(part), SYMBOLS)
  assert.ok(generated.lints.some((lint) => lint.code === 'model-missing'))
})
