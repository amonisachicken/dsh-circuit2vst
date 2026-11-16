/**
 * Driving the framework's own tools.
 *
 * Nothing here reimplements rustomp: `new-plugin.sh`, `rustomp-import` and
 * `rustomp-gen` stay the only writers of project files, so a project this panel
 * produces is byte-identical to one built by hand on the command line.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { DESIGNER_SYMBOLS } from './config.js'
import { dirname } from 'node:path'

import { run, runScript, scriptPath, tail } from './exec.js'

/** First-time compilation of the framework crates is not fast. */
const TOOL_TIMEOUT_MS = 900000

/**
 * Project directory name implied by a display name, matching `new-plugin.sh`.
 * @param name - the plugin display name.
 * @returns a lower-case hyphenated slug.
 */
export function slugOf(name) {
  const slug = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug === '' ? 'plugin' : slug
}

/**
 * Environment every framework tool needs.
 * @param settings - resolved plugin settings.
 * @param extra - additional variables.
 * @returns the environment object.
 */
function frameworkEnv(settings, extra = {}) {
  // The framework scripts run under bash and write these paths into files, so
  // they must be POSIX style (`..\.deps\rustomp` is an invalid TOML escape).
  return { RUSTOMP_ROOT: scriptPath(settings.framework.dir), ...extra }
}

/**
 * Run one framework crate's binary through cargo.
 * @param settings - resolved plugin settings.
 * @param crate - package name, e.g. `rustomp-gen`.
 * @param args - arguments after `--`.
 * @returns the command result.
 */
async function runCrate(settings, crate, args) {
  const result = await run('cargo', ['run', '-q', '-p', crate, '--', ...args], {
    cwd: settings.framework.dir,
    timeoutMs: TOOL_TIMEOUT_MS,
    env: frameworkEnv(settings),
  })
  if (!result.ok) {
    const reason = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`
    throw new Error(`${crate} 失败：${tail(reason, 4000)}`)
  }
  return `${result.stdout}${result.stderr}`.trim()
}


/**
 * Normalise `path = "…"` values in a new project's TOML files.
 *
 * Framework v0.1.2 computes its own location with Python's `os.path.relpath`,
 * which returns Windows separators, and `new-plugin.sh` writes that straight into
 * the template: `path = "..\.deps\rustomp/crates/rustomp-dsp"`. TOML treats `\r`
 * as an invalid escape, so `cargo` cannot even read the manifest. This rewrites
 * those values with forward slashes (a no-op on every other platform).
 *
 * @param projectDir - freshly created project.
 */
async function normalizeTomlPaths(projectDir) {
  if (process.platform !== 'win32') return
  for (const file of ['Cargo.toml', 'plugin/Cargo.toml', 'circuit/Cargo.toml', 'bundler.toml']) {
    let text
    try {
      text = await readFile(`${projectDir}/${file}`, 'utf8')
    } catch {
      continue
    }
    const next = text.replace(/(path\s*=\s*")([^"]*)(")/g, (match, head, value, tail) => `${head}${value.replace(/\\/g, '/')}${tail}`)
    if (next !== text) await writeFile(`${projectDir}/${file}`, next, 'utf8')
  }
}

/**
 * Create a project from the framework template.
 * @param settings - resolved plugin settings.
 * @param options - display name and optional vendor.
 * @returns the created project directory and the tool log.
 */
export async function scaffoldProject(settings, options) {
  const name = String(options.name ?? '').trim()
  if (name === '') throw new Error('插件名不能为空')
  const vendor = String(options.vendor ?? '').trim()
  const slug = slugOf(name)
  const dest = scriptPath(`${settings.projectsDir}/${slug}`)
  const args = [name]
  if (vendor !== '') args.push('--vendor', vendor)
  const result = await runScript(`${settings.framework.dir}/scripts/new-plugin.sh`, args, {
    cwd: settings.framework.dir,
    timeoutMs: TOOL_TIMEOUT_MS,
    // new-plugin.sh writes here instead of next to the framework.
    env: frameworkEnv(settings, { RUSTOMP_GUEST: dest }),
  })
  if (!result.ok) {
    const reason = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`
    throw new Error(`new-plugin.sh 失败：${tail(reason, 4000)}`)
  }
  await normalizeTomlPaths(dest)
  return { slug, dir: dest, log: tail(`${result.stdout}\n${result.stderr}`, 8000) }
}

/**
 * Import a circuit into the project's generated module.
 * @param settings - resolved plugin settings.
 * @param projectDir - project root.
 * @param options - `source` (`.design.json` or `.cir`) and optional designer symbols path.
 * @returns the tool log.
 */
export async function importCircuit(settings, projectDir, options) {
  const source = String(options.source ?? '').trim()
  if (source === '') throw new Error('要给一个 .design.json 或 .cir 的路径')
  const target = `${projectDir}/circuit/src/generated/circuit.rs`
  // rustomp-import writes the file but never creates its directory, and a
  // freshly scaffolded project has no `circuit/src/generated/` yet.
  await mkdir(dirname(target), { recursive: true })
  const env = {}
  // A `.design.json` needs pin geometry; default to the manifest shipped with
  // the plugin so every caller (route, tool, tests) agrees on one source.
  const symbols = String(options.symbolsPath ?? '').trim()
    || (source.toLowerCase().endsWith('.design.json') ? DESIGNER_SYMBOLS : '')
  if (symbols !== '') env.RUSTOM_DESIGNER_SYMBOLS = symbols
  const written = await run('cargo', ['run', '-q', '-p', 'rustomp-import', '--', source, '--mna', target], {
    cwd: settings.framework.dir,
    timeoutMs: TOOL_TIMEOUT_MS,
    env: frameworkEnv(settings, env),
  })
  if (!written.ok) {
    const reason = written.stderr.trim() || written.stdout.trim() || `退出码 ${written.code}`
    throw new Error(`rustomp-import 失败：${tail(reason, 4000)}`)
  }
  // Verify the file on disk is exactly what the importer would write now.
  const checked = await run('cargo', ['run', '-q', '-p', 'rustomp-import', '--', source, '--mna', target, '--check'], {
    cwd: settings.framework.dir,
    timeoutMs: TOOL_TIMEOUT_MS,
    env: frameworkEnv(settings, env),
  })
  const drift = checked.ok ? '漂移检查：通过' : `漂移检查：失败（${tail(checked.stderr || checked.stdout, 1200)}）`
  return `${tail(`${written.stdout}\n${written.stderr}`, 4000)}\n${drift}`
}

/**
 * Regenerate the plugin-side code and verify it against the manifest.
 * @param settings - resolved plugin settings.
 * @param projectDir - project root.
 * @returns the tool log.
 */
export async function generatePlugin(settings, projectDir) {
  const written = await runCrate(settings, 'rustomp-gen', [projectDir])
  const checked = await run('cargo', ['run', '-q', '-p', 'rustomp-gen', '--', projectDir, '--check'], {
    cwd: settings.framework.dir,
    timeoutMs: TOOL_TIMEOUT_MS,
    env: frameworkEnv(settings),
  })
  const drift = checked.ok ? '漂移检查：通过' : `漂移检查：失败（${tail(checked.stderr || checked.stdout, 1200)}）`
  return `${tail(written, 3000)}\n${drift}`
}
