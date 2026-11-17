/**
 * Packaging guard: the npm tarball must carry everything the runtime reads.
 *
 * A git-installed copy once lost `vendor/` because `package.json`'s `files`
 * omitted it — the repo worked, the installed profile threw ENOENT in the
 * simulator, importer and verify gate (report 2026-11-18). `npm pack --dry-run`
 * is the only check that sees what pnpm actually installs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Files the runtime cannot work without. */
const REQUIRED = [
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'src/host/sim.js',
  'src/host/verify.js',
  'src/host/routes.js',
  'vendor/circuit/models.lib',
  'vendor/circuit/symbols.json',
  'vendor/circuit/assets.gen.js',
  'vendor/boxdesigner/model.js',
]

test('the published tarball contains the runtime files', () => {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const [manifest] = JSON.parse(output)
  const files = new Set(manifest.files.map((entry) => entry.path))
  const missing = REQUIRED.filter((path) => !files.has(path))
  assert.deepEqual(missing, [], `安装包缺少运行时文件：\n${missing.join('\n')}\n（检查 package.json 的 files 白名单）`)
  // Spot-check the wildcard directory: every vendored circuit asset ships.
  assert.ok(files.has('vendor/circuit/examples/diode-clip.design.json'), 'vendor/circuit/examples 应随包发布')
})
