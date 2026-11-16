/**
 * Machine-local settings the user edits in the panel.
 *
 * The proxy lives here rather than in the plugin's `cordis.patch.yml` because
 * it describes one machine's network, not the plugin. Values in the patch still
 * win, so an administrator can pin them for a whole profile.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Fields the settings file may hold. */
const KNOWN_KEYS = ['proxy']

/**
 * Path of the settings file for a dependency layout.
 * @param settings - resolved plugin settings.
 * @returns an absolute path.
 */
export function settingsFile(settings) {
  return join(settings.projectsDir, '.circuit2vst.json')
}

/**
 * Read the settings file, tolerating an absent or malformed one.
 * @param settings - resolved plugin settings.
 * @returns known keys that were present, plus a warning when the file is broken.
 */
export async function readSettingsFile(settings) {
  const path = settingsFile(settings)
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return { path, values: {}, warning: null }
  }
  try {
    const parsed = JSON.parse(text)
    const values = {}
    for (const key of KNOWN_KEYS) {
      if (typeof parsed?.[key] === 'string' && parsed[key].trim() !== '') values[key] = parsed[key].trim()
    }
    return { path, values, warning: null }
  } catch (error) {
    return { path, values: {}, warning: `设置文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Save the known keys, keeping anything else already in the file.
 * @param settings - resolved plugin settings.
 * @param patch - values to write; an empty string removes a key.
 * @returns the settings now in force.
 */
export async function saveSettingsFile(settings, patch) {
  const path = settingsFile(settings)
  const current = await readSettingsFile(settings)
  const next = { ...current.values }
  for (const key of KNOWN_KEYS) {
    if (!(key in patch)) continue
    const value = String(patch[key] ?? '').trim()
    if (value === '') delete next[key]
    else next[key] = value
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return { path, values: next }
}

/**
 * Decide the proxy a network command should use.
 * @param settings - resolved plugin settings.
 * @returns the proxy URL, or null.
 */
export async function effectiveProxy(settings) {
  if (typeof settings.proxy === 'string' && settings.proxy.trim() !== '') return settings.proxy.trim()
  const { values } = await readSettingsFile(settings)
  if (typeof values.proxy === 'string' && values.proxy !== '') return values.proxy
  const fromEnv = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy ?? ''
  return fromEnv.trim() === '' ? null : fromEnv.trim()
}
