/**
 * Configuration defaults plus the cross-repository version pins.
 *
 * The pins are the single place a release bump happens. They mirror the
 * combination rustomp documents as compatible (`docs/status.md` §1 at v0.1.3):
 * framework v0.1.3 + mac v0.1.8 + win v0.3.0 + linux v0.1.0.
 */
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Plugin bundle root, used to locate files shipped with the plugin. */
export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Symbol manifest the circuit designer imports with (`rustomp-import`). */
export const DESIGNER_SYMBOLS = join(PLUGIN_ROOT, 'vendor/circuit/symbols.json')

/** Plugin build this Host half was written against. */
export const PLUGIN_VERSION = '0.1.5'

/** The DSP framework every project links against. */
export const FRAMEWORK = Object.freeze({
  repo: 'rustomp',
  tag: 'v0.1.3',
  label: 'rustomp 框架',
})

/**
 * One packer per host platform. A platform missing here has no packer, so the
 * plugin says so instead of pretending a build is possible.
 */
export const PACKERS = Object.freeze({
  darwin: Object.freeze({
    repo: 'rustomp-mac-plugin',
    tag: 'v0.1.8',
    label: 'macOS 打包器',
    formats: Object.freeze(['au', 'vst3', 'clap', 'dmg']),
    needsThirdParty: true,
  }),
  win32: Object.freeze({
    repo: 'rustomp-win-plugin',
    tag: 'v0.3.0',
    label: 'Windows 打包器',
    formats: Object.freeze(['vst3', 'clap', 'msi']),
    needsThirdParty: false,
  }),
  linux: Object.freeze({
    repo: 'rustomp-linux-plugin',
    tag: 'v0.1.0',
    label: 'Linux 打包器',
    formats: Object.freeze(['vst3', 'clap', 'targz']),
    needsThirdParty: false,
  }),
})

/**
 * Resolve the packer record for a platform.
 * @param platform - a `process.platform` value.
 * @returns the record, or undefined when this platform has no packer.
 */
export function packerFor(platform = process.platform) {
  return PACKERS[platform]
}

/** Where plugin projects are created when nothing else is configured. */
export function defaultProjectsDir() {
  return join(homedir(), 'deve', 'rustomp-projects')
}

/**
 * Expand a leading `~` so a patch may write a portable home-relative path.
 * @param value - configured path.
 * @returns an absolute path.
 */
function expandHome(value) {
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}

/**
 * Turn the row's raw config into the settings the Host half uses.
 * @param raw - config object from the loader entry, possibly undefined.
 * @returns resolved settings.
 */
export function resolveConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const override = typeof input.packerOverride === 'string' ? expandHome(input.packerOverride.trim()) : ''
  const overrideFormats = Array.isArray(input.packerFormats)
    ? input.packerFormats.map(String).filter(Boolean)
    : ['au', 'vst3', 'clap', 'dmg', 'msi', 'targz']
  const projectsDir = expandHome(String(input.projectsDir ?? defaultProjectsDir()))
  const depsDir = expandHome(String(input.depsDir ?? join(projectsDir, '.deps')))
  const packer = packerFor()
  return {
    projectsDir,
    designerSymbols: DESIGNER_SYMBOLS,
    depsDir,
    githubBase: String(input.githubBase ?? 'https://github.com/amonisachicken').replace(/\/+$/, ''),
    allowNetwork: input.allowNetwork !== false,
    fetchThirdParty: input.fetchThirdParty === true,
    /** Pinned in the patch when a whole profile shares one proxy; otherwise the settings file decides. */
    proxy: typeof input.proxy === 'string' ? input.proxy : '',
    framework: { ...FRAMEWORK, dir: join(depsDir, FRAMEWORK.repo) },
    // An explicit contract-B script wins over the platform default: it is how a
    // new platform, a container wrapper, or a private packer is plugged in.
    packer: override !== ''
      ? {
        repo: 'custom',
        tag: 'custom',
        label: typeof input.packerLabel === 'string' && input.packerLabel !== '' ? input.packerLabel : '自定义打包器',
        formats: Object.freeze(overrideFormats),
        needsThirdParty: false,
        override: true,
        script: override,
        dir: dirname(override),
      }
      : packer === undefined ? null : { ...packer, dir: join(depsDir, packer.repo) },
    platform: process.platform,
    arch: process.arch,
  }
}

/**
 * Project the settings the panel is allowed to see.
 * @param settings - resolved settings.
 * @returns a JSON-safe view.
 */
export function publicConfig(settings) {
  return {
    projectsDir: settings.projectsDir,
    depsDir: settings.depsDir,
    githubBase: settings.githubBase,
    allowNetwork: settings.allowNetwork,
    fetchThirdParty: settings.fetchThirdParty,
    pinnedProxy: settings.proxy,
    platform: settings.platform,
    arch: settings.arch,
    framework: {
      repo: settings.framework.repo,
      tag: settings.framework.tag,
      dir: settings.framework.dir,
    },
    packer: settings.packer === null ? null : {
      repo: settings.packer.repo,
      label: settings.packer.label,
      tag: settings.packer.tag,
      dir: settings.packer.dir,
      formats: [...settings.packer.formats],
      needsThirdParty: settings.packer.needsThirdParty === true,
      override: settings.packer.override === true,
      script: settings.packer.script ?? null,
    },
  }
}
