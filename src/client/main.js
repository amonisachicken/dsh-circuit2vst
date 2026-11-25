/**
 * Circuit2VST — Client half.
 *
 * Built by `scripts/build-client.mjs` into the package's `./client` module: the
 * vendored panel-designer logic first, then this file, which owns the panel UI
 * and the slot registrations. Nothing here imports a Harness client package, so
 * a Harness upgrade cannot blank it; the only external is React from the
 * browser module table.
 *
 * `React` and `h` are provided by the generated wrapper around this file.
 */


    const PANEL_ID = 'circuit2vst'
    const NS = 'circuit2vst'
    const ENDPOINT = '/plugin/circuit2vst/api'

    const EN = {
      'panel.label': 'Circuit2VST',
      'panel.title': 'Circuit2VST',
      'panel.subtitle': 'Circuit → DSP → multi-platform plugin',
      'action.refresh': 'Re-check',
      'action.prepare': 'Prepare dependencies (clone)',
      'action.thirdParty': 'Fetch third-party sources',
      'action.busy': 'Working…',
      'section.blockers': 'Blockers',
      'section.env': 'Environment',
      'section.deps': 'Pinned dependencies',
      'section.projects': 'Projects',
      'section.notes': 'Notes',
      'section.network': 'Network',
      'network.proxy': 'Proxy for git clone',
      'network.proxyPlaceholder': 'http://127.0.0.1:7890',
      'network.save': 'Save',
      'network.none': 'not set (falls back to HTTPS_PROXY of the Harness process)',
      'network.file': 'settings file',
      'env.readyGenerate': 'can generate code',
      'env.readyPack': 'can package',
      'env.notReady': 'not ready',
      'deps.framework': 'rustomp framework',
      'deps.packer': 'Platform packer',
      'deps.present': 'present',
      'deps.missing': 'not fetched',
      'deps.pinMismatch': 'tag differs from the pin',
      'deps.none': 'this platform has no packer',
      'deps.formats': 'formats',
      'projects.empty': 'No project yet. Once the dependencies are ready, the next step is creating one and importing a netlist from the circuit designer.',
      'projects.params': 'params',
      'projects.controls': 'panel controls',
      'projects.gui': 'has editor',
      'state.loading': 'Reading…',
      'state.failed': 'Read failed',
      'footer.dir': 'Projects',
      'punct.colon': ': ',
      'punct.paren': { open: ' (', close: ')' },
      'projects.new': 'New project',
      'projects.name': 'Name',
      'projects.vendor': 'Vendor',
      'projects.create': 'Create',
      'projects.source': 'Circuit file (.design.json / .cir)',
      'projects.symbols': 'Designer symbols.json (optional)',
      'projects.import': 'Import netlist',
      'projects.generate': 'Generate code',
      'projects.pack': 'Package',
      'projects.install': 'Install on this machine',
      'projects.job.running': 'Running…',
      'projects.job.ok': 'Done',
      'projects.job.failed': 'Failed',
      'projects.artifacts': 'Artifacts',
      'projects.log': 'Log',
      'projects.selected': 'Selected',
      'projects.busyHint': 'Compiling can take a few minutes.',
      'projects.selectFirst': 'Create or select a project first.',
      'projects.selectFirst.title': 'Create a project before opening a designer',
      'designer.needsProject': 'No project selected',
      'projects.design': 'design',
      'projects.openPanel': 'Panel designer',
      'projects.openCircuit': 'Circuit designer',
      'projects.openPanel.title': 'Open in the panel designer',
      'projects.openCircuit.title': 'Open in the circuit designer',
      'circuit.tab': 'Circuit designer',
      'circuit.stage': 'Press H for shortcut help',
      'circuit.loading': 'Loading…',
      'circuit.fit': 'Fit view',
      'circuit.netlist': 'Netlist',
      'circuit.hint': 'Wheel to zoom · drag to pan · click to select · double-click a component for properties',
      'circuit.props': 'Properties',
      'circuit.props.hint': 'Click a component to inspect it; wires only highlight.',
      'circuit.wire': 'Wire',
      'circuit.field.alias': 'Alias',
      'circuit.field.model': 'Model',
      'circuit.field.ratio': 'Turns ratio',
      'circuit.field.k': 'Coupling k',
      'circuit.field.tapP': 'Primary tap %',
      'circuit.field.tapS': 'Secondary tap %',
      'circuit.field.model.none': 'Select a model…',
      'circuit.field.value': 'Value',
      'circuit.field.unit': 'Unit',
      'circuit.field.rot': 'Rotation',
      'circuit.lint.ok': 'No problems found.',
      'circuit.palette': 'Symbol library (click one to place)',
      'circuit.help': 'Keyboard',
      'circuit.field.ref': 'Reference',
      'circuit.key.esc': 'back to view (a held part returns home first)',
      'circuit.key.place': 'place resistor / capacitor / ground (click to drop, stays)',
      'circuit.key.wire': 'draw wire (click start, click end, esc)',
      'circuit.key.delete': 'delete: click a part, or a wire segment',
      'circuit.key.move': 'move: click a part, click to drop, esc restores',
      'circuit.key.copy': 'copy: click a part to duplicate it',
      'circuit.key.palette': 'symbol library',
      'circuit.key.rotmirror': 'rotate / mirror the part in hand',
      'circuit.key.undo': 'undo / redo',
      'circuit.key.help': 'this panel',
      'circuit.example': 'Load example…',
      'circuit.save': 'Save',
      'circuit.saveLayout': 'Save layout',
      'circuit.saveAs': 'Save as…',
      'circuit.saveAs.title': 'Save layout as',
      'circuit.saveAs.placeholder': 'New file name',
      'circuit.saveAs.confirm': 'Save',
      'circuit.saveAs.needName': 'Give the new layout a name',
      'circuit.cancel': 'Cancel',
      'circuit.template': 'template',
      'circuit.dirty': 'edited',
      'circuit.loadLayout.title': 'Open a layout from this project',
      'circuit.params': 'Parameter consistency',
      'circuit.params.ok': 'params OK',
      'circuit.params.issues': 'param issues',
      'circuit.loadLayout.empty': 'Load layout…',
      'circuit.saving': 'Working…',
      'circuit.exportNetlist': 'Export netlist',
      'circuit.preview': 'Preview PNG',
      'circuit.generate': 'Generate code',
      'circuit.generating': 'Generating…',
      'circuit.generate.blocked': 'Fix the errors first',
      'circuit.simulate': 'Simulate',
      'sim.title': 'Simulation',
      'sim.analysis': 'Analysis',
      'sim.run': 'Run',
      'sim.running': 'Running…',
      'sim.step': 'Step',
      'sim.start': 'Start',
      'sim.duration': 'Duration',
      'sim.stimulus': 'Stimulus (set on the IN symbol)',
      'sim.hint': 'Pick an analysis and press Run; the scope shows v(in) / v(out) and any test point.',
      'sim.fft': 'Spectrum (FFT)',
      'sim.log': 'Log',
      'projects.jobs': 'Recent jobs',
      'projects.artifactMissing': 'artifact missing',
    }
    const ZH = {
      'panel.label': 'Circuit2VST',
      'panel.title': 'Circuit2VST',
      'panel.subtitle': '电路 → DSP → 多平台插件',
      'action.refresh': '重新体检',
      'action.prepare': '准备依赖（clone）',
      'action.thirdParty': '拉取第三方源码',
      'action.busy': '进行中…',
      'section.blockers': '阻塞',
      'section.env': '环境体检',
      'section.deps': '生态依赖',
      'section.projects': '项目',
      'section.notes': '提示',
      'section.network': '网络',
      'network.proxy': 'git clone 用的代理',
      'network.proxyPlaceholder': 'http://127.0.0.1:7890',
      'network.save': '保存',
      'network.none': '未设置（沿用 Harness 进程的 HTTPS_PROXY）',
      'network.file': '设置文件',
      'env.readyGenerate': '可生成代码',
      'env.readyPack': '可打包',
      'env.notReady': '未就绪',
      'deps.framework': 'rustomp 框架',
      'deps.packer': '平台打包器',
      'deps.present': '已就绪',
      'deps.missing': '未拉取',
      'deps.pinMismatch': 'tag 与钉住的版本不一致',
      'deps.none': '本平台没有打包器',
      'deps.formats': '可用格式',
      'projects.empty': '还没有项目。依赖准备好后，下一步是新建项目并从电路设计器导入网表。',
      'projects.params': '个参数',
      'projects.controls': '个面板控件',
      'projects.gui': '有界面',
      'state.loading': '正在读取…',
      'state.failed': '读取失败',
      'footer.dir': '项目目录',
      'punct.colon': '：',
      'punct.paren': { open: '（', close: '）' },
      'projects.new': '新建项目',
      'projects.name': '插件名',
      'projects.vendor': '厂商',
      'projects.create': '创建',
      'projects.source': '电路文件（.design.json / .cir）',
      'projects.symbols': '设计器 symbols.json（可选）',
      'projects.import': '导入网表',
      'projects.generate': '生成代码',
      'projects.pack': '打包',
      'projects.install': '安装到本机',
      'projects.job.running': '执行中…',
      'projects.job.ok': '完成',
      'projects.job.failed': '失败',
      'projects.artifacts': '产物',
      'projects.log': '日志',
      'projects.selected': '已选',
      'projects.busyHint': '首次编译可能要几分钟。',
      'projects.selectFirst': '先创建或选择一个项目。',
      'projects.selectFirst.title': '先创建项目，才能打开设计器',
      'designer.needsProject': '还没有选中项目',
      'projects.design': '有设计',
      'projects.openPanel': '面板设计器',
      'projects.openCircuit': '电路设计器',
      'projects.openPanel.title': '在面板设计器中打开',
      'projects.openCircuit.title': '在电路设计器中打开',
      'circuit.tab': '电路设计器',
      'circuit.stage': '按 H 查看快捷键帮助',
      'circuit.loading': '加载中…',
      'circuit.fit': '适配视图',
      'circuit.netlist': '网表',
      'circuit.hint': '滚轮缩放 · 拖动平移 · 单击选中 · 双击元件看属性',
      'circuit.props': '属性',
      'circuit.props.hint': '点画布上的元件看属性；导线只做高亮。',
      'circuit.wire': '导线',
      'circuit.field.alias': '别名',
      'circuit.field.model': '型号',
      'circuit.field.ratio': '匝比',
      'circuit.field.k': '耦合 k',
      'circuit.field.tapP': '初级抽头 %',
      'circuit.field.tapS': '次级抽头 %',
      'circuit.field.model.none': '选择型号…',
      'circuit.field.value': '数值',
      'circuit.field.unit': '单位',
      'circuit.field.rot': '旋转',
      'circuit.lint.ok': '没有发现问题。',
      'circuit.palette': '元件库（点一个进入放置模式）',
      'circuit.help': '快捷键',
      'circuit.field.ref': '参考编号',
      'circuit.key.esc': '回查看模式（手持元件时先放回原位）',
      'circuit.key.place': '放置电阻 / 电容 / 接地（点击落点，可连续）',
      'circuit.key.wire': '画导线（点起点、点终点，esc 退出）',
      'circuit.key.delete': '删除：点元件删元件，点导线只删该段',
      'circuit.key.move': '移动：点元件拿起，点画布放下，esc 放回',
      'circuit.key.copy': '复制：点一个元件即复制它',
      'circuit.key.palette': '元件库',
      'circuit.key.rotmirror': '旋转 / 镜像手里的元件',
      'circuit.key.undo': '撤销 / 重做',
      'circuit.key.help': '这个面板',
      'circuit.example': '载入示例…',
      'circuit.save': '保存',
      'circuit.saveLayout': '保存布局',
      'circuit.saveAs': '另存布局',
      'circuit.saveAs.title': '另存为',
      'circuit.saveAs.placeholder': '新的文件名',
      'circuit.saveAs.confirm': '保存',
      'circuit.saveAs.needName': '给新布局起个名字',
      'circuit.cancel': '取消',
      'circuit.template': '模板',
      'circuit.dirty': '已修改',
      'circuit.loadLayout.title': '打开本工程里的另一个布局',
      'circuit.params': '参数一致性',
      'circuit.params.ok': '参数一致',
      'circuit.params.issues': '参数问题',
      'circuit.loadLayout.empty': '载入布局…',
      'circuit.saving': '处理中…',
      'circuit.exportNetlist': '导出网表',
      'circuit.preview': '预览 PNG',
      'circuit.generate': '生成代码',
      'circuit.generating': '生成中…',
      'circuit.generate.blocked': '先修好 error',
      'circuit.simulate': '仿真',
      'sim.title': '仿真',
      'sim.analysis': '分析',
      'sim.run': '运行',
      'sim.running': '运行中…',
      'sim.step': '步长',
      'sim.start': '起始',
      'sim.duration': '持续',
      'sim.stimulus': 'IN 兼作波形发生器（仅设计器仿真）',
      'sim.amp': '幅值',
      'sim.freq': '频率',
      'sim.scope': '示波器',
      'sim.generatorHint': '发生器，仅用于设计器内部仿真',
      'sim.instrumentHint': '双击 OUT 或测试点，打开它的示波器',
      'sim.hint': '选分析类型后点「运行」；示波器会画 v(in) / v(out) 与测试点。',
      'sim.fft': '频谱 FFT',
      'sim.log': '日志',
      'projects.jobs': '最近任务',
      'projects.artifactMissing': '产物已不在磁盘上',
    }

    // 面板设计器的文案与主面板共用一份字典（见 src/client/panel-designer.js）。
    Object.assign(EN, DESIGNER_TEXT.en)
    Object.assign(ZH, DESIGNER_TEXT.zh)

    /** Active DSH locale id, read from the locale service in `apply`. */
    let activeLocale = ''

    let translate = (key) => (prefersChinese() ? (ZH[key] ?? EN[key]) : (EN[key] ?? ZH[key])) ?? key

    function prefersChinese() {
      const tag = (activeLocale || document.documentElement.lang || navigator.language || 'en').toLowerCase()
      return tag.startsWith('zh')
    }

    function t(key) {
      return translate(key)
    }

    const S = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        maxWidth: '980px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--dsw-alias-label-primary)',
        overflowY: 'auto',
        height: '100%',
      },
      header: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' },
      title: { fontSize: '18px', fontWeight: 600, margin: 0 },
      subtitle: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
      spacer: { flex: 1 },
      badge: {
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '999px',
        border: '1px solid var(--dsw-alias-border-l1)',
        color: 'var(--dsw-alias-label-secondary)',
      },
      button: {
        font: 'inherit',
        fontSize: '12px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
      },
      buttonPrimary: {
        font: 'inherit',
        fontSize: '12px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-base)',
        cursor: 'pointer',
      },
      buttonDisabled: { opacity: 0.5, cursor: 'default' },
      section: { display: 'flex', flexDirection: 'column', gap: '8px' },
      sectionTitle: {
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--dsw-alias-label-secondary)',
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
      row: { display: 'flex', gap: '10px', alignItems: 'baseline', fontSize: '13px' },
      input: {
        font: 'inherit',
        fontSize: '12px',
        padding: '5px 8px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        minWidth: '260px',
        flex: 1,
      },
      label: { minWidth: '170px', flexShrink: 0 },
      detail: { color: 'var(--dsw-alias-label-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', wordBreak: 'break-all' },
      hint: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', marginLeft: '20px' },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' },
      dot: { width: '8px', height: '8px', borderRadius: '999px', flexShrink: 0, transform: 'translateY(-1px)' },
      pre: {
        margin: 0,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '11px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: 'var(--dsw-alias-label-secondary)',
        maxHeight: '260px',
        overflowY: 'auto',
      },
      buttonSmall: {
        font: 'inherit',
        fontSize: '12px',
        padding: '4px 10px',
        borderRadius: '7px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
      },
      projectRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 8px',
        borderRadius: '8px',
        cursor: 'pointer',
      },
      projectRowActive: { background: 'var(--dsw-alias-bg-layer-2)' },
      rowAction: {
        font: 'inherit',
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '6px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      error: {
        border: '1px solid var(--dsw-alias-state-error-primary)',
        borderRadius: '10px',
        padding: '10px 12px',
        fontSize: '12px',
        color: 'var(--dsw-alias-state-error-primary)',
      },
      blocker: { fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)' },
    }

    function dotColor(status) {
      if (status === 'ok') return 'var(--dsw-alias-state-success-primary)'
      if (status === 'warn') return 'var(--dsw-alias-state-warn-primary)'
      return 'var(--dsw-alias-state-error-primary)'
    }

    async function callApi(body, signal) {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      const text = await response.text()
      let payload
      try {
        payload = text === '' ? {} : JSON.parse(text)
      } catch {
        throw new Error(`返回的不是 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`)
      }
      if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `HTTP ${response.status}`)
      return payload
    }

    function Dot({ status }) {
      return h('span', { style: { ...S.dot, background: dotColor(status) } })
    }

    function CheckRow({ check }) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        h('div', { style: S.row },
          h(Dot, { status: check.status }),
          h('span', { style: S.label }, check.label),
          h('span', { style: S.detail }, check.detail),
        ),
        check.status !== 'ok' && check.hint !== '' ? h('div', { style: S.hint }, `→ ${check.hint}`) : null,
      )
    }

    function DepRow({ label, dep }) {
      if (dep === null) {
        return h('div', { style: S.row }, h(Dot, { status: 'warn' }), h('span', { style: S.label }, label), h('span', { style: S.detail }, t('deps.none')))
      }
      const status = !dep.present ? 'missing' : dep.matchesPin ? 'ok' : 'warn'
      const detail = !dep.present
        ? `${t('deps.missing')} · 期望 ${dep.tag}`
        : `${dep.installedTag ?? '?'} ${dep.matchesPin ? '' : `（${t('deps.pinMismatch')}：${dep.tag}）`}`
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        h('div', { style: S.row },
          h(Dot, { status }),
          h('span', { style: S.label }, `${label} @ ${dep.tag}`),
          h('span', { style: S.detail }, detail),
        ),
        h('div', { style: S.mono }, dep.dir),
      )
    }

    function ProjectRow({ project }) {
      const bits = []
      if (typeof project.params === 'number' && project.params > 0) bits.push(`${project.params} ${t('projects.params')}`)
      if (typeof project.uiControls === 'number' && project.uiControls > 0) bits.push(`${project.uiControls} ${t('projects.controls')}`)
      if (project.gui === true) bits.push(t('projects.gui'))
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        h('div', { style: S.row },
          h('span', { style: { fontWeight: 500 } }, project.name ?? project.slug),
          h('span', { style: S.detail }, bits.join(' · ')),
        ),
        h('div', { style: S.mono }, project.dir),
      )
    }

    /**
     * Shown when a designer is reached without a project (defensive: the tab is
     * disabled, but a project can also disappear while the designer is open).
     */
    function EmptyDesigner({ t, setMode }) {
      return h('div', {
        style: {
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', padding: '48px 16px', textAlign: 'center',
          border: '1px dashed var(--dsw-alias-border-l2)', borderRadius: '12px',
          color: 'var(--dsw-alias-label-secondary)',
        },
      },
        h('div', { style: { fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('designer.needsProject')),
        h('div', { style: { fontSize: '12px' } }, t('projects.selectFirst')),
        h('button', { type: 'button', style: S.buttonPrimary, onClick: () => setMode('workflow') }, t('designer.workflow')),
      )
    }

    /** localStorage key holding the last focused project directory. */
    const SELECTED_PROJECT_KEY = 'circuit2vst.selectedProject'

    function Panel() {
      const [state, setState] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(null)
      const [log, setLog] = React.useState(null)
      const [proxyDraft, setProxyDraft] = React.useState('')
      // The last focused project is a UI preference: remember it in localStorage so
      // reopening the panel lands where the user left off instead of always on the
      // first project that happens to have a design.
      const [selected, setSelected] = React.useState(() => {
        try {
          return window.localStorage.getItem(SELECTED_PROJECT_KEY)
        } catch {
          return null
        }
      })
      const [newName, setNewName] = React.useState('')
      const [newVendor, setNewVendor] = React.useState('')
      const [job, setJob] = React.useState(null)
      const [mode, setMode] = React.useState('workflow')
      const [toast, setToast] = React.useState(null)

      const load = React.useCallback(async (force, signal) => {
        try {
          const payload = await callApi({ action: 'state', force: force === true }, signal)
          setState(payload.state)
          setProxyDraft(payload.state.network?.proxy ?? '')
          setError(null)
        } catch (failure) {
          if (failure instanceof DOMException && failure.name === 'AbortError') return
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }, [])

      React.useEffect(() => {
        const controller = new AbortController()
        void load(false, controller.signal)
        return () => { controller.abort() }
      }, [load])

      const prepare = React.useCallback(async (thirdParty) => {
        setBusy(thirdParty ? 'thirdParty' : 'prepare')
        setLog(null)
        try {
          const payload = await callApi({ action: 'prepare', thirdParty })
          setState(payload.state)
          setProxyDraft(payload.state.network?.proxy ?? '')
          setError(null)
          setLog(payload.steps.map((step) => `${step.status === 'done' ? '✓' : step.status === 'warn' ? '!' : '-'} ${step.label}${step.log ? `\n${step.log}` : ''}`).join('\n\n'))
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
          setBusy(null)
        }
      }, [])

      const saveSettings = React.useCallback(async () => {
        setBusy('settings')
        try {
          const payload = await callApi({ action: 'settings', proxy: proxyDraft })
          setState(payload.state)
          setProxyDraft(payload.state.network?.proxy ?? '')
          setError(null)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
          setBusy(null)
        }
      }, [proxyDraft])

      const pollJob = React.useCallback(async (jobId) => {
        let current = null
        for (let attempt = 0; attempt < 1200; attempt += 1) {
          const payload = await callApi({ action: 'job', id: jobId })
          current = payload.job
          setJob(current)
          if (current.status !== 'running') break
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
        await load(true)
        return current
      }, [load])

      const startAction = React.useCallback(async (body) => {
        setBusy(body.action)
        setError(null)
        try {
          const payload = await callApi(body)
          setJob(payload.job)
          const final = await pollJob(payload.job.id)
          if (final !== null && final.status === 'failed') setError(final.error ?? t('projects.job.failed'))
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
          setBusy(null)
        }
      }, [pollJob])

      React.useEffect(() => {
        if (selected === null) return
        try {
          window.localStorage.setItem(SELECTED_PROJECT_KEY, selected)
        } catch {
          // private mode / storage disabled: focusing still works for this session
        }
      }, [selected])

      React.useEffect(() => {
        if (state === null) return
        const exists = state.projects.some((project) => project.dir === selected)
        if (exists) return
        // Land on a project that already has a panel: an empty canvas is a poor
        // first impression of the designer.
        const preferred = state.projects.find((project) => project.hasDesign === true)
          ?? state.projects.find((project) => project.hasUi === true)
          ?? state.projects[0]
        setSelected(preferred === undefined ? null : preferred.dir)
      }, [state, selected])

      const selectedProject = state === null
        ? null
        : state.projects.find((project) => project.dir === selected) ?? null
      /** The two designers are only usable with a project selected. */
      const designerLocked = selectedProject === null
      /** Bridge between the circuit canvas and the Host routes. */
      const circuitApi = React.useMemo(() => {
        if (selectedProject === null) return null
        const dir = selectedProject.dir
        const save = (doc, name) => callApi({ action: 'writeCircuit', project: dir, doc, name })
        return {
          async load(file) {
            const payload = await callApi({ action: 'readCircuit', project: dir, file })
            return payload.circuit ?? null
          },
          async list() {
            const payload = await callApi({ action: 'listCircuits', project: dir })
            return payload.layouts ?? []
          },
          save,
          async exportNetlist(doc, text) {
            return callApi({ action: 'writeNetlist', project: dir, doc, text })
          },
          async savePreview(doc, png) {
            return callApi({ action: 'writePreview', project: dir, doc, png })
          },
          async checkParams() {
            const payload = await callApi({ action: 'paramCheck', project: dir })
            return payload.params ?? null
          },
          async simulate(request) {
            const payload = await callApi({ action: 'simulate', ...request })
            return payload.result
          },

        }
      }, [selectedProject === null ? null : selectedProject.dir]) // eslint-disable-line react-hooks/exhaustive-deps

      const disabled = busy !== null
      const buttonStyle = (primary) => (disabled ? { ...(primary ? S.buttonPrimary : S.button), ...S.buttonDisabled } : (primary ? S.buttonPrimary : S.button))

      const environment = state?.environment
      const header = h('div', { style: S.header },
        h('h1', { style: S.title }, t('panel.title')),
        h('span', { style: S.subtitle }, t('panel.subtitle')),
        h('span', { style: S.spacer }),
        environment === undefined ? null : h('span', { style: S.badge }, `${environment.platformLabel} ${environment.arch}`),
        state === undefined || state === null ? null : h('span', { style: S.badge }, `v${state.version}`),
        h('div', { style: { display: 'flex', gap: '4px' } },
          h('button', {
            style: mode === 'workflow' ? buttonStyle(true) : buttonStyle(false),
            onClick: () => { setMode('workflow') },
          }, t('designer.workflow')),
          // Both designers need a project: without one they have nothing to open,
          // and the old behaviour was a blank page (external report, 2026-11-18).
          h('button', {
            type: 'button',
            disabled: designerLocked,
            title: designerLocked ? t('projects.selectFirst.title') : undefined,
            style: designerLocked
              ? { ...S.button, ...S.buttonDisabled, cursor: 'default' }
              : mode === 'designer' ? buttonStyle(true) : buttonStyle(false),
            onClick: () => { if (!designerLocked) setMode('designer') },
          }, t('designer.tab')),
          h('button', {
            type: 'button',
            disabled: designerLocked,
            title: designerLocked ? t('projects.selectFirst.title') : undefined,
            style: designerLocked
              ? { ...S.button, ...S.buttonDisabled, cursor: 'default' }
              : mode === 'circuit' ? buttonStyle(true) : buttonStyle(false),
            onClick: () => { if (!designerLocked) setMode('circuit') },
          }, t('circuit.tab')),
        ),
        h('button', { style: buttonStyle(false), disabled, onClick: () => { void load(true) } }, t('action.refresh')),
      )

      if (error !== null) {
        return h('div', { style: S.root },
          header,
          h('div', { style: S.error }, `${t('state.failed')}：${error}`),
        )
      }
      if (state === null) {
        return h('div', { style: S.root }, header, h('div', { style: S.subtitle }, t('state.loading')))
      }

      const readyBadges = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('span', { style: S.badge }, `${environment.canGenerate ? '✓' : '✗'} ${t('env.readyGenerate')}`),
        h('span', { style: S.badge }, `${environment.canPack ? '✓' : '✗'} ${t('env.readyPack')}`),
        h('span', { style: S.badge }, `${t('footer.dir')}${t('punct.colon')}${state.config.projectsDir}`),
      )

      const toastLine = toast === null ? null : h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-brand-primary)' } }, toast)

      if (mode === 'circuit') {
        return h('div', { style: S.root },
          header,
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
            h('span', { style: S.subtitle }, selectedProject === null ? t('projects.selectFirst') : (selectedProject.name ?? selectedProject.slug)),
            toastLine,
            h('span', { style: { ...S.subtitle, marginLeft: 'auto' } }, t('circuit.stage')),
          ),
          selectedProject === null ? h(EmptyDesigner, { t, setMode }) : h(CircuitCanvas, {
            project: selectedProject,
            api: circuitApi,
            t,
            onError: (failure) => { setToast(String(failure?.message ?? failure)) },
          }),
        )
      }

      if (mode === 'designer') {
        return h('div', { style: S.root },
          header,
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
            h('span', { style: S.subtitle }, selectedProject === null ? t('projects.selectFirst') : (selectedProject.name ?? selectedProject.slug)),
            toastLine,
          ),
          selectedProject === null ? h(EmptyDesigner, { t, setMode }) : h(PanelDesigner, {
            project: selectedProject,
            callApi,
            t,
            onError: (failure) => { setError(failure instanceof Error ? failure.message : String(failure)) },
            showToast: (text) => { setToast(text) },
          }),
        )
      }


      const blockers = state.blockers.length === 0
        ? null
        : h('div', { style: S.section },
          h('div', { style: S.sectionTitle }, t('section.blockers')),
          h('div', { style: S.card }, state.blockers.map((text, index) => h('div', { key: index, style: S.blocker }, `• ${text}`))),
        )

      const envSection = h('div', { style: S.section },
        h('div', { style: S.sectionTitle }, t('section.env')),
        h('div', { style: S.card }, environment.checks.map((check) => h(CheckRow, { key: check.id, check }))),
      )

      const depsSection = h('div', { style: S.section },
        h('div', { style: S.sectionTitle }, t('section.deps')),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          h('button', { style: buttonStyle(true), disabled, onClick: () => { void prepare(false) } },
            busy === 'prepare' ? t('action.busy') : t('action.prepare')),
          state.config.packer?.needsThirdParty === true
            ? h('button', { style: buttonStyle(false), disabled, onClick: () => { void prepare(true) } },
              busy === 'thirdParty' ? t('action.busy') : t('action.thirdParty'))
            : null,
        ),
        h('div', { style: S.card },
          h(DepRow, { label: t('deps.framework'), dep: state.deps.framework }),
          h(DepRow, { label: state.deps.packer?.label ?? t('deps.packer'), dep: state.deps.packer }),
          state.deps.packer === null ? null : h('div', { style: S.mono }, `${t('deps.formats')}${t('punct.colon')}${(state.config.packer?.formats ?? []).join(' / ')}`),
        ),
        log === null ? null : h('div', { style: S.card }, h('pre', { style: S.pre }, log)),
      )

      const networkSection = h('div', { style: S.section },
        h('div', { style: S.sectionTitle }, t('section.network')),
        h('div', { style: S.card },
          h('div', { style: { ...S.row, alignItems: 'center' } },
            h('span', { style: S.label }, t('network.proxy')),
            h('input', {
              style: S.input,
              value: proxyDraft,
              placeholder: t('network.proxyPlaceholder'),
              spellCheck: false,
              onChange: (event) => { setProxyDraft(event.target.value) },
              onKeyDown: (event) => { if (event.key === 'Enter' && !disabled) void saveSettings() },
            }),
            h('button', { style: buttonStyle(true), disabled, onClick: () => { void saveSettings() } },
              busy === 'settings' ? t('action.busy') : t('network.save')),
          ),
          state.network.proxy === null ? h('div', { style: S.mono }, t('network.none')) : null,
          h('div', { style: S.mono }, `${t('network.file')}${t('punct.colon')}${state.network.settingsFile}`),
          state.network.warning === null ? null : h('div', { style: S.error }, state.network.warning),
        ),
      )

      // Two labelled fields on one grid row, plus the create button on the
      // baseline: a wrapping flex row used to leave the vendor label stranded
      // at the end of the name line.
      const formField = (label, input) => h('label', {
        style: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
      },
        h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, label),
        input,
      )
      const newProjectCard = h('div', { style: S.card },
        h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: '10px', alignItems: 'end' } },
          formField(t('projects.name'), h('input', {
            style: { ...S.input, minWidth: 0 },
            value: newName,
            placeholder: 'My Drive',
            onChange: (event) => { setNewName(event.target.value) },
          })),
          formField(t('projects.vendor'), h('input', {
            style: { ...S.input, minWidth: 0 },
            value: newVendor,
            placeholder: 'YOUR VENDOR',
            onChange: (event) => { setNewVendor(event.target.value) },
          })),
          h('button', {
            style: disabled || newName.trim() === '' ? { ...S.buttonSmall, opacity: 0.5 } : S.buttonSmall,
            disabled: disabled || newName.trim() === '',
            onClick: () => { void startAction({ action: 'scaffold', name: newName, vendor: newVendor }) },
          }, t('projects.create')),
        ),
        h('div', { style: S.mono }, t('projects.busyHint')),
      )

      const projectRows = state.projects.length === 0
        ? h('div', { style: S.subtitle }, t('projects.empty'))
        : state.projects.map((project) => {
          const bits = []
          if (typeof project.params === 'number' && project.params > 0) bits.push(`${project.params} ${t('projects.params')}`)
          if (typeof project.uiControls === 'number' && project.uiControls > 0) bits.push(`${project.uiControls} ${t('projects.controls')}`)
          if (project.gui === true) bits.push(t('projects.gui'))
          if (project.hasDesign === true) bits.push(t('projects.design'))
          const isSelected = selected === project.dir
          return h('div', {
            key: project.slug,
            role: 'button',
            tabIndex: 0,
            'aria-current': isSelected ? 'true' : undefined,
            style: isSelected ? { ...S.projectRow, ...S.projectRowActive } : S.projectRow,
            onClick: () => { setSelected(project.dir) },
          },
            // Focus marker: always occupies the same slot so the row does not
            // shift when the selection moves.
            h('span', {
              style: {
                width: '10px', flexShrink: 0, fontSize: '12px', lineHeight: 1,
                color: 'var(--dsw-alias-brand-primary)',
              },
              'aria-hidden': true,
            }, isSelected ? '●' : ''),
            h('span', { style: { fontWeight: 500, whiteSpace: 'nowrap' } }, project.name ?? project.slug),
            h('span', { style: { ...S.detail, whiteSpace: 'nowrap' } }, bits.join(' · ')),
            h('span', {
              style: {
                ...S.mono,
                flex: '1 1 80px',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              },
            }, project.dir),
            h('span', { style: { display: 'flex', gap: '4px', flexShrink: 0, alignSelf: 'center' } },
              h('button', {
                type: 'button',
                title: t('projects.openPanel.title'),
                onClick: (event) => {
                  event.stopPropagation()
                  setSelected(project.dir)
                  setMode('designer')
                },
                style: S.rowAction,
              }, t('projects.openPanel')),
              h('button', {
                type: 'button',
                title: t('projects.openCircuit.title'),
                onClick: (event) => {
                  event.stopPropagation()
                  setSelected(project.dir)
                  setMode('circuit')
                },
                style: S.rowAction,
              }, t('projects.openCircuit')),
            ),
          )
        })

      const jobCard = job === null ? null : h('div', { style: S.card },
        h('div', { style: S.row },
          h(Dot, { status: job.status === 'ok' ? 'ok' : job.status === 'failed' ? 'missing' : 'warn' }),
          h('span', { style: { fontWeight: 500 } }, job.label),
          h('span', { style: S.detail }, job.status === 'running' ? t('projects.job.running') : job.status === 'ok' ? t('projects.job.ok') : t('projects.job.failed')),
        ),
        job.artifacts.length === 0 ? null : h('div', { style: S.mono }, `${t('projects.artifacts')}${t('punct.colon')}`),
        ...job.artifacts.map((artifact, index) => h('div', { key: `a${index}`, style: S.mono }, artifact)),
        job.error === null ? null : h('div', { style: S.error }, job.error),
        job.log === '' ? null : h('pre', { style: S.pre }, job.log),
      )

      const recentJobs = job !== null || state.jobs.length === 0 ? null : h('div', { style: S.card },
        h('div', { style: S.mono }, t('projects.jobs')),
        state.jobs.slice(0, 4).map((entry) => h('div', { key: entry.id, style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
          h('div', { style: S.row },
            h(Dot, { status: entry.status === 'ok' ? 'ok' : entry.status === 'failed' ? 'missing' : 'warn' }),
            h('span', { style: { fontSize: '12px' } }, `${entry.label} · ${entry.kind}`),
            h('span', { style: S.detail }, entry.artifacts.length === 0 ? '' : `${entry.artifacts.length}`),
          ),
          ...entry.artifacts.map((artifact, index) => h('div', { key: `${entry.id}-${index}`, style: S.mono }, artifact)),
          entry.error === null ? null : h('div', { style: S.subtitle }, entry.error),
        )),
      )

      const projectsSection = h('div', { style: S.section },
        h('div', { style: S.sectionTitle }, `${t('section.projects')}${t('punct.paren').open}${state.projects.length}${t('punct.paren').close}`),
        newProjectCard,
        h('div', { style: S.card }, projectRows),
        jobCard,
        recentJobs,
      )

      const notes = state.notes.length === 0
        ? null
        : h('div', { style: S.section },
          h('div', { style: S.sectionTitle }, t('section.notes')),
          h('div', { style: S.card }, state.notes.map((note, index) => h('div', { key: index, style: S.subtitle }, note.text))),
        )

      return h('div', { style: S.root }, header, readyBadges, toastLine, projectsSection, blockers, envSection, depsSection, networkSection, notes)
    }

    function PanelIcon({ size = 20, active = false }) {
      const stroke = active ? 'var(--dsw-alias-brand-primary)' : 'currentColor'
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke,
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block', opacity: active ? 1 : 0.75 },
      },
        h('path', { d: 'M3 7h5l2 2h4' }),
        h('circle', { cx: 3.6, cy: 7, r: 1.3 }),
        h('circle', { cx: 15.5, cy: 9, r: 1.3 }),
        h('path', { d: 'M6.5 15.5h5l2-3h4' }),
        h('circle', { cx: 6.5, cy: 15.5, r: 1.3 }),
        h('rect', { x: 16.5, y: 13, width: 5, height: 6, rx: 1.2 }),
        h('path', { d: 'M18 13V9.5' }),
      )
    }

    const pluginModule = {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // The Client context exposes the service as `ctx.locale` once injected;
        // `ctx.get` covers a composition that only offers the lookup form.
        const locale = ctx.locale ?? (typeof ctx.get === 'function' ? ctx.get('locale') : undefined)
        try {
          const snapshot = typeof locale?.getLocale === 'function' ? locale.getLocale() : undefined
          if (typeof snapshot?.active === 'string') activeLocale = snapshot.active
        } catch {
          activeLocale = ''
        }
        if (locale !== undefined && locale !== null && typeof locale.bind === 'function') {
          try {
            const bound = locale.bind(NS)
            translate = (key) => {
              const value = bound(key)
              // An unregistered namespace returns the key itself: fall back to
              // the dictionary of the locale the shell is actually showing.
              if (value === key || value === undefined || value === null) {
                return prefersChinese() ? (ZH[key] ?? EN[key]) : (EN[key] ?? ZH[key])
              }
              return value
            }
          } catch {
            translate = (key) => EN[key] ?? key
          }
        }
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, Panel))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel.label'),
        }, PanelIcon))
      },
    }
