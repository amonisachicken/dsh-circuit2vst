/**
 * The model-facing tool.
 *
 * Every compile-level action lives here, not in the panel: read state, prepare the
 * pinned dependencies, scaffold a project, import a circuit netlist, regenerate
 * the plugin code, and package it through the platform packer.
 *
 * The panel is a viewer plus the two canvas designers; it deliberately has no
 * import / generate / pack buttons, because those need a file path and a chat
 * turn can pass one explicitly.
 */
import { DESIGNER_SYMBOLS } from './config.js'

/**
 * Render a status payload as compact text the model can read.
 * @param state - the service state.
 * @returns model-facing text.
 */
function renderStatus(state) {
  const lines = []
  lines.push(`Circuit2VST ${state.version} · ${state.environment.platformLabel} ${state.environment.arch} · ${state.environment.osRelease}`)
  lines.push(`项目目录：${state.config.projectsDir}`)
  lines.push(`依赖目录：${state.config.depsDir}`)
  lines.push('')
  lines.push(`环境：${state.environment.canGenerate ? '可生成' : '不可生成'} · ${state.environment.canPack ? '可打包' : '不可打包'}`)
  for (const check of state.environment.checks) {
    const mark = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'
    lines.push(`  ${mark} ${check.label}：${check.detail}`)
    if (check.status !== 'ok' && check.hint !== '') lines.push(`      → ${check.hint}`)
  }
  lines.push('')
  const describe = (dep) => {
    if (dep === null) return '本平台没有打包器'
    if (!dep.present) return `未拉取（期望 ${dep.tag}，目录 ${dep.dir}）`
    return `${dep.installedTag ?? '无 tag'} / head ${dep.head ?? '?'}（期望 ${dep.tag}）`
  }
  lines.push(`框架 ${state.deps.framework.repo}：${describe(state.deps.framework)}`)
  lines.push(`打包器：${describe(state.deps.packer)}`)
  lines.push('')
  lines.push(`项目（${state.projects.length}）：`)
  if (state.projects.length === 0) lines.push('  （还没有项目）')
  for (const project of state.projects) {
    const bits = [project.name ?? project.slug]
    if (project.params > 0) bits.push(`${project.params} 个参数`)
    if (project.uiControls > 0) bits.push(`${project.uiControls} 个面板控件`)
    if (project.gui === true) bits.push('gui')
    lines.push(`  ${project.slug} · ${bits.join(' · ')} · ${project.dir}`)
  }
  if (state.blockers.length > 0) {
    lines.push('')
    lines.push('阻塞：')
    for (const blocker of state.blockers) lines.push(`  - ${blocker}`)
  }
  return lines.join('\n')
}

/** Render a `verify` result. */
function renderVerify(report) {
  if (report.skipped === true) {
    return `ngspice 对拍：跳过（${report.reason}）`
  }
  const lines = [report.ok === true ? 'ngspice 对拍：通过' : 'ngspice 对拍：未通过', `设计文件：${report.design}`]
  for (const check of report.checks) lines.push(`  ${check.level === 'error' ? '✗' : '!'} ${check.code}: ${check.msg}`)
  if (report.metrics?.outRms !== undefined) {
    lines.push(
      `  采样 ${report.metrics.samples} 点：IN 峰值 ${report.metrics.inPeak.toFixed(3)} V → OUT RMS ${report.metrics.outRms.toFixed(3)} V（峰值 ${report.metrics.outPeak.toFixed(3)} V，VCC ${report.metrics.vcc ?? 'n/a'}）`,
    )
  }
  return lines.join('\n')
}

/**
 * Render an `enableGui` result.
 * @param report - `{changed, alreadyEnabled, errors}`.
 * @returns model-facing text.
 */
function renderGui(report) {
  const lines = []
  if (report.alreadyEnabled) {
    lines.push('界面接线：已启用（无需改动）')
  } else {
    lines.push(`界面接线：改了 ${report.changed.length} 个文件`)
    for (const file of report.changed) lines.push(`  ✓ ${file}`)
  }
  if (report.errors.length > 0) {
    lines.push('')
    lines.push('需要留意：')
    for (const error of report.errors) lines.push(`  ! ${error}`)
  }
  lines.push('')
  lines.push('下一步：circuit2vst generate（rustomp-gen 会补出 panel.rs / bridge.rs / assets.rs），然后 pack。')
  return lines.join('\n')
}

/**
 * Render a prepare result.
 * @param result - steps plus the refreshed state.
 * @returns model-facing text.
 */
function renderPrepare(result) {
  const lines = []
  for (const step of result.steps) {
    const mark = step.status === 'done' ? '✓' : step.status === 'warn' ? '!' : '-'
    lines.push(`${mark} ${step.label}`)
    if (step.log) lines.push(step.log.split('\n').map(line => `    ${line}`).join('\n'))
  }
  lines.push('')
  lines.push(renderStatus(result.state))
  return lines.join('\n')
}

/**
 * Render one finished job.
 * @param job - the job view.
 * @param state - refreshed service state.
 * @returns model-facing text.
 */
