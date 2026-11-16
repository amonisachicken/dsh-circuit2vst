/**
 * The one stateful object shared by the panel route and the model tool.
 *
 * It caches a probe for a few seconds (a probe runs `cargo --list`, which is not
 * free) and serialises dependency preparation so two clicks cannot start two
 * clones into the same directory.
 */
import { PLUGIN_VERSION, publicConfig } from './config.js'
import { probeEnvironment } from './doctor.js'
import { cloneRepo, fetchThirdParty, inspectRepo } from './deps.js'
import { listProjects } from './project.js'
import { effectiveProxy, readSettingsFile, saveSettingsFile, settingsFile } from './settings.js'
import {
  listCircuits,
  readCircuit,
  readDesign,
  writeAssets,
  writeCircuit,
  writeCircuitPreview,
  writeDesign,
  writeNetlist,
} from './projectfiles.js'
import { generatePlugin, importCircuit, scaffoldProject } from './framework.js'
import { runSimulation } from './sim.js'
import { checkParams, formatParamReport } from './params.js'
import { enableGui } from './gui.js'
import { verifyCircuit } from './verify.js'
import { mergePanelToml } from './merge.js'
import { runPack } from './pack.js'

/** How long a probe result stays fresh. */
const CACHE_MS = 15000

/**
 * Build the human-facing blocker list from a probe.
 * @param settings - resolved plugin settings.
 * @param environment - doctor result.
 * @param deps - inspected dependencies.
 * @returns blocker messages, most severe first.
 */
function blockersOf(settings, environment, deps) {
  const blockers = []
  if (settings.packer === null) {
    blockers.push(`本平台（${settings.platform}）没有打包器：可以生成代码，但不能出插件。新平台 = 一个实现契约 B 的 pack.sh，用 RUSTOMP_PACKER 指定。`)
  }
  if (!environment.canGenerate) {
    blockers.push(`还不能生成代码：缺少 ${environment.missingRequired.join('、')}`)
  } else if (!environment.canPack) {
    blockers.push(`能生成代码，但还不能打包：缺少 ${environment.missingRequired.join('、')}`)
  }
  if (!deps.framework.present) blockers.push(`框架未拉取：${deps.framework.dir}`)
  if (deps.packer !== null && !deps.packer.present) blockers.push(`打包器未拉取：${deps.packer.dir}`)
  return blockers
}

/** Host-side orchestration for Circuit2VST. */
export class Circuit2VstService {
  /**
   * @param ctx - plugin context, used for logging only.
   * @param settings - resolved plugin settings.
   */
  constructor(ctx, settings) {
    this.ctx = ctx
    this.settings = settings
    this.cache = null
    this.notes = []
    this.preparing = null
    /** Long actions run here so an HTTP request never blocks for a compile. */
    this.jobs = new Map()
  }

