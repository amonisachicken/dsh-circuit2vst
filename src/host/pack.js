/**
 * Contract B: hand a project to the platform packer and read back `ARTIFACT:`.
 *
 * The packer owns every platform detail; this file owns only the three things
 * the contract promises: the argument vector, a non-zero exit on failure, and
 * one `ARTIFACT: <path>` line per produced artifact on stdout.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { runScript, tail , scriptPath } from './exec.js'
import { effectiveProxy } from './settings.js'

/** Packaging compiles the plugin, wraps AU, and may sign: minutes, not seconds. */
const PACK_TIMEOUT_MS = 1800000

/**
 * Collect artifact paths from a packer's stdout.
 * @param stdout - captured stdout.
 * @returns absolute paths in the order the packer printed them.
 */
export function parseArtifacts(stdout) {
  const found = []
  for (const line of String(stdout).split('\n')) {
    const match = /^ARTIFACT:(.*)$/.exec(line)
    if (match === null) continue
    const path = match[1].trim()
    // A blank `ARTIFACT:` line is a packer bug, not an artifact.
    if (path !== '') found.push(path)
  }
  return found
}

/**
 * Build the packer argument vector for one request.
 * @param projectDir - project root.
 * @param options - variants/formats/arch/install plus the platform's supported formats.
 * @returns the argument array.
 */
export function packArgs(projectDir, options) {
  const args = [projectDir]
  const variants = Array.isArray(options.variants) && options.variants.length > 0 ? options.variants : ['mono', 'stereo']
  for (const variant of variants) args.push('--variant', String(variant))
  const allowed = new Set(options.allowedFormats ?? [])
  const requested = (Array.isArray(options.formats) ? options.formats : [])
    .map(String)
    .filter((format) => allowed.size === 0 || allowed.has(format))
  for (const format of requested) args.push('--format', format)
  if (typeof options.arch === 'string' && options.arch !== '') args.push('--arch', options.arch)
  if (options.install !== true) args.push('--no-install')
  return args
}

/**
 * Run `pack.sh` for one project.
 * @param settings - resolved plugin settings.
 * @param projectDir - project root.
 * @param options - variants, formats, arch, install.
 * @returns artifacts, the raw log and the exit code.
 */
export async function runPack(settings, projectDir, options = {}) {
  if (settings.packer === null) {
    throw new Error(`本平台（${settings.platform}）没有打包器：无法产出插件。`)
  }
  const script = typeof settings.packer.script === 'string' && settings.packer.script !== ''
    ? settings.packer.script
    : `${settings.packer.dir}/pack.sh`
  if (!existsSync(script)) {
    throw new Error(`打包器没准备好：找不到 ${script}。先点「准备依赖」。`)
  }
  if (!existsSync(`${settings.framework.dir}/tools/meta/plugin_meta.py`)) {
    throw new Error(`框架没准备好：找不到 ${settings.framework.dir}/tools/meta/plugin_meta.py。先点「准备依赖」。`)
  }
  const args = packArgs(scriptPath(projectDir), {
    ...options,
    allowedFormats: settings.packer.formats,
  })
  const proxy = await effectiveProxy(settings)
  const env = { RUSTOMP_ROOT: scriptPath(settings.framework.dir) }
  if (settings.packer.override === true) {
    // A custom (for example container) packer must not share the host's target
    // directory: the same `bundled/<name>.clap` is a directory on macOS and a
    // file on Linux, so reusing it fails with "Is a directory (os error 21)".
    env.CARGO_TARGET_DIR = join(projectDir, 'target-custom')
  }
  if (proxy !== null) {
    env.HTTPS_PROXY = proxy
    env.HTTP_PROXY = proxy
    env.https_proxy = proxy
    env.http_proxy = proxy
  }
  const result = await runScript(script, args, {
    cwd: settings.packer.dir,
    timeoutMs: PACK_TIMEOUT_MS,
    env,
  })
  const artifacts = parseArtifacts(result.stdout)
  const verification = options.verification
  const parity = verification === undefined
    ? ''
    : verification.ok === true
      ? `\n✓ ngspice 对拍通过：IN 峰值 ${verification.metrics.inPeak.toFixed(3)} V → OUT RMS ${verification.metrics.outRms.toFixed(3)} V（VCC ${verification.metrics.vcc ?? 'n/a'}）`
      : verification.skipped === true
        ? `\n! ngspice 对拍跳过：${verification.reason}`
        : `\n✓ 对拍记录：${JSON.stringify(verification.checks)}`
  const log = parity + tail(`${result.stdout}${result.stderr === '' ? '' : `\n--- stderr ---\n${result.stderr}`}`, 12000)
  if (!result.ok) {
    throw Object.assign(new Error(`打包失败：${tail(result.stderr.trim() || result.stdout.trim(), 4000)}`), { log, artifacts })
  }
  if (artifacts.length === 0) {
    throw Object.assign(new Error('打包器没有打印任何 ARTIFACT: 行'), { log, artifacts })
  }
  return { artifacts, log, exitCode: result.code, args }
}
