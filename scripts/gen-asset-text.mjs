#!/usr/bin/env node
/**
 * Inline the vendored SVG sources into a JS map so the browser bundle needs no
 * extra HTTP route for artwork.
 *
 * The designer loads these with `fetch(a.file)`; a DSH client plugin runs inside
 * the page bundle, so the same texts have to travel with it. Output is
 * deterministic (assets sorted by id) and committed, which keeps `client.js`
 * reproducible without a bundler.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname
const VENDOR = join(ROOT, 'vendor/boxdesigner')
const { ASSETS } = await import(pathToFileURL(join(VENDOR, 'assets.gen.js')).href)

const entries = [...ASSETS].sort((left, right) => left.id.localeCompare(right.id))
const missing = []
const lines = []
for (const asset of entries) {
  const path = join(VENDOR, asset.file)
  let svg
  try {
    svg = readFileSync(path, 'utf8')
  } catch {
    missing.push(relative(ROOT, path))
    continue
  }
  lines.push(`  ${JSON.stringify(asset.id)}: ${JSON.stringify(svg)},`)
}
if (missing.length > 0) {
  console.error(`缺少 ${missing.length} 个素材文件：\n  ${missing.join('\n  ')}`)
  process.exit(1)
}

const header = [
  '// 由 scripts/gen-asset-text.mjs 生成，请勿手改。',
  '// 素材 SVG 文本（id → 原文），来源与 vendor/boxdesigner 同一次拷贝。',
  '',
]
const body = `export const ASSET_TEXT = {\n${lines.join('\n')}\n};\n\nexport const ASSET_IDS = Object.keys(ASSET_TEXT);\n`
writeFileSync(join(VENDOR, 'assets.text.js'), [...header, body].join('\n'))
console.log(`写入 vendor/boxdesigner/assets.text.js：${entries.length} 个素材，${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`)
