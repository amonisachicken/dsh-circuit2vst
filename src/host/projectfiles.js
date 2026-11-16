/**
 * Reading and writing the few files the panel designer owns.
 *
 * Everything is confined to the project directory: a design file lives at
 * `design/panel.box.json`, artwork under `assets/`, and nothing else is
 * writable through this route. Paths are validated after resolution, so a
 * `..` segment cannot escape the project.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

/**
 * Where the designer keeps its document inside a project.
 * @param projectDir - project root.
 * @returns absolute path of the design file.
 */
export function designPath(projectDir) {
  return join(projectDir, 'design', 'panel.box.json')
}

/**
 * Resolve a project-relative path, refusing anything outside the project.
 * @param projectDir - project root.
 * @param relative - project-relative path.
 * @returns the absolute path.
 */
function insideProject(projectDir, relative) {
  const root = resolve(projectDir)
  const target = resolve(root, relative)
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`路径不在项目里：${relative}`)
  }
  return target
}

/**
 * Read the design document plus the manifest the panel binds parameters from.
 * @param projectDir - project root.
 * @returns `{ exists, text, manifestText }`; `text` is null when absent.
 */
export async function readDesign(projectDir) {
  const design = designPath(projectDir)
  const exists = existsSync(design)
  const [text, manifestText] = await Promise.all([
    exists ? readFile(design, 'utf8') : Promise.resolve(null),
    readFile(join(projectDir, 'rustomp.toml'), 'utf8'),
  ])
  return { exists, text, manifestText }
}

/**
 * Write the design document, after checking it is a supported `.box.json`.
 * @param projectDir - project root.
 * @param text - serialized design document.
 * @returns the written path.
 */
