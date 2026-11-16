#!/usr/bin/env node
/**
 * Inline the circuit designer's symbol art and examples into one JS module, so
 * the browser bundle needs no extra HTTP route.
 *
 * The `<text>` extraction mirrors the upstream `frontend/src/symbols.ts`
 * `extractTexts`: symbols carry labels ("C"/"B"/"E", "V+", "In"), and rotating a
 * symbol would rotate those labels with it. The renderer therefore draws them
 * separately, always upright, using the coordinates and styles collected here.
 *
 * Output is deterministic and committed.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const VENDOR = join(ROOT, 'vendor/circuit')
const manifest = JSON.parse(readFileSync(join(VENDOR, 'symbols.json'), 'utf8'))

const TEXT_RE = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
const ATTR_RE = /([\w:-]+)="([^"]*)"/g

/**
 * Pull `<text>` nodes out of a symbol's inner SVG, merging ancestor `<g>` styles
 * and accumulating their `translate` offsets (upstream behaviour).
 * @param inner - SVG content between the outer tags.
 * @returns `{inner, texts}`.
 */
function extractTexts(inner) {
  const texts = []
  const stack = []
  const accumulated = () => {
    let tx = 0
    let ty = 0
    for (const layer of stack) { tx += layer.tx; ty += layer.ty }
    return { tx, ty }
  }

  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g
  let match
  while ((match = tagRe.exec(inner)) !== null) {
    const closing = match[1] === '/'
    const tag = match[2]
    const rawAttrs = match[3] ?? ''
    if (tag === 'g') {
      if (closing) stack.pop()
      else {
        const attrs = Object.fromEntries([...rawAttrs.matchAll(ATTR_RE)].map((item) => [item[1], item[2]]))
        const translate = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(attrs.transform ?? '')
        stack.push({ attrs, tx: translate ? Number(translate[1]) : 0, ty: translate ? Number(translate[2]) : 0 })
      }
      continue
    }
    if (tag !== 'text' || closing) continue
    const own = Object.fromEntries([...rawAttrs.matchAll(ATTR_RE)].map((item) => [item[1], item[2]]))
    const merged = {}
    for (const layer of stack) Object.assign(merged, layer.attrs)
    Object.assign(merged, own)
    const { tx, ty } = accumulated()
    const content = /<text\b[^>]*>([\s\S]*?)<\/text>/.exec(inner.slice(match.index))?.[1]?.trim() ?? ''
    texts.push({
      x: Number(merged.x ?? 0) + tx,
      y: Number(merged.y ?? 0) + ty,
      size: Number(merged['font-size'] ?? 2.4),
      anchor: merged['text-anchor'] ?? 'start',
      fill: merged.fill ?? '#0f172a',
      family: merged['font-family'] ?? 'Consolas, monospace',
      content,
    })
  }
  return { inner: inner.replace(TEXT_RE, ''), texts }
}

const art = {}
for (const [key, symbol] of Object.entries(manifest.symbols)) {
  const svg = readFileSync(join(VENDOR, symbol.file), 'utf8')
  const viewBox = /viewBox="([^"]+)"/.exec(svg)
  const start = svg.indexOf('>', svg.search(/<svg\b/)) + 1
  const end = svg.lastIndexOf('</svg>')
  const raw = svg.slice(start, end)
  const { inner, texts } = extractTexts(raw)
  art[key] = {
    viewBox: viewBox === null ? `0 0 ${symbol.canvas.w} ${symbol.canvas.h}` : viewBox[1].trim(),
    inner: inner.trim(),
    texts,
  }
}

const examples = {}
const exampleDir = join(VENDOR, 'examples')
for (const file of readdirSync(exampleDir).filter((name) => name.endsWith('.design.json')).sort()) {
  examples[basename(file, '.design.json')] = JSON.parse(readFileSync(join(exampleDir, file), 'utf8'))
}

const header = `// 由 scripts/gen-circuit-assets.mjs 生成，请勿手改。
// 来源：vendor/circuit（rustomp-circuit-designer @ f4eaa45，GPL-3.0-or-later）。
`
const body = [
  '',
  `export const CIRCUIT_SYMBOLS = ${JSON.stringify(manifest, null, 2)}`,
  '',
  `export const CIRCUIT_ART = ${JSON.stringify(art, null, 2)}`,
  '',
  `export const CIRCUIT_EXAMPLES = ${JSON.stringify(examples, null, 2)}`,
  '',
].join('\n')

const target = join(VENDOR, 'assets.gen.js')
writeFileSync(target, header + body)
const kib = (Buffer.byteLength(body) / 1024).toFixed(1)
console.log(`写入 vendor/circuit/assets.gen.js：${Object.keys(art).length} 个符号、${Object.keys(examples).length} 个示例，${kib} KB`)
