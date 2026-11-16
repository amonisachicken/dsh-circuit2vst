#!/usr/bin/env node
/**
 * Assemble the package's `./client` module.
 *
 * A DSH client plugin is one file loaded through `window.__ModuleLoader__`, and
 * this one needs the vendored designer logic plus the panel UI. Rather than add
 * a bundler dependency, each vendored module is wrapped in its own scope with an
 * explicit export list — the minimum a flat concatenation needs, since the
 * upstream files legitimately reuse local names such as `PT_TO_MM`. The result
 * is deterministic, committed, and syntax-checked here so a broken build never
 * reaches the page.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'client.js')

/** Vendored modules, in dependency order, each built into `__mod_<id>`. */
const MODULES = [
  { id: 'assets', file: 'vendor/boxdesigner/assets.gen.js' },
  { id: 'assetText', file: 'vendor/boxdesigner/assets.text.js' },
  { id: 'embed', file: 'vendor/boxdesigner/embed.js' },
  { id: 'model', file: 'vendor/boxdesigner/model.js' },
  { id: 'exporter', file: 'vendor/boxdesigner/exporter.js' },
]

/** Names the UI takes from each module, declared once so a missing one fails at check time. */
const REACHABLE = {
  assets: ['ASSETS', 'byId', 'byKind', 'SWITCH_PAIRS', 'FOOTSWITCHES'],
  assetText: ['ASSET_TEXT'],
  embed: ['placeAsset', 'flatten'],
  model: ['VERSION', 'PRESETS', 'LAYERS', 'newDoc', 'factory', 'load', 'save', 'validate',
    'move', 'resize', 'bbox', 'snap', 'duplicate', 'layerOf', 'layerState', 'ledRadius',
    'buttonRadius', 'unionBox', 'alignMoves', 'distributeMoves', 'paramChoices',
    'paramAllowed', 'mergedAssets', 'syncTogglePivot', 'toggleDy', 'assetInfo', 'importSvg'],
  exporter: ['KNOB_TRAVEL_DEG', 'num', 'panelSvg', 'uiToml', 'spritePlan', 'parseParams', 'elementBox'],
}

/** Import specifier stem → module id, so `./assets.gen.js` becomes `__mod_assets`. */
const ID_BY_STEM = new Map(
  MODULES.map((module) => [module.file.split('/').pop().replace(/\.js$/, ''), module.id]),
)

/** @param relative - path from the bundle root. @returns the file text. */
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')

/**
 * Collect the names a module exports.
 * @param code - module source.
 * @returns pairs of `{ exported, local }`.
 */
function exportedNames(code) {
  const names = []
  for (const match of code.matchAll(/^\s*export\s+(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.push({ exported: match[1], local: match[1] })
  }
  for (const match of code.matchAll(/^\s*export\s*\{([^}]*)\};?\s*$/gm)) {
    for (const piece of match[1].split(',')) {
      const trimmed = piece.trim()
      if (trimmed === '') continue
      const alias = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(trimmed)
      names.push(alias === null
        ? { exported: trimmed, local: trimmed }
        : { exported: alias[2], local: alias[1] })
    }
  }
  return names
}

/**
 * Rewrite one module into a scoped expression with an explicit return.
 * @param id - module id, namespacing its dependencies.
 * @param code - module source.
 * @returns the wrapped source.
 */
function wrapModule(id, code) {
  const lines = code.split('\n')
  const body = []
  let skippingImport = false
  for (const line of lines) {
    if (skippingImport) {
      if (/from\s+["'][^"']+["'];?\s*$/.test(line)) skippingImport = false
      continue
    }
    const single = /^\s*import\s*\{([^}]*)\}\s*from\s*["']\.\/([^"']+)\.js["'];?\s*$/.exec(line)
    if (single !== null) {
      const dep = ID_BY_STEM.get(single[2]) ?? single[2]
      const bindings = single[1].split(',').map((piece) => piece.trim()).filter(Boolean).map((piece) => {
        const alias = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(piece)
        return alias === null ? piece : `${alias[1]}: ${alias[2]}`
      })
      body.push(`  const { ${bindings.join(', ')} } = __mod_${dep};`)
      continue
    }
    if (/^\s*import\s/.test(line)) {
      if (!/from\s+["'][^"']+["'];?\s*$/.test(line)) skippingImport = true
      continue
    }
    if (/^\s*export\s*\{[^}]*\};?\s*$/.test(line)) continue
    body.push(line.replace(/^(\s*)export\s+(const|let|var|function|class|async)\b/, '$1$2'))
  }
  if (skippingImport) throw new Error(`${id}: an import never closed`)

  const exportsList = exportedNames(code)
    .map(({ exported, local }) => `${exported}: ${local}`)
    .join(', ')
  return `const __mod_${id} = (() => {\n${body.join('\n').trim()}\n  return { ${exportsList} }\n})()\n`
}