export async function writeDesign(projectDir, text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`设计文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (parsed?.version !== 1) throw new Error(`不支持的 .box.json 版本：${parsed?.version}`)
  if (!Array.isArray(parsed.elements)) throw new Error('设计文件里没有 elements')
  const path = designPath(projectDir)
  await mkdir(join(projectDir, 'design'), { recursive: true })
  await writeFile(path, `${String(text).trimEnd()}\n`, 'utf8')
  return path
}

/**
 * Write rasterized artwork next to the project's other assets.
 * @param projectDir - project root.
 * @param files - `[{ name, base64 }]`, names are flat PNG file names.
 * @returns the written paths.
 */
export async function writeAssets(projectDir, files) {
  const dir = join(projectDir, 'assets')
  await mkdir(dir, { recursive: true })
  const written = []
  for (const file of files) {
    const name = String(file?.name ?? '')
    if (!/^[A-Za-z0-9._-]+\.png$/.test(name) || name.includes('..')) {
      throw new Error(`素材名不合法：${name}`)
    }
    const target = insideProject(projectDir, join('assets', name))
    await writeFile(target, Buffer.from(String(file.base64 ?? ''), 'base64'))
    written.push(target)
  }
  return written
}

/**
 * Directory holding a project's circuit documents.
 * @param projectDir - project root.
 * @returns absolute path.
 */
export function circuitDir(projectDir) {
  return join(projectDir, 'circuit')
}

/**
 * File-name slug for a circuit document, from its title.
 * @param name - document name.
 * @returns a safe slug.
 */
export function circuitSlug(name) {
  const text = String(name ?? '').trim().replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._]+|[._]+$/g, '')
  return text === '' ? 'circuit' : text.slice(0, 60)
}

/**
 * Every circuit layout in a project, newest first.
 * @param projectDir - project root.
 * @returns `[{file, name, mtime}]`; `file` is project-relative, `name` is the stem.
 */
export async function listCircuits(projectDir) {
  const dir = circuitDir(projectDir)
  if (!existsSync(dir)) return []
  const { readdir, stat } = await import('node:fs/promises')
  const names = (await readdir(dir)).filter((name) => name.endsWith('.design.json'))
  const stamped = await Promise.all(names.map(async (name) => ({
    file: `circuit/${name}`,
    name: name.slice(0, -'.design.json'.length),
    mtime: (await stat(join(dir, name))).mtimeMs,
  })))
  return stamped.sort((left, right) => right.mtime - left.mtime)
}

/**
 * Read the newest circuit document of a project, or one specific layout.
 * @param projectDir - project root.
 * @param file - optional project-relative file, or its stem.
 * @returns `{exists, file, text}`; `file` is project-relative.
 */
export async function readCircuit(projectDir, file) {
  const dir = circuitDir(projectDir)
  if (!existsSync(dir)) return { exists: false, file: null, text: null }
  const { readdir, stat } = await import('node:fs/promises')
  const wanted = String(file ?? '').trim()
  if (wanted !== '') {
    const name = wanted.endsWith('.design.json') ? wanted : `${wanted}.design.json`
    const target = insideProject(projectDir, join('circuit', name))
    if (!existsSync(target)) throw new Error(`没有这个布局：${name}`)
    return { exists: true, file: `circuit/${name}`, text: await readFile(target, 'utf8') }
  }
  const names = (await readdir(dir)).filter((name) => name.endsWith('.design.json'))
  if (names.length === 0) return { exists: false, file: null, text: null }
  const stamped = await Promise.all(names.map(async (name) => ({
    name,
    time: (await stat(join(dir, name))).mtimeMs,
  })))
  stamped.sort((left, right) => right.time - left.time)
  const chosen = stamped[0].name
  const text = await readFile(join(dir, chosen), 'utf8')
  return { exists: true, file: `circuit/${chosen}`, text }
}

/**
 * Write a circuit document as `circuit/<slug>.design.json`.
 * @param projectDir - project root.
 * @param doc - `.design.json` document.
 * @param fileName - optional explicit name (`另存布局`); defaults to `doc.name`.
 * @returns `{file, bytes}`; `file` is project-relative.
 */
export async function writeCircuit(projectDir, doc, fileName) {
  if (doc === null || typeof doc !== 'object') throw new Error('电路文档为空')
  if (doc.version !== 1) throw new Error(`不支持的 .design.json 版本：${doc.version}`)
  if (!Array.isArray(doc.parts) || !Array.isArray(doc.wires)) throw new Error('电路文档缺少 parts / wires')
  const dir = circuitDir(projectDir)
  await mkdir(dir, { recursive: true })
  const stem = String(fileName ?? '').trim()
  const name = `${circuitSlug(stem === '' ? doc.name : stem)}.design.json`
  const path = insideProject(projectDir, join('circuit', name))
  const text = `${JSON.stringify(doc, null, 2)}\n`
  await writeFile(path, text, 'utf8')
  return { file: `circuit/${name}`, bytes: Buffer.byteLength(text) }
}

/**
 * Write the generated netlist next to the circuit document.
 * @param projectDir - project root.
 * @param doc - circuit document (for the name).
 * @param text - netlist text.
 * @returns `{file, bytes}`.
 */
export async function writeNetlist(projectDir, doc, text) {
  const body = String(text ?? '')
  if (body.trim() === '') throw new Error('网表为空')
  const dir = join(circuitDir(projectDir), 'netlist')
  await mkdir(dir, { recursive: true })
  const name = `${circuitSlug(doc?.name)}.cir`
  const path = insideProject(projectDir, join('circuit', 'netlist', name))
  await writeFile(path, body, 'utf8')
  return { file: `circuit/netlist/${name}`, bytes: Buffer.byteLength(body) }
}

/**
 * Save the canvas preview as a PNG next to the circuit document.
 * @param projectDir - project root.
 * @param doc - circuit document (for the name).
 * @param base64 - PNG data, base64 encoded (no data: prefix).
 * @returns `{file, bytes}`.
 */
export async function writeCircuitPreview(projectDir, doc, base64) {
  const payload = String(base64 ?? '').replace(/^data:image\/png;base64,/, '')
  if (payload === '') throw new Error('预览图为空')
  const buffer = Buffer.from(payload, 'base64')
  if (buffer.length > 16 * 1024 * 1024) throw new Error('预览图太大（超过 16 MB）')
  const dir = circuitDir(projectDir)
  await mkdir(dir, { recursive: true })
  const name = `${circuitSlug(doc?.name)}.png`
  const path = insideProject(projectDir, join('circuit', name))
  await writeFile(path, buffer)
  return { file: `circuit/${name}`, bytes: buffer.length }
}
