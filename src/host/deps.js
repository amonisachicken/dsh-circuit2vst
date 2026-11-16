/**
 * Fetching and inspecting the two ecosystem repositories a build needs.
 *
 * Nothing is vendored into this bundle: the framework and the packer are cloned
 * at the pinned tag into the user's dependency directory, the same layout
 * rustomp documents (`<deps>/{rustomp,rustomp-<platform>-plugin}`). Only the
 * packer for the current host is fetched, which is why a macOS user never
 * downloads the Windows or Linux tooling.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { run, runScript, tail } from './exec.js'
import { effectiveProxy } from './settings.js'

/**
 * Environment for a network child process.
 * @param settings - resolved plugin settings.
 * @returns proxy variables when one is configured, otherwise an empty object.
 */
async function networkEnv(settings) {
  const proxy = await effectiveProxy(settings)
  if (proxy === null) return { env: {}, proxy: null }
  return {
    proxy,
    env: {
      HTTPS_PROXY: proxy,
      HTTP_PROXY: proxy,
      https_proxy: proxy,
      http_proxy: proxy,
      ALL_PROXY: proxy,
      all_proxy: proxy,
    },
  }
}

/**
 * Clone URL for one ecosystem repository.
 * @param settings - resolved plugin settings.
 * @param repo - repository name.
 * @returns the HTTPS URL.
 */
export function repoUrl(settings, repo) {
  return `${settings.githubBase}/${repo}.git`
}

/**
 * Read the tag currently checked out in a repository.
 * @param dir - repository directory.
 * @returns `v0.1.2`-style tag, a short sha when untagged, or null.
 */
export async function gitTag(dir) {
  const result = await run('git', ['-C', dir, 'describe', '--tags', '--always'], { timeoutMs: 15000 })
  if (!result.ok) return null
  const tag = result.stdout.trim()
  return tag === '' ? null : tag
}

/**
 * Read the short commit of a checkout.
 * @param dir - repository directory.
 * @returns short sha, or null when it is not a git checkout.
 */
export async function gitHead(dir) {
  const result = await run('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { timeoutMs: 15000 })
  if (!result.ok) return null
  const head = result.stdout.trim()
  return head === '' ? null : head
}

/**
 * Describe one pinned dependency without changing anything.
 * @param spec - `{ repo, tag, dir, label }`.
 * @returns presence, checkout identity, and whether the tag matches the pin.
 */
export async function inspectRepo(spec) {
  if (typeof spec.script === 'string' && spec.script !== '') {
    const present = existsSync(spec.script)
    return {
      repo: spec.repo, label: spec.label, tag: spec.tag, dir: spec.dir,
      present, head: null, installedTag: present ? 'custom' : null, isGit: false, matchesPin: present,
      script: spec.script,
    }
  }
  const present = existsSync(spec.dir)
  if (!present) {
    return { repo: spec.repo, label: spec.label, tag: spec.tag, dir: spec.dir, present: false, head: null, installedTag: null, matchesPin: false }
  }
  const [head, installedTag] = await Promise.all([gitHead(spec.dir), gitTag(spec.dir)])
  return {
    repo: spec.repo,
    label: spec.label,
    tag: spec.tag,
    dir: spec.dir,
    present: true,
    head,
    installedTag,
    isGit: head !== null,
    matchesPin: installedTag === spec.tag,
  }
}

/**
 * Clone one repository at its pinned tag.
 * @param settings - resolved plugin settings.
 * @param spec - `{ repo, tag, dir }`.
 * @returns the command result, with a trimmed log for the panel.
 */
export async function cloneRepo(settings, spec) {
  if (!settings.allowNetwork) {
    throw new Error('allowNetwork=false：不会自动 clone。请在 cordis.patch.yml 里打开它，或手动把仓库放到 depsDir 下。')
  }
  await mkdir(dirname(spec.dir), { recursive: true })
  const { env, proxy } = await networkEnv(settings)
  // HTTP/1.1 keeps a proxy and a flaky link out of libcurl's HTTP/2 framing path.
  const result = await run('git', [
    '-c', 'http.version=HTTP/1.1',
    'clone', '--depth', '1', '--branch', spec.tag, repoUrl(settings, spec.repo), spec.dir,
  ], { timeoutMs: 600000, env })
  if (!result.ok) {
    const reason = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`
    const hint = proxy === null
      ? '\n没有配置代理：若本机需要代理才能访问 GitHub，在面板里填上代理地址后重试。'
      : `\n使用代理 ${proxy}。`
    throw new Error(`clone ${spec.repo}@${spec.tag} 失败：${tail(reason, 2000)}${hint}`)
  }
  return tail(result.stderr, 2000)
}

/**
 * Fetch the macOS packer's third-party sources (clap-wrapper / CLAP / AudioUnitSDK).
 * The packer owns the version pins; this only triggers its script.
 * @param spec - the packer spec, including `dir`.
 * @returns the command result log.
 */
export async function fetchThirdParty(spec, settings) {
  const script = `${spec.dir}/scripts/fetch-third-party.sh`
  if (!existsSync(script)) throw new Error(`打包器里没有 ${script}，无法拉取第三方源码`)
  const { env } = settings === undefined ? { env: {} } : await networkEnv(settings)
  const result = await runScript(script, [], { cwd: spec.dir, timeoutMs: 900000, env })
  if (!result.ok) {
    const reason = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`
    throw new Error(`fetch-third-party.sh 失败：${tail(reason, 4000)}`)
  }
  return tail(`${result.stdout}\n${result.stderr}`, 2000)
}

/**
 * Read the packer's own report.
 * @param spec - the packer spec.
 * @returns its output, or a marker when the script is missing.
 */
export async function packerDoctor(spec) {
  const script = `${spec.dir}/scripts/doctor.sh`
  if (!existsSync(script)) return { ok: false, output: `没有 ${script}` }
  const result = await runScript(script, [], { cwd: spec.dir, timeoutMs: 180000 })
  return { ok: result.ok, output: tail(`${result.stdout}\n${result.stderr}`.trim(), 8000) }
}