function renderJob(job, state) {
  const lines = []
  lines.push(`${job.status === 'ok' ? '✓' : '✗'} ${job.label}`)
  if (job.artifacts.length > 0) {
    lines.push('产物：')
    for (const artifact of job.artifacts) lines.push(`  ${artifact}`)
  }
  if (job.error !== null) lines.push(`错误：${job.error}`)
  if (job.log !== '') {
    lines.push('日志（尾部）：')
    lines.push(job.log.split('\n').slice(-60).map(line => `  ${line}`).join('\n'))
  }
  lines.push('')
  lines.push(renderStatus(state))
  return lines.join('\n')
}

/**
 * Register the `circuit2vst` tool.
 * @param ctx - plugin context carrying the tool registry.
 * @param service - the shared service.
 * @returns the tool disposer.
 */
export function registerTools(ctx, service) {
  return ctx.tools.register({
    name: 'circuit2vst',
    description: 'Drive the local rustomp toolchain that turns a circuit design into VST3/AU/CLAP plugins: report the Host platform and prerequisites, clone the pinned framework and this platform\'s packer, scaffold a plugin project from the framework template, import a circuit netlist (.design.json / .cir) into generated Rust, regenerate the plugin code, and package it through the packer\'s contract-B `pack.sh`, returning the produced `ARTIFACT:` paths. Every compile-level operation is done here; the panel only shows projects and opens the designers.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'prepare', 'scaffold', 'import', 'generate', 'enableGui', 'verify', 'pack'],
          description: 'status reads state; prepare clones missing pinned dependencies; scaffold creates a project; import turns a .design.json / .cir into circuit/src/generated; generate rewrites the plugin code and checks for drift; enableGui wires the self-drawn panel (manifest flag, egui dependencies, plugin/src/editor.rs, module hook) — run it once per project that has a [ui] panel and no GUI yet; verify runs the ngspice parity gate (netlist lints + non-silent output); pack builds plugin artifacts — it runs the same parity gate first and refuses to build a silent circuit.',
        },
        name: {
          type: 'string',
          description: 'With scaffold: the plugin display name; the project directory is its slug.',
        },
        vendor: {
          type: 'string',
          description: 'With scaffold: the vendor name written into the manifest.',
        },
        project: {
          type: 'string',
          description: 'With import, generate or pack: project directory or slug under the projects directory.',
        },
        source: {
          type: 'string',
          description: 'With import: path to the circuit file (.design.json or .cir). A .design.json is imported with the designer symbols shipped by this plugin unless symbolsPath is given.',
        },
        symbolsPath: {
          type: 'string',
          description: 'With import: optional symbols.json to use instead of the bundled one.',
        },
        install: {
          type: 'boolean',
          description: 'With pack: also install the built plugins for this user (off by default).',
        },
        thirdParty: {
          type: 'boolean',
          description: 'With prepare on macOS only: also run the packer\'s fetch-third-party.sh (about 12 MB of clap-wrapper/CLAP/AudioUnitSDK sources).',
        },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object' },
      render: (args, value) => [{
        type: 'text',
        text: args.action === 'status'
          ? renderStatus(value)
          : args.action === 'prepare'
            ? renderPrepare(value)
            : args.action === 'enableGui'
              ? renderGui(value.gui)
              : args.action === 'verify'
                ? renderVerify(value.verify)
                : renderJob(value.job, value.state),
      }],
    },
    async execute(args) {
      if (args.action === 'status') return service.state({ force: true })
      if (args.action === 'prepare') return service.prepareDeps({ thirdParty: args.thirdParty === true })
      if (args.action === 'scaffold') {
        const started = service.scaffold({ name: args.name, vendor: args.vendor })
        const job = await service.awaitJob(started.id)
        return { job, state: await service.state({ force: true }) }
      }
      const projectDir = String(args.project ?? '').trim()
      if (projectDir === '') throw new Error('这个动作需要 project（项目目录或 slug）')
      const resolved = projectDir.startsWith('/') ? projectDir : `${service.settings.projectsDir}/${projectDir}`
      if (args.action === 'verify') {
        return { verify: await service.verifyCircuit(resolved), state: await service.state({ force: true }) }
      }
      if (args.action === 'enableGui') {
        const report = await service.enableGui(resolved)
        return { gui: report, state: await service.state({ force: true }) }
      }
      if (args.action === 'import') {
        const source = String(args.source ?? '').trim()
        if (source === '') throw new Error('import 需要 source（.design.json 或 .cir 的路径）')
        const symbolsPath = String(args.symbolsPath ?? '').trim()
          || (source.toLowerCase().endsWith('.design.json') ? DESIGNER_SYMBOLS : '')
        const started = service.importCircuit(resolved, { source, symbolsPath })
        const job = await service.awaitJob(started.id)
        return { job, state: await service.state({ force: true }) }
      }
      if (args.action === 'generate') {
        const started = service.generate(resolved)
        const job = await service.awaitJob(started.id)
        return { job, state: await service.state({ force: true }) }
      }
      if (args.action === 'pack') {
        const started = service.pack(resolved, { install: args.install === true })
        const job = await service.awaitJob(started.id)
        return { job, state: await service.state({ force: true }) }
      }
      throw new Error(`未知 action：${args.action}`)
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `Circuit2VST ${args.action}`,
      kind: args.action === 'status' ? 'read' : 'write',
    }),
  })
}