  /**
   * Start one long action.
   * @param kind - stable action name.
   * @param label - what the panel shows while it runs.
   * @param runner - async work returning a JSON result.
   * @returns the job view immediately.
   */
  startJob(kind, label, runner) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const job = { id, kind, label, status: 'running', startedAt: Date.now(), finishedAt: null, log: '', artifacts: [], error: null, result: null }
    this.jobs.set(id, job)
    while (this.jobs.size > 12) {
      const oldest = [...this.jobs.values()].filter(entry => entry.status !== 'running').sort((a, b) => a.startedAt - b.startedAt)[0]
      if (oldest === undefined) break
      this.jobs.delete(oldest.id)
    }
    void (async () => {
      try {
        const result = await runner()
        job.result = result ?? null
        if (Array.isArray(result?.artifacts)) job.artifacts = result.artifacts
        if (typeof result?.log === 'string') job.log = result.log
        job.status = 'ok'
      } catch (error) {
        job.error = error instanceof Error ? error.message : String(error)
        if (typeof error?.log === 'string') job.log = error.log
        if (Array.isArray(error?.artifacts)) job.artifacts = error.artifacts
        job.status = 'failed'
      } finally {
        job.finishedAt = Date.now()
        this.cache = null
      }
    })()
    return this.jobView(job.id)
  }

  /**
   * Project one job for the panel.
   * @param id - job id.
   * @returns the view, or null when the id is unknown.
   */
  jobView(id) {
    const job = this.jobs.get(id)
    if (job === undefined) return null
    return { ...job }
  }

  /**
   * Wait for one job to settle.
   * @param id - job id.
   * @param pollMs - poll interval.
   * @returns the final job view.
   */
  async awaitJob(id, pollMs = 1000) {
    const job = this.jobs.get(id)
    if (job === undefined) throw new Error(`没有这个任务：${id}`)
    while (job.status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
    return this.jobView(id)
  }

  /** @returns the newest jobs, newest first. */
  listJobs() {
    return [...this.jobs.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6).map(job => ({
      id: job.id, kind: job.kind, label: job.label, status: job.status,
      startedAt: job.startedAt, finishedAt: job.finishedAt, artifacts: job.artifacts, error: job.error,
    }))
  }

  /**
   * Create a project from the framework template.
   * @param options - `{ name, vendor }`.
   * @returns the new job view.
   */
  scaffold(options) {
    return this.startJob('scaffold', `新建项目 ${options.name ?? ''}`, () => scaffoldProject(this.settings, options))
  }

  /**
   * Import a circuit into one project.
   * @param projectDir - project root.
   * @param options - `{ source, symbolsPath }`.
   * @returns the new job view.
   */
  importCircuit(projectDir, options) {
    return this.startJob('import', '导入电路网表', async () => {
      const log = await importCircuit(this.settings, projectDir, options)
      const report = await checkParams(projectDir)
      return { log: `${log}\n\n${formatParamReport(report)}`, params: report }
    })
  }

  /**
   * Wire the self-drawn GUI (manifest flag, dependencies, editor.rs, module hook).
   * @param projectDir - project root.
   * @returns `{changed, alreadyEnabled, errors}`.
   */
  enableGui(projectDir) {
    return enableGui(projectDir)
  }

  /**
   * Parameter consistency between the manifest and the generated circuit.
   * @param projectDir - project root.
   * @returns `{ok, issues, params, circuit}`.
   */
  checkParams(projectDir) {
    return checkParams(projectDir)
  }

  /**
   * Regenerate the plugin code for one project.
   * @param projectDir - project root.
   * @returns the new job view.
   */
  generate(projectDir) {
    return this.startJob('generate', '生成插件代码', async () => {
      const log = await generatePlugin(this.settings, projectDir)
      const report = await checkParams(projectDir)
      return { log: `${log}\n\n${formatParamReport(report)}`, params: report }
    })
  }

  /**
   * Package one project through the platform packer.
   * @param projectDir - project root.
   * @param options - `{ variants, formats, arch, install }`.
   * @returns the new job view.
   */
  /**
   * ngspice parity gate: the design must produce a live signal before a build.
   * @param projectDir - project root.
   * @returns the verification report.
   */
  verifyCircuit(projectDir) {
    return verifyCircuit(projectDir)
  }

  async pack(projectDir, options) {
    // Built-in spec: never package a circuit that is silent in ngspice. A
    // missing ngspice is not fatal (Windows has none) but is recorded.
    const verification = await verifyCircuit(projectDir)
    if (verification.ok === false) {
      const lines = verification.checks
        .filter((check) => check.level === 'error')
        .map((check) => `  ✗ ${check.code}: ${check.msg}`)
      throw new Error(`构建前对拍未通过，已拒绝打包：\n${lines.join('\n')}`)
    }
    return this.startJob('pack', '打包插件', () => runPack(this.settings, projectDir, { ...options, verification }))
  }

  /**
   * Merge a panel designer export into one project's manifest.
   * @param projectDir - project root.
   * @param uiToml - exported `ui.toml` text.
   * @returns the new job view.
   */
  mergePanel(projectDir, uiToml) {
    return this.startJob('merge-panel', '合并 [ui] 到 rustomp.toml', async () => ({
      log: JSON.stringify(await mergePanelToml(`${projectDir}/rustomp.toml`, uiToml), null, 2),
    }))
  }

  /**
   * Keep a note the panel shows once.
   * @param text - the note.
   */
  notice(text) {
    this.notes.push({ at: Date.now(), text })
    if (this.notes.length > 20) this.notes.shift()
  }

  /**
   * Inspect the machine, the dependencies and the project directory.
   * @param options - `force` bypasses the probe cache.
   * @returns the panel/tool payload.
   */
  async state(options = {}) {
    const force = options.force === true
    if (!force && this.cache !== null && Date.now() - this.cache.at < CACHE_MS) return this.cache.value

    const [environment, framework, packer, projects] = await Promise.all([
      probeEnvironment(this.settings),
      inspectRepo({ ...this.settings.framework, label: this.settings.framework.label ?? 'rustomp 框架' }),
      this.settings.packer === null
        ? Promise.resolve(null)
        : inspectRepo({ ...this.settings.packer, label: this.settings.packer.label }),
      listProjects(this.settings),
    ])

    const deps = { framework, packer }
    const [proxy, fileSettings] = await Promise.all([
      effectiveProxy(this.settings),
      readSettingsFile(this.settings),
    ])
    const value = {
      version: PLUGIN_VERSION,
      at: Date.now(),
      config: publicConfig(this.settings),
      environment,
      deps,
      projects,
      network: {
        proxy,
        settingsFile: settingsFile(this.settings),
        warning: fileSettings.warning,
      },
      blockers: blockersOf(this.settings, environment, deps),
      jobs: this.listJobs(),
      notes: [...this.notes],
    }
    this.cache = { at: Date.now(), value }
    return value
  }

  /**
   * Clone whatever the current platform needs, once.
   * @param options - `thirdParty` also fetches the macOS packer's sources.
   * @returns one step result per dependency.
   */
  async prepareDeps(options = {}) {
    if (this.preparing !== null) return this.preparing
    const thirdParty = options.thirdParty === true
    this.preparing = this.#prepare(thirdParty).finally(() => { this.preparing = null })
    return this.preparing
  }

  /**
   * Implementation of {@link prepareDeps}.
   * @param thirdParty - whether to fetch the packer's third-party sources.
   * @returns step results.
   */
  async #prepare(thirdParty) {
    const steps = []
    const framework = { ...this.settings.framework, label: 'rustomp 框架' }

    let frameworkState = await inspectRepo(framework)
    if (!frameworkState.present) {
      const log = await cloneRepo(this.settings, framework)
      steps.push({ id: 'framework', label: `clone ${framework.repo}@${framework.tag}`, status: 'done', log })
      frameworkState = await inspectRepo(framework)
    } else {
      steps.push({
        id: 'framework',
        label: `${framework.repo} 已存在`,
        status: frameworkState.matchesPin ? 'done' : 'warn',
        log: `目录 ${framework.dir}\n当前 tag=${frameworkState.installedTag ?? '（非 git 或未打 tag）'} head=${frameworkState.head ?? '?'} 期望 tag=${framework.tag}`,
      })
    }

    if (this.settings.packer === null) {
      steps.push({ id: 'packer', label: '本平台没有打包器', status: 'skipped', log: `platform=${this.settings.platform}` })
    } else if (this.settings.packer.override === true) {
      steps.push({
        id: 'packer',
        label: '使用自定义打包器',
        status: 'skipped',
        log: `packerOverride=${this.settings.packer.script}\n（自定义打包器不会被本插件 clone 或升级）`,
      })
    } else {
      const packer = { ...this.settings.packer, label: this.settings.packer.label }
      let packerState = await inspectRepo(packer)
      if (!packerState.present) {
        const log = await cloneRepo(this.settings, packer)
        steps.push({ id: 'packer', label: `clone ${packer.repo}@${packer.tag}`, status: 'done', log })
        packerState = await inspectRepo(packer)
      } else {
        steps.push({
          id: 'packer',
          label: `${packer.repo} 已存在`,
          status: packerState.matchesPin ? 'done' : 'warn',
          log: `目录 ${packer.dir}\n当前 tag=${packerState.installedTag ?? '（非 git 或未打 tag）'} head=${packerState.head ?? '?'} 期望 tag=${packer.tag}`,
        })
      }

      if (thirdParty && this.settings.packer.needsThirdParty === true) {
        const log = await fetchThirdParty(packer, this.settings)
        steps.push({ id: 'third-party', label: 'fetch-third-party.sh', status: 'done', log })
      }
    }

    this.cache = null
    return { steps, state: await this.state({ force: true }) }
  }

  /**
   * Save machine-local settings (currently the network proxy).
   * @param patch - `{ proxy }`; an empty string clears it.
   * @returns the saved values plus refreshed state.
   */
  async saveSettings(patch) {
    const saved = await saveSettingsFile(this.settings, patch)
    this.cache = null
    this.notice(`设置已保存：${saved.path}`)
    return { saved, state: await this.state({ force: true }) }
  }

  /**
   * Read a project's design document.
   * @param projectDir - project root.
   * @returns design text (null when absent) plus the manifest text.
   */
  readDesign(projectDir) {
    return readDesign(projectDir)
  }

  /**
   * Read a project's circuit document, if it has one.
   * @param projectDir - project root.
   * @returns `{exists, file, text}`.
   */
  readCircuit(projectDir, file) {
    return readCircuit(projectDir, file)
  }

  /**
   * List the project's circuit layouts.
   * @param projectDir - project root.
   * @returns `[{file, name, mtime}]`.
   */
  listCircuits(projectDir) {
    return listCircuits(projectDir)
  }

  /**
   * Save a circuit document into `circuit/`.
   * @param projectDir - project root.
   * @param doc - `.design.json` document.
   * @param fileName - optional explicit file name (save-as).
   * @returns `{file, bytes}`.
   */
  saveCircuit(projectDir, doc, fileName) {
    return writeCircuit(projectDir, doc, fileName)
  }

  /**
   * Run one ngspice simulation on a netlist the canvas generated.
   * @param request - `{cir, ports, kind, params, probes}`.
   * @returns `{kind, traces, thd, cir, log}`.
   */
  simulate(request) {
    return runSimulation(request)
  }

  /**
   * Export the netlist into `circuit/netlist/`.
   * @param projectDir - project root.
   * @param doc - circuit document.
   * @param text - netlist text.
   * @returns `{file, bytes}`.
   */
  exportNetlist(projectDir, doc, text) {
    return writeNetlist(projectDir, doc, text)
  }

  /**
   * Save the canvas preview PNG next to the circuit document.
   * @param projectDir - project root.
   * @param doc - circuit document.
   * @param base64 - PNG data.
   * @returns `{file, bytes}`.
   */
  saveCircuitPreview(projectDir, doc, base64) {
    return writeCircuitPreview(projectDir, doc, base64)
  }

  /**
   * Save a project's design document.
   * @param projectDir - project root.
   * @param text - serialized `.box.json`.
   * @returns the written path.
   */
  saveDesign(projectDir, text) {
    return writeDesign(projectDir, text)
  }

  /**
   * Write rasterized artwork for a project.
   * @param projectDir - project root.
   * @param files - `[{ name, base64 }]`.
   * @returns the written paths.
   */
  saveAssets(projectDir, files) {
    return writeAssets(projectDir, files)
  }

  /** Drop cached state; owned processes are handled by the caller. */
  dispose() {
    this.cache = null
  }
}
