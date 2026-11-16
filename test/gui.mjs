/**
 * Unit tests for the "enable GUI" step.
 *
 * The step must be idempotent and must never clobber a hand-written editor.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { enableGui } from '../src/host/gui.js'

/** A headless project, as the scaffold template produces it. */
const FIXTURE = {
  'rustomp.toml': `[plugin]
name = "Demo"

[build]
variants = ["mono"]
gui = false

[ui]
svg_width = 60
svg_height = 80
`,
  'Cargo.toml': `[workspace]
members = ["plugin", "circuit"]

[workspace.dependencies]
rustomp-dsp = { path = "../.deps/rustomp/crates/rustomp-dsp" }
`,
  'plugin/Cargo.toml': `[package]
name = "demo"

[dependencies]
rustomp-dsp = { workspace = true }

nih_plug = { git = "https://github.com/robbert-vdh/nih-plug.git", rev = "de42101" }

[features]
default = []
mono = []
gui = []
`,
  'plugin/src/lib.rs': `mod generated;

pub use generated::plugin_impl::*;
`,
}

/**
 * Create a throwaway project.
 * @param extra - additional files to override.
 * @returns the project directory.
 */
async function project(extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'c2v-gui-'))
  for (const [relative, text] of Object.entries({ ...FIXTURE, ...extra })) {
    const target = join(dir, relative)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, text, 'utf8')
  }
  return dir
}

test('enabling the GUI wires all four pieces once', async () => {
  const dir = await project()
  try {
    const first = await enableGui(dir)
    assert.deepEqual(first.changed.sort(), [
      'Cargo.toml',
      'plugin/Cargo.toml',
      'plugin/src/editor.rs',
      'plugin/src/lib.rs',
      'rustomp.toml',
    ])
    assert.deepEqual(first.errors, [])

    const manifest = await readFile(join(dir, 'rustomp.toml'), 'utf8')
    assert.match(manifest, /\[build\]\nvariants = \["mono"\]\ngui = true/)
    const workspace = await readFile(join(dir, 'Cargo.toml'), 'utf8')
    assert.match(workspace, /rustomp-gui = \{ path = "\.\.\/\.deps\/rustomp\/crates\/rustomp-gui" \}/)
    const plugin = await readFile(join(dir, 'plugin/Cargo.toml'), 'utf8')
    assert.match(plugin, /nih_plug_egui = \{ git = "https:\/\/github\.com\/robbert-vdh\/nih-plug\.git", rev = "de42101" \}/)
    assert.match(plugin, /rustomp-gui = \{ workspace = true \}/)
    assert.match(plugin, /default = \["gui"\]/)
    const editor = await readFile(join(dir, 'plugin/src/editor.rs'), 'utf8')
    assert.match(editor, /pub fn make\(params: Arc<PluginParams>, activity: Arc<AtomicU32>\)/)
    const lib = await readFile(join(dir, 'plugin/src/lib.rs'), 'utf8')
    assert.match(lib, /#\[cfg\(feature = "gui"\)\]\nmod editor;/)

    const second = await enableGui(dir)
    assert.equal(second.alreadyEnabled, true)
    assert.deepEqual(second.changed, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('an existing editor is left alone', async () => {
  const dir = await project({ 'plugin/src/editor.rs': '// my own editor\n' })
  try {
    const report = await enableGui(dir)
    assert.ok(!report.changed.includes('plugin/src/editor.rs'))
    assert.equal(await readFile(join(dir, 'plugin/src/editor.rs'), 'utf8'), '// my own editor\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a project without a panel section is flagged', async () => {
  const manifest = FIXTURE['rustomp.toml'].replace(/\[ui\][\s\S]*$/, '')
  const dir = await project({ 'rustomp.toml': manifest })
  try {
    const report = await enableGui(dir)
    assert.equal(report.errors.length, 1)
    assert.match(report.errors[0], /\[ui\]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a project without a workspace dependency anchor is reported', async () => {
  const dir = await project({ 'Cargo.toml': '[workspace]\nmembers = ["plugin"]\n' })
  try {
    const report = await enableGui(dir)
    assert.ok(report.errors.some((error) => error.startsWith('Cargo.toml')))
    assert.ok(existsSync(join(dir, 'plugin/src/editor.rs')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
