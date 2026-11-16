/**
 * Merge a panel designer export into `rustomp.toml`.
 *
 * Contract A says a designer owns exactly `[assets]` + `[ui]`, but nothing
 * guarantees those sit at the end of the file: a real project (Sparklin Drive)
 * puts `[requires]` after them. Truncating at `[assets]` — the rule upstream's
 * runbook suggests — would delete that section and silently disable the
 * cross-repository version checks, so the region is located explicitly:
 *
 *   1. the marker block `# >>> rustomp-box-designer` … `# <<< rustomp-box-designer`
 *      when present (repeated merges can duplicate the opening marker; replacing
 *      the whole span collapses them);
 *   2. otherwise the `[assets]`/`[ui]`/`[[ui.*]]` run of lines, stopping at the
 *      next unrelated section;
 *   3. otherwise the file is appended to.
 *
 * Everything outside the region is preserved byte for byte.
 */
import { readFile } from 'node:fs/promises'

const OPEN_MARKER = /^\s*#\s*>>>\s*rustomp-box-designer/
const CLOSE_MARKER = /^\s*#\s*<<<\s*rustomp-box-designer/
const isAssetSection = (line) => /^\s*\[assets\]\s*$/.test(line)
const isUiSection = (line) => /^\s*\[ui\]\s*$/.test(line) || /^\s*\[\[ui\./.test(line)

/**
 * Check that a document looks like a designer export.
 * @param uiToml - exported `ui.toml` text.
 * @returns an error message, or null when it is usable.
 */
export function validateUiToml(uiToml) {
  const text = String(uiToml ?? '')
  if (text.trim() === '') return 'ui.toml 是空的'
  if (!/^\s*\[ui\]\s*$/m.test(text)) return 'ui.toml 里没有 [ui] 段'
  if (!/^\s*\[assets\]\s*$/m.test(text)) return 'ui.toml 里没有 [assets] 段'
  if (/^\s*\[(plugin|au|build|circuit|requires)\]\s*$/m.test(text)) {
    return 'ui.toml 里出现了设计器不拥有的段（[plugin]/[au]/[build]/[circuit]/[requires]）'
  }
  return null
}

/**
 * Locate the designer-owned line range.
 * @param lines - manifest lines.
 * @returns `{ start, end, mode }`; `start` is -1 when nothing matched.
 */
export function findRegion(lines) {
  const start = lines.findIndex((line) => OPEN_MARKER.test(line))
  if (start !== -1) {
    let end = -1
    for (let index = start; index < lines.length; index += 1) {
      if (CLOSE_MARKER.test(lines[index])) end = index
    }
    if (end !== -1) return { start, end, mode: 'markers' }
    // An opening marker without its close: fall through to the section scan.
  }

  const assets = lines.findIndex((line) => isAssetSection(line))
  if (assets === -1) return { start: -1, end: -1, mode: 'append' }
  let end = assets
  for (let index = assets + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s*\[/.test(line) && !isAssetSection(line) && !isUiSection(line)) break
    end = index
  }
  while (end > assets && lines[end].trim() === '') end -= 1
  return { start: assets, end, mode: 'sections' }
}

/**
 * Replace the designer-owned region of one manifest.
 * @param manifestPath - path to `rustomp.toml`.
 * @param uiToml - exported `ui.toml` text.
 * @returns what changed, for the caller's log.
 */
export async function mergePanelToml(manifestPath, uiToml) {
  const problem = validateUiToml(uiToml)
  if (problem !== null) throw new Error(problem)

  const current = await readFile(manifestPath, 'utf8')
  const lines = current.split('\n')
  const region = findRegion(lines)
  const block = String(uiToml).trimEnd().split('\n')

  let next
  if (region.start === -1) {
    next = `${current.trimEnd()}\n\n${block.join('\n')}\n`
  } else {
    const head = lines.slice(0, region.start)
    while (head.length > 0 && head[head.length - 1].trim() === '') head.pop()
    const tail = lines.slice(region.end + 1)
    while (tail.length > 0 && tail[0].trim() === '') tail.shift()
    next = [
      ...head,
      ...(head.length > 0 ? [''] : []),
      ...block,
      ...(tail.length > 0 ? ['', ...tail] : []),
    ].join('\n')
    if (!next.endsWith('\n')) next += '\n'
  }

  // The merge must never drop an unrelated top-level section.
  const sectionsOf = (text) => new Set(
    text.split('\n')
      .map((line) => /^\s*(\[[^\]]+\])\s*$/.exec(line)?.[1])
      .filter((name) => name !== undefined),
  )
  const before = sectionsOf(current)
  const after = sectionsOf(next)
  for (const name of before) {
    if (!after.has(name)) throw new Error(`合并会丢掉 ${name} 段，已中止（请检查 ${manifestPath} 的结构）`)
  }

  const { writeFile } = await import('node:fs/promises')
  await writeFile(manifestPath, next, 'utf8')
  return {
    manifestPath,
    mode: region.mode,
    replacedLines: region.start === -1 ? 0 : region.end - region.start + 1,
    addedLines: block.length,
  }
}
