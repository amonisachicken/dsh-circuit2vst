/**
 * Circuit2VST — Host half.
 *
 * Registers three things and owns nothing else:
 *   - a model tool (`circuit2vst`) so the agent can inspect and prepare the
 *     environment without the user clicking anything;
 *   - a same-origin JSON route the panel calls (`/plugin/circuit2vst/api`);
 *   - one service instance holding the cached environment/dependency state.
 *
 * Everything platform specific lives in the pinned packer repositories; this
 * file never names a platform's toolchain (that is their `doctor.sh` job).
 */
import { resolveConfig } from './src/host/config.js'
import { Circuit2VstService } from './src/host/service.js'
import { registerRoutes } from './src/host/routes.js'
import { registerTools } from './src/host/tool.js'

/** The tool registry is the only hard dependency; the web carrier is optional. */
export const inject = ['tools']

/**
 * Mount the Host half.
 * @param ctx - Cordis context of the plugin row.
 * @param config - row config from `cordis.patch.yml`.
 */
export function apply(ctx, config) {
  const settings = resolveConfig(config)
  const service = new Circuit2VstService(ctx, settings)

  ctx.effect(() => registerTools(ctx, service))
  ctx.effect(() => () => service.dispose())

  // The browser carrier is optional (a TUI composition has no webServer), so the
  // plugin must not declare it in `inject`. But looking it up optimistically at
  // apply time races the carrier's registration: when another bundle happened to
  // register later, the route silently disappeared and the panel hit the static
  // handler (404 on GET / 405 on POST). Fork on the service instead.
  ctx.inject(['webServer'], (child) => {
    child.effect(() => registerRoutes(child, service, child.webServer))
  })

  const logger = ctx.logger
  if (typeof logger?.info === 'function') {
    logger.info(`dsh-circuit2vst: 依赖目录 ${settings.depsDir}`)
  }
}
