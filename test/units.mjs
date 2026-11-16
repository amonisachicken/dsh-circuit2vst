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
import { auditImplicitConnections } from '../src/client/circuit-netlist.js'
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
