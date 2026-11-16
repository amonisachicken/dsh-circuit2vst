/**
 * Reading plugin projects without a TOML library.
 *
 * `rustomp.toml` is the cross-repository contract A; the panel only needs a
 * handful of identity fields to list projects, so this reads those keys and
 * leaves the full document to the framework's own `plugin_meta.py` (which the
 * tool calls when it needs an authoritative answer).
 */
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Pull the scalar value of `key = "value"` out of a section.
 * @param lines - document lines.
 * @param section - exact section header without brackets, e.g. `plugin`.
 * @param key - left-hand side key.
 * @returns the unquoted value, or null.
 */
function scalar(lines, section, key) {
  let current = ''
  for (const line of lines) {
    const trimmed = line.trim()
    const header = /^\[([^\]]+)\]$/.exec(trimmed)
    if (header !== null) {
      current = header[1].trim()
      continue
    }
    if (current !== section) continue
    const assignment = new RegExp(`^${key}\\s*=\\s*"([^"]*)"`).exec(trimmed)
    if (assignment !== null) return assignment[1]
  }
  return null
}

/**
 * Parse the identity and shape of one manifest.
 * @param text - `rustomp.toml` contents.
 * @returns the fields the panel lists.
 */
export function parseManifest(text) {
  const lines = text.split('\n')
  const params = lines.filter(line => /^\s*\[\[params\]\]\s*$/.test(line)).length
  const uiKnobs = lines.filter(line => /^\s*\[\[ui\.(knobs|toggles|leds|buttons)\]\]\s*$/.test(line)).length
  const hasUi = /^\s*\[ui\]\s*$/m.test(text) || uiKnobs > 0
  const hasAssets = /^\s*\[assets\]\s*$/m.test(text)
  return {
    name: scalar(lines, 'plugin', 'name'),
    package: scalar(lines, 'plugin', 'package'),
    vendor: scalar(lines, 'plugin', 'vendor'),
    clapId: scalar(lines, 'plugin', 'clap_id'),
    gui: /^\s*gui\s*=\s*true\s*$/m.test(text),
    params,
    uiControls: uiKnobs,
    hasUi,
    hasAssets,
    frameworkRequirement: scalar(lines, 'requires', 'framework'),
    packerRequirement: scalar(lines, 'requires', 'packer'),
    packerTag: scalar(lines, 'requires', 'packer_tag'),
  }
}

/**
 * List the plugin projects under the configured directory.
 * @param settings - resolved plugin settings.
 * @returns one entry per directory that holds a `rustomp.toml`.
 */
export async function listProjects(settings) {
  const root = settings.projectsDir
  if (!existsSync(root)) return []
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const projects = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dir = join(root, entry.name)
    const manifestPath = join(dir, 'rustomp.toml')
    if (!existsSync(manifestPath)) continue
    try {
      const text = await readFile(manifestPath, 'utf8')
      const manifest = parseManifest(text)
      // A design file means the panel designer has something to show.
      const hasDesign = existsSync(join(dir, 'design', 'panel.box.json'))
      projects.push({ slug: entry.name, dir, manifestPath, hasDesign, ...manifest })
    } catch (error) {
      projects.push({
        slug: entry.name,
        dir,
        manifestPath,
        name: null,
        error: `读不了 rustomp.toml：${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
  projects.sort((left, right) => (left.name ?? left.slug).localeCompare(right.name ?? right.slug))
  return projects
}
