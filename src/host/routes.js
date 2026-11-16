/**
 * The panel's same-origin JSON route.
 *
 * A plugin cannot import Harness client packages, and a linked local bundle
 * cannot rely on a generated Remote namespace, so the panel talks to this
 * route with plain `fetch`. The route is owner-only: the browser sends the
 * Harness cookie, and a peer that is not the owner gets 403 before any work.
 */

import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

import { DESIGNER_SYMBOLS } from './config.js'

/** Route prefix owned by this plugin. */
export const ROUTE_PREFIX = '/plugin/circuit2vst'

/**
 * Write a JSON response.
 * @param res - server response.
 * @param status - HTTP status.
 * @param body - JSON-serialisable body.
 */
function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

/**
 * Read a request body as JSON with a size bound.
 *
 * Rasterized artwork travels as base64 inside this body: a 720×1344 panel plus
 * its control sprites is a few hundred kilobytes, so the bound is generous.
 * The route is owner-only and bound to the local listener.
 *
 * @param req - incoming request.
 * @param limit - byte bound.
 * @returns the parsed body, or an empty object.
 */
async function readJson(req, limit = 32 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  return text.trim() === '' ? {} : JSON.parse(text)
}

/**
 * Resolve a project reference from the panel.
 * @param service - the shared service.
 * @param value - absolute directory or project slug.
 * @returns an absolute project directory that holds a manifest.
 */
function resolveProject(service, value) {
  const raw = String(value ?? '').trim()
  if (raw === '') throw new Error('没有指定项目')
  const dir = isAbsolute(raw) ? raw : join(service.settings.projectsDir, raw)
  if (!existsSync(join(dir, 'rustomp.toml'))) throw new Error(`${dir} 里没有 rustomp.toml`)
  return dir
}

/**
 * Register the prefix route.
 * @param ctx - plugin context, for one warning log.
 * @param service - the shared service.
 * @param webServer - the browser HTTP carrier.
 * @returns the route disposer.
 */
export function registerRoutes(ctx, service, webServer) {
  return webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    auth: 'required',
    handler: async (req, res, peer) => {
      if (peer?.principal?.kind !== 'owner') {
        json(res, 403, { error: 'forbidden' })
        return
      }
      const url = new URL(req.url ?? '/', 'http://circuit2vst.invalid')
      const suffix = url.pathname.slice(ROUTE_PREFIX.length) || '/'

      try {
        if (suffix === '/' || suffix === '/api') {
          if (req.method === 'GET') {
            json(res, 200, { ok: true, state: await service.state({ force: url.searchParams.get('force') === '1' }) })
            return
          }
          if (req.method === 'POST') {
            const body = await readJson(req)
            const action = String(body.action ?? 'state')
            if (action === 'state') {
              json(res, 200, { ok: true, state: await service.state({ force: body.force === true }) })
              return
            }
            if (action === 'prepare') {
              const result = await service.prepareDeps({ thirdParty: body.thirdParty === true })
              json(res, 200, { ok: true, ...result })
              return
            }
            if (action === 'settings') {
              const result = await service.saveSettings({ proxy: body.proxy })
              json(res, 200, { ok: true, ...result })
              return
            }
            if (action === 'job') {
              const job = service.jobView(String(body.id ?? ''))
              if (job === null) {
                json(res, 404, { ok: false, error: '没有这个任务' })
                return
              }
              json(res, 200, { ok: true, job })
              return
            }
            if (action === 'scaffold') {
              json(res, 200, { ok: true, job: service.scaffold({ name: body.name, vendor: body.vendor }) })
              return
            }
            if (action === 'import') {
              const projectDir = resolveProject(service, body.project)
              // Default to the symbol manifest shipped with the plugin: a
              // `.design.json` import needs pin geometry, and that file is the
              // same one the canvas was built from.
              const symbolsPath = String(body.symbolsPath ?? '').trim() || DESIGNER_SYMBOLS
              json(res, 200, {
                ok: true,
                job: service.importCircuit(projectDir, { source: body.source, symbolsPath }),
              })
              return
            }
            if (action === 'generate') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, job: service.generate(projectDir) })
              return
            }
            if (action === 'pack') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, {
                ok: true,
                job: service.pack(projectDir, {
                  variants: body.variants,
                  formats: body.formats,
                  arch: body.arch,
                  install: body.install === true,
                }),
              })
              return
            }
            if (action === 'readDesign') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, design: await service.readDesign(projectDir) })
              return
            }
            if (action === 'writeDesign') {
              const projectDir = resolveProject(service, body.project)
              const path = await service.saveDesign(projectDir, String(body.text ?? ''))
              json(res, 200, { ok: true, path })
              return
            }
            if (action === 'simulate') {
              json(res, 200, { ok: true, result: await service.simulate(body) })
              return
            }
            if (action === 'readCircuit') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, circuit: await service.readCircuit(projectDir, body.file) })
              return
            }
            if (action === 'enableGui') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, ...(await service.enableGui(projectDir)) })
              return
            }
            if (action === 'paramCheck') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, params: await service.checkParams(projectDir) })
              return
            }
            if (action === 'listCircuits') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, layouts: await service.listCircuits(projectDir) })
              return
            }
            if (action === 'writeCircuit') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, ...(await service.saveCircuit(projectDir, body.doc, body.name)) })
              return
            }
            if (action === 'writeNetlist') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, ...(await service.exportNetlist(projectDir, body.doc, String(body.text ?? ''))) })
              return
            }
            if (action === 'writePreview') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, ...(await service.saveCircuitPreview(projectDir, body.doc, String(body.png ?? ''))) })
              return
            }
            if (action === 'writeAssets') {
              const projectDir = resolveProject(service, body.project)
              const written = await service.saveAssets(projectDir, Array.isArray(body.files) ? body.files : [])
              json(res, 200, { ok: true, written })
              return
            }
            if (action === 'mergePanel') {
              const projectDir = resolveProject(service, body.project)
              json(res, 200, { ok: true, job: service.mergePanel(projectDir, String(body.uiToml ?? '')) })
              return
            }
            json(res, 400, { ok: false, error: `未知 action: ${action}` })
            return
          }
          res.writeHead(405, { allow: 'GET, POST', 'cache-control': 'no-store' }).end()
          return
        }
        json(res, 404, { ok: false, error: `未知路径 ${url.pathname}` })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ctx.logger?.warn?.(`dsh-circuit2vst: ${req.method} ${url.pathname} 失败：${message}`)
        json(res, 500, { ok: false, error: message })
      }
    },
  })
}