const parts = []
for (const module of MODULES) {
  parts.push(`// ===== ${module.file} =====\n${wrapModule(module.id, read(module.file))}`)
}

// One flat view for the UI: exactly the names it uses, so an upstream rename
// breaks the build here instead of at runtime in the browser.
const destructure = Object.entries(REACHABLE)
  .map(([id, names]) => `const { ${names.join(', ')} } = __mod_${id}`)
  .join('\n')
parts.push(`// ===== UI view of the vendored modules =====\n${destructure}\n`)

/**
 * Strip ESM syntax from a UI fragment. Fragments must not import anything; the
 * ported netlist module is written as ESM only so Node tests can import it.
 * @param code - source text.
 * @param file - path, for diagnostics.
 * @returns the fragment without `export` keywords.
 */
function stripUiFragment(code, file) {
  return code
    .split('\n')
    .map((line) => {
      if (/^\s*import\s/.test(line)) throw new Error(`${file}: UI 片段不应有 import`)
      return line.replace(/^(\s*)export\s+(const|let|var|function|class|async)\b/, '$1$2')
    })
    .join('\n')
}

/**
 * Fragments are concatenated into a single scope, so a top-level name declared in
 * two files silently overrides the earlier one (that is how the canvas once lost
 * its `hitTest` to the panel designer's). Refuse to build when that happens.
 * @param entries - `{file, source}` in bundle order.
 */
function assertNoDuplicateTopLevel(entries) {
  const declared = new Map()
  for (const { file, source } of entries) {
    for (const line of source.split('\n')) {
      const match = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/.exec(line)
      if (match === null) continue
      const name = match[1]
      if (declared.has(name)) {
        throw new Error(`顶层标识符重复：${name}（${declared.get(name)} 与 ${file}）`)
      }
      declared.set(name, file)
    }
  }
}

const UI_FILES = [
  'vendor/circuit/assets.gen.js',
  'src/client/circuit-netlist.js',
  'src/client/circuit-scope.js',
  'src/client/circuit-canvas.js',
  'src/client/panel-designer.js',
  'src/client/main.js',
]

assertNoDuplicateTopLevel(UI_FILES.map((file) => ({ file, source: read(file) })))
for (const relative of UI_FILES) {
  // The ported netlist module is written as ESM so Node tests can import it;
  // stripping here keeps one source for both the browser bundle and the tests.
  parts.push(`// ===== ${relative} =====\n${stripUiFragment(read(relative), relative).trim()}\n`)
}

const pkg = JSON.parse(read('package.json'))
const banner = `/**
 * ${pkg.name} — Client half (generated by scripts/build-client.mjs; do not edit).
 *
 * The vendored rustomp-box-designer modules come first, each in its own scope,
 * then the panel UI. Both halves of the designer share one \`uiToml()\`, so what
 * this panel exports is byte-identical to the upstream CLI for the same
 * \`.box.json\`.
 */
`
const generated = `${banner}window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    const React = require('react')
    const h = React.createElement

${parts.join('\n')}
    return pluginModule
  },
})
`
writeFileSync(OUT, generated)
execFileSync(process.execPath, ['--check', OUT], { stdio: 'inherit' })
console.log(`写入 client.js：${MODULES.length} 个 vendor 模块 + ${UI_FILES.length} 个 UI 片段，${(Buffer.byteLength(generated) / 1024).toFixed(1)} KB，语法检查通过`)
