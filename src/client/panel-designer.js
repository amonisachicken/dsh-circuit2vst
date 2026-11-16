/**
 * Panel designer UI — a React rewrite of rustomp-box-designer's canvas.
 *
 * The document model, geometry and exporters are the vendored upstream modules
 * (see `vendor/boxdesigner/PROVENANCE.md`), so everything this UI exports is
 * byte-identical to the upstream CLI's output for the same `.box.json`. What is
 * new here is the surface: a themed SVG canvas, layer focus, an asset library,
 * selection and dragging, a property editor, and writing the result back into
 * the project (`design/panel.box.json`, `assets/*.png`, `rustomp.toml`).
 *
 * Layer focus follows the upstream rule exactly: nothing is editable without a
 * focused layer, every other layer is dimmed through the exporter's own
 * `dimLayers`, and adding an element moves the focus to its layer.
 */

/** Designer-specific strings; the main panel merges these into its own table. */
const DESIGNER_TEXT = {
  en: {
    'designer.tab': 'Panel designer',
    'designer.workflow': 'Workflow',
    'designer.canvas': 'Canvas',
    'designer.mode.edit': 'Edit',
    'designer.mode.preview': 'Preview',
    'designer.preview.hint': 'Preview: drag a knob to turn it, click a toggle or LED, hold the footswitch.',
    'designer.preview.locked': 'Preview — layers are not editable.',
    'designer.clamped': '{n} element(s) moved back inside the canvas.',
    'designer.inspector.hint': 'Click an element to edit it; focus “Background” and click the canvas to change canvas settings.',
    'designer.preset': 'Enclosure',
    'designer.name': 'Name',
    'designer.width': 'Width',
    'designer.height': 'Height',
    'designer.orientation': 'Orientation',
    'designer.orientation.hint': 'Flipping changes the canvas only; element positions stay as they are.',
    'designer.validate.warnOnly': 'Outside the canvas — export still works, the runtime clips it.',
    'designer.portrait': 'Portrait',
    'designer.landscape': 'Landscape',
    'designer.background': 'Background',
    'designer.new': 'Start over',
    'designer.save': 'Save design',
    'designer.saved': 'Saved',
    'designer.exists': 'A design file exists',
    'designer.library': 'Asset library',
    'designer.library.knob': 'Knobs',
    'designer.library.toggle': 'Toggles',
    'designer.library.led': 'LEDs',
    'designer.library.label': 'Silkscreen labels',
    'designer.library.button': 'Footswitches',
    'designer.added': 'Added',
    'designer.add': 'Add',
    'designer.add.knob': 'Knob',
    'designer.add.toggle': 'Toggle',
    'designer.add.led': 'LED',
    'designer.add.button': 'Footswitch',
    'designer.add.frame': 'Frame',
    'designer.add.rect': 'Rectangle',
    'designer.selection': 'Selection',
    'designer.none': 'Click an element on the canvas.',
    'designer.delete': 'Delete',
    'designer.duplicate': 'Duplicate',
    'designer.align': 'Align',
    'designer.align.left': 'Left',
    'designer.align.hcenter': 'H center',
    'designer.align.right': 'Right',
    'designer.align.top': 'Top',
    'designer.align.vcenter': 'V center',
    'designer.align.bottom': 'Bottom',
    'designer.distribute': 'Space evenly',
    'designer.layers': 'Layers',
    'designer.layers.pick': 'Layer',
    'designer.layers.unfocused': 'none',
    'designer.layers.hint': 'Click a row to focus it; click again to leave focus.',
    'designer.layers.legend': '✅ normal · ⚠️ element outside canvas · ◻ hidden',
    'designer.layers.show': 'Show layer',
    'designer.layers.hide': 'Hide layer',
    'designer.layers.editing': 'editing',
    'designer.focus.none': 'No layer focused — open “Layer” above and pick one; only the focused layer can be edited.',
    'designer.focus.on': 'Editing “{layer}” — other layers are dimmed and locked.',
    'designer.validate': 'Validation',
    'designer.valid': 'No problems found.',
    'designer.export': 'Export',
    'designer.export.write': 'Write rustomp.toml',
    'designer.export.assets': 'Write artwork (PNG)',
    'designer.export.blocked': 'Fix validation problems before exporting.',
    'designer.hint': 'Drag to move (0.5 mm snap, Alt disables); arrows nudge; Shift+arrow 1 mm; Delete removes.',
    'designer.mm': 'mm',
    'designer.field.asset': 'Artwork',
    'designer.field.param': 'Parameter',
    'designer.field.pair': 'Switch pair',
    'designer.field.center': 'Center',
    'designer.field.x': 'X',
    'designer.field.y': 'Y',
    'designer.field.rot': 'Rotation',
    'designer.field.margin': 'Margin',
    'designer.field.rx': 'Corner',
    'designer.field.strokeWidth': 'Stroke',
    'designer.field.w': 'Width',
    'designer.field.h': 'Height',
    'designer.field.fill': 'Fill',
    'designer.field.stroke': 'Stroke color',
    'designer.field.offColor': 'Off color',
    'designer.field.onColor': 'On color',
    'designer.busy': 'Working…',
  },
  zh: {
    'designer.tab': '面板设计器',
    'designer.workflow': '流程',
    'designer.canvas': '画布',
    'designer.mode.edit': '编辑',
    'designer.mode.preview': '预览',
    'designer.preview.hint': '预览：拖旋钮改值 · 点拨杆/LED 切换 · 按住脚踏看按下反馈。',
    'designer.preview.locked': '预览模式 —— 图层不可编辑。',
    'designer.clamped': '{n} 个元素已移回画布内。',
    'designer.inspector.hint': '点画布上的元素编辑属性；聚焦「背景」后点画布改画布设置。',
    'designer.preset': '外壳',
    'designer.name': '名称',
    'designer.width': '宽',
    'designer.height': '高',
    'designer.orientation': '方向',
    'designer.orientation.hint': '翻转只改画布尺寸，元素坐标不变。',
    'designer.validate.warnOnly': '超出画布 —— 不挡导出，运行时会裁掉。',
    'designer.portrait': '竖放',
    'designer.landscape': '横放',
    'designer.background': '背景色',
    'designer.new': '清空重做',
    'designer.save': '保存设计',
    'designer.saved': '已保存',
    'designer.exists': '已有设计文件',
    'designer.library': '素材库',
    'designer.library.knob': '旋钮',
    'designer.library.toggle': '拨杆',
    'designer.library.led': 'LED',
    'designer.library.label': '丝印标签',
    'designer.library.button': '脚踏',
    'designer.added': '已添加',
    'designer.add': '添加',
    'designer.add.knob': '旋钮',
    'designer.add.toggle': '拨杆',
    'designer.add.led': 'LED',
    'designer.add.button': '脚踏',
    'designer.add.frame': '边框',
    'designer.add.rect': '矩形',
    'designer.selection': '选中',
    'designer.none': '在画布上点一个元素。',
    'designer.delete': '删除',
    'designer.duplicate': '复制',
    'designer.align': '对齐',
    'designer.align.left': '左',
    'designer.align.hcenter': '水平中',
    'designer.align.right': '右',
    'designer.align.top': '上',
    'designer.align.vcenter': '垂直中',
    'designer.align.bottom': '下',
    'designer.distribute': '等间距',
    'designer.layers': '图层',
    'designer.layers.pick': '图层',
    'designer.layers.unfocused': '未聚焦',
    'designer.layers.hint': '点一行聚焦；再点一次退出聚焦。',
    'designer.layers.legend': '✅ 正常 · ⚠️ 有元素超出画布 · ◻ 已隐藏',
    'designer.layers.show': '显示图层',
    'designer.layers.hide': '隐藏图层',
    'designer.layers.editing': '编辑中',
    'designer.focus.none': '未聚焦图层 —— 点上方「图层」选一层；只有聚焦的图层能编辑。',
    'designer.focus.on': '正在编辑「{layer}」—— 其它图层已虚化并锁定。',
    'designer.validate': '校验',
    'designer.valid': '没有发现问题。',
    'designer.export': '导出',
    'designer.export.write': '写入 rustomp.toml',
    'designer.export.assets': '写入素材（PNG）',
    'designer.export.blocked': '先修掉校验问题再导出。',
    'designer.hint': '拖动移动（0.5 mm 吸附，Alt 关闭）；方向键微调（Shift 1 mm）；Delete 删除。',
    'designer.mm': 'mm',
    'designer.field.asset': '素材',
    'designer.field.param': '参数',
    'designer.field.pair': '拨杆素材',
    'designer.field.center': '圆心',
    'designer.field.x': 'X',
    'designer.field.y': 'Y',
    'designer.field.rot': '旋转',
    'designer.field.margin': '内缩',
    'designer.field.rx': '圆角',
    'designer.field.strokeWidth': '线宽',
    'designer.field.w': '宽',
    'designer.field.h': '高',
    'designer.field.fill': '填充',
    'designer.field.stroke': '描边色',
    'designer.field.offColor': '熄灭色',
    'designer.field.onColor': '点亮色',
    'designer.busy': '进行中…',
  },
}

/** Draw order for hit testing: later groups sit on top, as in the runtime. */
const HIT_ORDER = ['button', 'toggle', 'knob', 'led', 'image', 'rect', 'frame']

/**
 * Which element sits under a point, restricted to the focused layer.
 * @param doc - design document.
 * @param point - `[x, y]` in canvas millimetres.
 * @param focus - focused layer id, or null when nothing is focused.
 * @returns the topmost editable element, or null.
 */
function hitTest(doc, [x, y], focus, anyLayer = false) {
  if (!anyLayer && focus === null) return null
  const rank = (kind) => {
    const index = HIT_ORDER.indexOf(kind)
    return index === -1 ? HIT_ORDER.length : index
  }
  const candidates = doc.elements
    .map((element, index) => ({ element, index, box: bbox(element, doc.canvas.canvas_mm), rank: rank(element.kind) }))
    .filter(({ element }) => !layerState(doc, layerOf(element)).hidden && (anyLayer || layerOf(element) === focus))
    .sort((left, right) => left.rank - right.rank || right.index - left.index)
  for (const candidate of candidates) {
    const { box } = candidate
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return candidate.element
  }
  return null
}

/**
 * Give an asset SVG explicit pixel size so it can be rasterized on its own.
 * @param svg - asset SVG text.
 * @param width - target width in px.
 * @param height - target height in px.
 * @returns the SVG with width/height attributes replaced.
 */
function withPixelSize(svg, width, height) {
  return String(svg).replace(/<svg\b([^>]*)>/, (whole, attrs) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, '')
    return `<svg${cleaned} width="${Math.round(width)}" height="${Math.round(height)}">`
  })
}

/**
 * Rasterize one SVG to a PNG data URL payload.
 * @param svgText - SVG source.
 * @param width - px width.
 * @param height - px height.
 * @returns base64 PNG bytes (no data-URL prefix).
 */
async function rasterize(svgText, width, height) {
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('SVG 无法栅格化'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Thumbnail data URL for one built-in asset. */
function assetThumb(id) {
  const svg = typeof ASSET_TEXT === 'object' ? ASSET_TEXT[id] : undefined
  if (typeof svg !== 'string') return ''
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Property form schema per element kind; `path` addresses the element field. */
function fieldsFor(kind) {
  const num = (path, label) => ({ path, label, type: 'number', step: 0.1 })
  switch (kind) {
    case 'knob':
      return [
        { path: 'asset', label: 'designer.field.asset', type: 'asset', kinds: ['knob'] },
        { path: 'param', label: 'designer.field.param', type: 'param', paramKind: 'knob' },
        { path: 'center', label: 'designer.field.center', type: 'vec2' },
      ]
    case 'toggle':
      return [
        { path: 'pair', label: 'designer.field.pair', type: 'pair' },
        { path: 'param', label: 'designer.field.param', type: 'param', paramKind: 'toggle' },
        num('x', 'designer.field.x'),
        num('y_up', 'designer.field.y'),
      ]
    case 'led':
      return [
        { path: 'asset', label: 'designer.field.asset', type: 'asset', kinds: ['led'] },
        { path: 'param', label: 'designer.field.param', type: 'param', paramKind: 'led' },
        { path: 'center', label: 'designer.field.center', type: 'vec2' },
        { path: 'off_color', label: 'designer.field.offColor', type: 'color' },
        { path: 'on_color', label: 'designer.field.onColor', type: 'color' },
      ]
    case 'button':
      return [
        { path: 'asset', label: 'designer.field.asset', type: 'asset', kinds: ['footswitch', 'button'] },
        { path: 'param', label: 'designer.field.param', type: 'param', paramKind: 'button' },
        { path: 'center', label: 'designer.field.center', type: 'vec2' },
      ]
    case 'frame':
      return [num('margin', 'designer.field.margin'), num('rx', 'designer.field.rx'), num('strokeWidth', 'designer.field.strokeWidth')]
    case 'rect':
      return [num('x', 'designer.field.x'), num('y', 'designer.field.y'), num('w', 'designer.field.w'), num('h', 'designer.field.h'), num('rx', 'designer.field.rx')]
    case 'image':
      return [num('x', 'designer.field.x'), num('y', 'designer.field.y'), num('rot', 'designer.field.rot')]
    default:
      return []
  }
}

/**
 * Read a dotted path from an object.
 * @param target - object.
 * @param path - dotted path.
 * @returns the value.
 */
function getPath(target, path) {
  return path.split('.').reduce((value, key) => (value === undefined || value === null ? value : value[key]), target)
}

/**
 * Write a dotted path into an object.
 * @param target - object, mutated.
 * @param path - dotted path.
 * @param value - new value.
 */
function setPath(target, path, value) {
  const keys = path.split('.')
  let cursor = target
  for (const key of keys.slice(0, -1)) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {}
    cursor = cursor[key]
  }
  cursor[keys[keys.length - 1]] = value
}

/** Library groups: title key, the layer they belong to, and how to add one. */
function libraryGroups() {
  const labels = ASSETS.filter((asset) => asset.kind === 'label')
  const knobs = ASSETS.filter((asset) => asset.kind === 'knob')
  const leds = ASSETS.filter((asset) => asset.kind === 'led')
  return [
    {
      id: 'knob',
      title: 'designer.library.knob',
      layer: 'knobs',
      items: knobs.map((asset) => ({ key: asset.id, label: asset.id.replace(/^knob_/, ''), thumb: asset.id })),
      add: (doc, key, at) => factory.knob(doc, { asset: key, param: paramChoices(doc, 'knob')[0] ?? '', center: at }),
    },
    {
      id: 'toggle',
      title: 'designer.library.toggle',
      layer: 'toggles',
      items: Object.keys(SWITCH_PAIRS).map((pair) => ({
        key: pair,
        label: pair.replace(/^toggle_/, ''),
        thumb: SWITCH_PAIRS[pair].up,
      })),
      add: (doc, key, at) => factory.toggle(doc, { pair: key, param: paramChoices(doc, 'toggle')[0] ?? '', x: at[0] - 5, y: at[1] - 5 }),
    },
    {
      id: 'led',
      title: 'designer.library.led',
      layer: 'leds',
      items: leds.map((asset) => ({ key: asset.id, label: asset.id.replace(/^led_/, ''), thumb: asset.id })),
      add: (doc, key, at) => factory.led(doc, { asset: key, center: at }),
    },
    {
      id: 'label',
      title: 'designer.library.label',
      layer: 'silkscreen',
      items: labels.map((asset) => ({ key: asset.id, label: asset.id.replace(/^label_/, ''), thumb: asset.id })),
      add: (doc, key, at) => {
        const info = byId(key)
        const width = info?.size_mm?.[0] ?? 8
        const height = info?.size_mm?.[1] ?? 2.4
        return factory.image(doc, {
          asset: key,
          x: +(at[0] - width / 2).toFixed(2),
          y: +(at[1] - height / 2).toFixed(2),
          layer: 'silkscreen',
        })
      },
    },
    {
      id: 'button',
      title: 'designer.library.button',
      layer: 'buttons',
      items: FOOTSWITCHES.map((id) => ({ key: id, label: id.replace(/_/g, ' '), thumb: id })),
      add: (doc, key, at) => factory.button(doc, { asset: key, param: paramChoices(doc, 'button')[0] ?? '', center: at }),
    },
  ]
}

/**
 * The designer surface.
 * @param props.project - project state entry (has `dir`, `slug`, `name`, `hasDesign`).
 * @param props.callApi - the panel's Host request helper.
 * @param props.t - translator.
 * @param props.onError - report failures to the panel.
 * @param props.showToast - transient status line.
 */
function PanelDesigner({ project, callApi, t, onError, showToast }) {
  const [doc, setDoc] = React.useState(null)
  const [manifestText, setManifestText] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState([])
  const [focus, setFocus] = React.useState(null)
  const [layersOpen, setLayersOpen] = React.useState(false)
  const [canvasClicked, setCanvasClicked] = React.useState(false)
  const [mode, setMode] = React.useState('edit')
  const [previewValues, setPreviewValues] = React.useState({})
  const previewDrag = React.useRef(null)
  const layerMenuRef = React.useRef(null)
  const [busy, setBusy] = React.useState(null)
  const [problems, setProblems] = React.useState([])
  const [uiText, setUiText] = React.useState('')
  const [newName, setNewName] = React.useState('')
  const [newPreset, setNewPreset] = React.useState('1590B')
  const dragRef = React.useRef(null)
  const canvasRef = React.useRef(null)

  const params = React.useMemo(() => parseParams(manifestText), [manifestText])
  const assets = React.useMemo(() => (doc === null ? {} : mergedAssets(doc, ASSET_TEXT)), [doc])
  const canvasSize = doc === null ? [60, 112] : doc.canvas.canvas_mm

  /** Replace the document, keeping React state immutable. */
  const commit = React.useCallback((mutate) => {
    setDoc((previous) => {
      if (previous === null) return previous
      const next = JSON.parse(JSON.stringify(previous))
      mutate(next)
      next.params = params
      return next
    })
  }, [params])

  /** Load the project's design (or start a new one). */
  const loadDesign = React.useCallback(async (fresh) => {
    setBusy('load')
    try {
      const payload = await callApi({ action: 'readDesign', project: project.dir })
      const design = payload.design
      setManifestText(design.manifestText ?? '')
      const parsedParams = parseParams(design.manifestText ?? '')
      if (!fresh && design.exists && typeof design.text === 'string') {
        const loaded = load(design.text)
        loaded.params = parsedParams
        setDoc(loaded)
        showToast(`${t('designer.exists')}：design/panel.box.json`)
      } else {
        const created = newDoc({ name: newName.trim() || (project.name ?? project.slug), preset: newPreset, params: parsedParams })
        setDoc(created)
      }
      setSelectedIds([])
      setFocus(null)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy(null)
    }
  }, [callApi, newName, newPreset, onError, project, showToast, t])

  React.useEffect(() => { void loadDesign(false) }, [project.dir]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (doc === null) return
    setProblems(validate(doc))
    setUiText(uiToml(doc))
  }, [doc])

  const selected = doc === null ? [] : doc.elements.filter((element) => selectedIds.includes(element.id))

  // How many elements of each layer sit outside the canvas. Same rule as the
  // vendored `validate()` (1 mm tolerance, the frame is canvas-relative and never
  // counts), so the badge and the Validation card cannot disagree.
  const outsideByLayer = React.useMemo(() => {
    const counts = new Map()
    if (doc === null) return counts
    const [W, H] = doc.canvas.canvas_mm
    for (const element of doc.elements) {
      if (element.kind === 'frame') continue
      const box = bbox(element, doc.canvas.canvas_mm)
      if (!(box.x < -1 || box.y < -1 || box.x + box.w > W + 1 || box.y + box.h > H + 1)) continue
      const layer = layerOf(element)
      counts.set(layer, (counts.get(layer) ?? 0) + 1)
    }
    return counts
  }, [doc])

  // Close the layer menu on an outside click or Escape; it is a transient picker,
  // not a panel that should stay open.
  React.useEffect(() => {
    if (!layersOpen) return undefined
    const onPointer = (event) => {
      if (layerMenuRef.current !== null && !layerMenuRef.current.contains(event.target)) setLayersOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') setLayersOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [layersOpen])

  /** Point in canvas millimetres for a pointer event. */
  const pointOf = React.useCallback((event) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect === undefined) return null
    const [W, H] = canvasSize
    return [((event.clientX - rect.left) / rect.width) * W, ((event.clientY - rect.top) / rect.height) * H]
  }, [canvasSize])

  /** Focus a layer; focusing the focused one again leaves focus. */
  const toggleFocus = (layer) => {
    const next = focus === layer ? null : layer
    setFocus(next)
    setCanvasClicked(false)
    // Drop a selection that the new focus cannot edit.
    setSelectedIds((previous) => previous.filter((id) => {
      const element = doc?.elements.find((candidate) => candidate.id === id)
      return element !== undefined && next !== null && layerOf(element) === next
    }))
  }

  const onPointerDown = (event) => {
    const point = pointOf(event)
    if (point === null || doc === null) return
    if (mode === 'preview') {
      const hit = hitTest(doc, point, null, true)
      if (hit === null) return
      if (hit.kind === 'knob') {
        event.currentTarget.setPointerCapture(event.pointerId)
        previewDrag.current = { id: hit.id, startY: event.clientY, startValue: previewValues[hit.id] ?? 0.5 }
        return
      }
      if (hit.kind === 'button') {
        event.currentTarget.setPointerCapture(event.pointerId)
        previewDrag.current = { id: hit.id, pressed: true }
        setPreviewValues((previous) => ({ ...previous, [hit.id]: true }))
        return
      }
      if (hit.kind === 'toggle' || hit.kind === 'led') {
        const current = previewValues[hit.id] ?? (hit.kind === 'led' ? hit.lit === true : hit.state === true)
        setPreviewValues((previous) => ({ ...previous, [hit.id]: !current }))
      }
      return
    }
    const hit = hitTest(doc, point, focus)
    // Canvas settings live in the same inspector slot: a click on the canvas
    // while the background layer is focused reveals them.
    if (focus === 'background') setCanvasClicked(hit === null)
    if (event.shiftKey && hit !== null) {
      setSelectedIds((previous) => (previous.includes(hit.id) ? previous.filter((id) => id !== hit.id) : [...previous, hit.id]))
      return
    }
    setSelectedIds(hit === null ? [] : [hit.id])
    if (hit === null || hit.kind === 'frame') return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { origin: point, last: point, ids: selectedIds.includes(hit.id) ? selectedIds : [hit.id] }
  }

  const onPointerMove = (event) => {
    if (mode === 'preview') {
      const drag = previewDrag.current
      if (drag === null || drag.startY === undefined) return
      // 260 px of vertical travel spans the whole range, like the runtime's
      // `drag_full_range_px` default.
      const delta = (drag.startY - event.clientY) / 260
      const value = Math.min(1, Math.max(0, drag.startValue + delta))
      setPreviewValues((previous) => ({ ...previous, [drag.id]: value }))
      return
    }
    const drag = dragRef.current
    if (drag === null) return
    const point = pointOf(event)
    if (point === null) return
    const step = event.altKey ? 0 : 0.5
    const rawDx = point[0] - drag.last[0]
    const rawDy = point[1] - drag.last[1]
    const dx = step === 0 ? rawDx : Math.round((point[0] - drag.origin[0]) / step) * step - Math.round((drag.last[0] - drag.origin[0]) / step) * step
    const dy = step === 0 ? rawDy : Math.round((point[1] - drag.origin[1]) / step) * step - Math.round((drag.last[1] - drag.origin[1]) / step) * step
    if (dx === 0 && dy === 0) return
    drag.last = [drag.last[0] + dx, drag.last[1] + dy]
    const ids = drag.ids
    commit((next) => {
      for (const element of next.elements) {
        if (ids.includes(element.id)) move(element, dx, dy)
      }
    })
  }

  const onPointerUp = () => {
    if (mode === 'preview') {
      const drag = previewDrag.current
      if (drag !== null && drag.pressed === true) {
        setPreviewValues((previous) => ({ ...previous, [drag.id]: false }))
      }
      previewDrag.current = null
      return
    }
    dragRef.current = null
  }

  const onKeyDown = (event) => {
    if (doc === null || selected.length === 0) return
    const step = event.shiftKey ? 1 : 0.1
    const keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (keys[event.key] !== undefined) {
      event.preventDefault()
      const [dx, dy] = keys[event.key]
      const ids = selected.map((element) => element.id)
      commit((next) => { for (const element of next.elements) if (ids.includes(element.id)) move(element, dx, dy) })
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeSelected()
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateSelected()
    }
  }

  const removeSelected = () => {
    const ids = selected.map((element) => element.id)
    commit((next) => { next.elements = next.elements.filter((element) => !ids.includes(element.id)) })
    setSelectedIds([])
  }

  const duplicateSelected = () => {
    if (selected.length === 0) return
    const copies = []
    commit((next) => {
      for (const element of duplicate(next, selected, [2, 2])) {
        next.elements.push(element)
        copies.push(element.id)
      }
    })
    setSelectedIds(copies)
  }

  /** Array order of elements to offset each new one a little. */
  const spawnPoint = (next) => {
    const [W, H] = next.canvas.canvas_mm
    const count = next.elements.length
    return [Math.round(W / 2) + (count % 3) * 3, Math.round(H / 3) + (count % 4) * 3]
  }

  const addElement = (kind) => {
    if (focus === null) {
      onError(new Error(t('designer.focus.none')))
      return
    }
    commit((next) => {
      const at = spawnPoint(next)
      let element
      if (kind === 'knob') element = factory.knob(next, { param: paramChoices(next, 'knob')[0] ?? '', center: at })
      else if (kind === 'toggle') element = factory.toggle(next, { param: paramChoices(next, 'toggle')[0] ?? '', x: at[0] - 10, y: at[1] - 10 })
      else if (kind === 'led') element = factory.led(next, { center: at })
      else if (kind === 'button') element = factory.button(next, { param: paramChoices(next, 'button')[0] ?? '', center: at })
      else if (kind === 'frame') element = factory.frame(next)
      else element = factory.rect(next, { x: at[0] - 15, y: at[1] - 6, w: 30, h: 12, fill: next.canvas.background })
      next.elements.push(element)
      setSelectedIds([element.id])
      // Adding always moves the focus to the new element's layer, like upstream.
      setFocus(layerOf(element))
    })
  }

  /** Add one library asset, moving focus to its layer. */
  const addLibraryItem = (group, key) => {
    commit((next) => {
      const at = spawnPoint(next)
      const element = group.add(next, key, at)
      next.elements.push(element)
      setSelectedIds([element.id])
      setFocus(layerOf(element))
    })
  }

  const updateField = (element, field, value) => {
    commit((next) => {
      const target = next.elements.find((candidate) => candidate.id === element.id)
      if (target === undefined) return
      if (field.type === 'pair') {
        const pair = SWITCH_PAIRS[value]
        if (pair === undefined) return
        target.image_up = pair.up
        target.image_down = pair.down
        const up = byId(pair.up)
        const down = byId(pair.down)
        if (up !== undefined) {
          target.width = up.size_mm[0]
          target.height = up.size_mm[1]
        }
        if (down === undefined) return
        syncTogglePivot(target)
        return
      }
      if (field.type === 'asset') {
        const info = byId(value)
        setPath(target, 'asset', value)
        if (info !== undefined) {
          target.image_size = info.size_mm
          if (target.kind === 'button') target.image_hold = info.hold ?? ''
        }
        return
      }
      setPath(target, field.path, value)
      if (target.kind === 'toggle' && (field.path === 'x' || field.path === 'y_up')) syncTogglePivot(target)
    })
  }

  /**
   * Apply a mutation synchronously, so the caller can read a value the mutator
   * computed. `commit` defers the updater to React, which is wrong here because
   * the "moved N elements" toast needs the count immediately.
   *
   * @param mutate - mutator over a deep copy of the current document.
   * @returns whatever the mutator returned, or undefined without a document.
   */
  const commitNow = (mutate) => {
    if (doc === null) return undefined
    const next = JSON.parse(JSON.stringify(doc))
    const outcome = mutate(next)
    next.params = params
    setDoc(next)
    return outcome
  }

  /**
   * Push every element back inside the canvas after it changed shape.
   *
   * Flipping or shrinking the canvas can strand an element outside the visible
   * area, where it can no longer be selected or deleted — and the layer badge
   * would keep warning about it. Each element moves to the nearest position that
   * is fully inside (or is centred when it is larger than the canvas), through
   * the same `move()` helper the editor uses so toggle pivots stay consistent.
   *
   * @param next - document being mutated.
   * @returns how many elements moved.
   */
  const clampWithinCanvas = (next) => {
    const [W, H] = next.canvas.canvas_mm
    let moved = 0
    for (const element of next.elements) {
      if (element.kind === 'frame') continue
      const box = bbox(element, next.canvas.canvas_mm)
      const dx = box.w >= W ? (W - box.w) / 2 - box.x
        : box.x < 0 ? -box.x
          : box.x + box.w > W ? W - (box.x + box.w) : 0
      const dy = box.h >= H ? (H - box.h) / 2 - box.y
        : box.y < 0 ? -box.y
          : box.y + box.h > H ? H - (box.y + box.h) : 0
      if (dx === 0 && dy === 0) continue
      move(element, dx, dy)
      moved += 1
    }
    return moved
  }

  /** Change canvas width/height in millimetres, keeping every element reachable. */
  const setCanvasSize = (axis, value) => {
    const size = Number(value)
    if (!Number.isFinite(size) || size <= 0) return
    const moved = commitNow((next) => {
      next.canvas.canvas_mm[axis] = +size.toFixed(3)
      next.canvas.window_px = next.canvas.canvas_mm.map((mm) => Math.round(mm * 6))
      return clampWithinCanvas(next)
    })
    if (moved > 0) showToast(t('designer.clamped').replace('{n}', moved))
  }

  /** Swap the canvas between portrait and landscape, keeping every element reachable. */
  const flipOrientation = () => {
    const moved = commitNow((next) => {
      next.canvas.canvas_mm = [next.canvas.canvas_mm[1], next.canvas.canvas_mm[0]]
      next.canvas.outer_mm = [(next.canvas.outer_mm ?? next.canvas.canvas_mm)[1], (next.canvas.outer_mm ?? next.canvas.canvas_mm)[0]]
      next.canvas.window_px = next.canvas.canvas_mm.map((mm) => Math.round(mm * 6))
      return clampWithinCanvas(next)
    })
    if (moved > 0) showToast(t('designer.clamped').replace('{n}', moved))
  }

  /** Apply one enclosure preset to the current canvas. */
  const applyPreset = (preset) => {
    const chosen = PRESETS[preset]
    if (chosen === undefined) return
    commit((next) => {
      next.canvas.preset = preset
      next.canvas.outer_mm = [...chosen.outer_mm]
      next.canvas.canvas_mm = [...chosen.canvas_mm]
      next.canvas.window_px = chosen.canvas_mm.map((mm) => Math.round(mm * 6))
    })
  }

  const saveDesign = async () => {
    if (doc === null) return
    setBusy('save')
    try {
      const payload = await callApi({ action: 'writeDesign', project: project.dir, text: save(doc) })
      showToast(`${t('designer.saved')}：${payload.path}`)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy(null)
    }
  }

  const awaitJob = async (jobId) => {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const payload = await callApi({ action: 'job', id: jobId })
      if (payload.job.status !== 'running') return payload.job
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return null
  }

  const writeToml = async () => {
    if (doc === null) return
    if (blockingProblems.length > 0) {
      onError(new Error(t('designer.export.blocked')))
      return
    }
    setBusy('toml')
    try {
      const payload = await callApi({ action: 'mergePanel', project: project.dir, uiToml: uiToml(doc) })
      const job = await awaitJob(payload.job.id)
      if (job?.status !== 'ok') throw new Error(job?.error ?? '写入失败')
      showToast(`${t('designer.export.write')} · ${project.slug}`)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy(null)
    }
  }

  const writeArtwork = async () => {
    if (doc === null) return
    setBusy('assets')
    try {
      const [W, H] = doc.canvas.canvas_mm
      const px = doc.canvas.px_per_mm ?? 12
      const files = []
      files.push({ name: 'panel.png', base64: await rasterize(panelSvg(doc, assets, { controls: false }), W * px, H * px) })
      for (const entry of spritePlan(doc)) {
        if (entry.file === 'panel.png') continue
        const id = entry.file.replace(/\.png$/, '')
        const svg = assets[id]
        if (svg === undefined) continue
        const [mmW, mmH] = entry.mm
        files.push({ name: entry.file, base64: await rasterize(withPixelSize(svg, mmW * px, mmH * px), mmW * px, mmH * px) })
      }
      const payload = await callApi({ action: 'writeAssets', project: project.dir, files })
      showToast(`${t('designer.export.assets')} · ${payload.written.length}`)
    } catch (failure) {
      onError(failure)
    } finally {
      setBusy(null)
    }
  }

  if (project === null || project === undefined) {
    return h('div', { style: { padding: '24px', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px' } }, t('projects.selectFirst'))
  }
  if (doc === null) {
    return h('div', { style: { padding: '24px', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px' } }, t('designer.busy'))
  }

  const inputStyle = {
    font: 'inherit', fontSize: '12px', padding: '4px 6px', borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-primary)', minWidth: 0, width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' }
  const cardStyle = {
    border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '12px',
    background: 'var(--dsw-alias-bg-layer-1)', padding: '12px', display: 'flex',
    flexDirection: 'column', gap: '8px',
  }
  const sectionTitle = { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--dsw-alias-label-secondary)' }
  const buttonStyle = {
    font: 'inherit', fontSize: '12px', padding: '4px 9px', borderRadius: '7px',
    border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-primary)', cursor: busy === null ? 'pointer' : 'default',
  }
  const primaryButton = { ...buttonStyle, background: 'var(--dsw-alias-brand-primary)', borderColor: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-bg-base)' }

  const assetOptions = (kinds) => ASSETS.filter((asset) => kinds.includes(asset.kind)).map((asset) => ({ value: asset.id, label: asset.id }))
  const pairOptions = Object.keys(SWITCH_PAIRS).map((key) => ({ value: key, label: key }))

  const renderField = (element, field) => {
    const value = field.type === 'pair'
      ? String(element.image_up ?? '').replace(/_up$/, '')
      : getPath(element, field.path)
    if (field.type === 'vec2') {
      return h('div', { key: field.path, style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' } },
        [0, 1].map((axis) => h('input', {
          key: axis,
          type: 'number',
          step: 0.1,
          style: inputStyle,
          value: Number(value?.[axis] ?? 0),
          onChange: (event) => {
            const next = [Number(value?.[0] ?? 0), Number(value?.[1] ?? 0)]
            next[axis] = Number(event.target.value)
            updateField(element, field, next)
          },
        })),
      )
    }
    if (field.type === 'asset' || field.type === 'pair' || field.type === 'param') {
      const options = field.type === 'asset'
        ? assetOptions(field.kinds ?? [])
        : field.type === 'pair'
          ? pairOptions
          : [{ value: '', label: '—' }, ...paramChoices(doc, field.paramKind).map((id) => ({ value: id, label: id }))]
      return h('select', {
        key: field.path,
        style: inputStyle,
        value: String(value ?? ''),
        onChange: (event) => updateField(element, field, event.target.value),
      }, options.map((option) => h('option', { key: option.value, value: option.value }, option.label)))
    }
    if (field.type === 'color') {
      return h('input', {
        key: field.path, type: 'color', style: { ...inputStyle, padding: '2px', height: '26px' },
        value: String(value ?? '#000000'),
        onChange: (event) => updateField(element, field, event.target.value),
      })
    }
    return h('input', {
      key: field.path, type: 'number', step: field.step ?? 0.1, style: inputStyle,
      value: Number(value ?? 0),
      onChange: (event) => updateField(element, field, Number(event.target.value)),
    })
  }

  // Out-of-canvas is a layout warning, not a broken document: flipping the
  // canvas orientation must not lock the export button.
  const blockingProblems = problems.filter((problem) => !problem.includes('超出画布'))
  const dimLayers = new Set(LAYERS.map((layer) => layer.id).filter((id) => id !== focus))
  const isLandscape = canvasSize[0] > canvasSize[1]
  const focusName = focus === null ? null : (LAYERS.find((layer) => layer.id === focus)?.name ?? focus)

  const canvasCard = (
      h('div', { style: cardStyle },
        h('div', { style: sectionTitle }, t('designer.canvas')),
        h('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
          h('span', { style: labelStyle }, t('designer.preset')),
          h('select', {
            style: inputStyle,
            value: doc.canvas.preset ?? '1590B',
            onChange: (event) => applyPreset(event.target.value),
          }, Object.keys(PRESETS).map((key) => h('option', { key, value: key }, key))),
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } },
          h('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
            h('span', { style: labelStyle }, t('designer.width')),
            h('input', {
              type: 'number', step: 0.5, style: inputStyle, value: Number(canvasSize[0]),
              onChange: (event) => setCanvasSize(0, event.target.value),
            }),
          ),
          h('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
            h('span', { style: labelStyle }, t('designer.height')),
            h('input', {
              type: 'number', step: 0.5, style: inputStyle, value: Number(canvasSize[1]),
              onChange: (event) => setCanvasSize(1, event.target.value),
            }),
          ),
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { ...labelStyle, flex: 1 } }, t('designer.orientation')),
          h('button', {
            style: buttonStyle,
            onClick: flipOrientation,
          }, `${isLandscape ? t('designer.landscape') : t('designer.portrait')} ⇄`),
        ),
        h('div', { style: labelStyle }, t('designer.orientation.hint')),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { ...labelStyle, flex: 1 } }, t('designer.background')),
          h('input', {
            type: 'color',
            style: { ...inputStyle, padding: '2px', width: '64px', height: '26px' },
            value: String(doc.canvas.background ?? '#faf1e0'),
            onChange: (event) => commit((next) => { next.canvas.background = event.target.value }),
          }),
        ),
        h('label', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
          h('span', { style: labelStyle }, t('designer.name')),
          h('input', { style: inputStyle, value: newName, placeholder: doc.name, onChange: (event) => setNewName(event.target.value) }),
        ),
        h('button', { style: buttonStyle, disabled: busy !== null, onClick: () => { void loadDesign(true) } }, t('designer.new')),
      )
  )

  const selectionCard = (
    h('div', { style: cardStyle },
      h('div', { style: sectionTitle }, `${t('designer.selection')}${selected.length === 0 ? '' : ` · ${selected.length}`}`),
      selected.length === 0
        ? h('div', { style: labelStyle }, t('designer.none'))
        : fieldsFor(selected[0].kind).map((field) => h('label', { key: field.path, style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
          h('span', { style: labelStyle }, t(field.label)),
          renderField(selected[0], field),
        )),
      selected.length === 0 ? null : h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        h('button', { style: buttonStyle, onClick: duplicateSelected }, t('designer.duplicate')),
        h('button', { style: buttonStyle, onClick: removeSelected }, t('designer.delete')),
      ),
    )
  )

  // One inspector slot at the top of the column: element properties while
  // something is selected, canvas settings only when the background layer is
  // focused and the canvas itself was clicked, and a one-line hint otherwise.
  const inspectorCard = selected.length > 0
    ? selectionCard
    : focus === 'background' && canvasClicked
      ? canvasCard
      : h('div', { style: { ...labelStyle, padding: '0 2px', fontSize: '11px' } }, t('designer.inspector.hint'))

  return h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 320px', gap: '16px', alignItems: 'start' } },
    // ---------- canvas
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 } },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        h('span', { style: sectionTitle }, `${doc.name} · ${canvasSize[0]} × ${canvasSize[1]} ${t('designer.mm')}`),
        h('span', { style: { flex: 1 } }),
        busy === null ? null : h('span', { style: labelStyle }, t('designer.busy')),
        h('button', { style: buttonStyle, disabled: busy !== null, onClick: () => { void saveDesign() } }, t('designer.save')),
        h('button', { style: primaryButton, disabled: busy !== null || blockingProblems.length > 0, onClick: () => { void writeToml() } }, t('designer.export.write')),
        h('button', { style: buttonStyle, disabled: busy !== null, onClick: () => { void writeArtwork() } }, t('designer.export.assets')),
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('div', {
          role: 'group',
          style: {
            display: 'flex', borderRadius: '8px', overflow: 'hidden',
            border: '1px solid var(--dsw-alias-border-l2)',
          },
        }, ['edit', 'preview'].map((value) => h('button', {
          key: value,
          'aria-pressed': mode === value,
          onClick: () => {
            setMode(value)
            setLayersOpen(false)
            if (value === 'preview') {
              // Preview is not an editing surface: no selection, no canvas pane.
              setSelectedIds([])
              setCanvasClicked(false)
              previewDrag.current = null
            }
          },
          style: {
            font: 'inherit', fontSize: '12px', padding: '4px 10px', cursor: 'pointer',
            border: 'none',
            background: mode === value ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-base)',
            color: mode === value ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-label-primary)',
          },
        }, t(value === 'edit' ? 'designer.mode.edit' : 'designer.mode.preview')))),
        h('div', { ref: layerMenuRef, style: { position: 'relative' } },
          h('button', {
            disabled: mode === 'preview',
            title: mode === 'preview' ? t('designer.preview.locked') : undefined,
            style: {
              ...buttonStyle,
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: mode === 'preview' ? 0.5 : 1,
              cursor: mode === 'preview' ? 'default' : 'pointer',
              borderColor: focus === null ? 'var(--dsw-alias-border-l2)' : 'var(--dsw-alias-brand-primary)',
            },
            'aria-haspopup': 'listbox',
            'aria-expanded': layersOpen,
            onClick: () => { if (mode === 'edit') setLayersOpen((open) => !open) },
          },
            h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t('designer.layers.pick')),
            h('span', { style: { fontWeight: 600 } }, focusName ?? t('designer.layers.unfocused')),
            h('span', { style: { fontSize: '9px' } }, layersOpen ? '▴' : '▾'),
          ),
          layersOpen ? h('div', {
            role: 'listbox',
            style: {
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 40,
              minWidth: '220px', padding: '6px', borderRadius: '10px',
              border: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1))',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column', gap: '2px',
            },
          },
            h('div', { style: { ...labelStyle, padding: '2px 6px 0' } }, t('designer.layers.hint')),
            h('div', { style: { ...labelStyle, fontSize: '10px', padding: '0 6px 4px', opacity: 0.75 } }, t('designer.layers.legend')),
            LAYERS.map((layer) => {
              const state = layerState(doc, layer.id)
              const focused = focus === layer.id
              const outside = outsideByLayer.get(layer.id) ?? 0
              const badge = state.hidden ? '◻' : outside > 0 ? '⚠️' : '✅'
              const badgeTitle = `${state.hidden ? t('designer.layers.show') : t('designer.layers.hide')}「${layer.name}」`
                + (outside > 0 ? ` · ${outside} 个元素超出画布` : '')
              return h('div', {
                key: layer.id,
                role: 'option',
                'aria-selected': focused,
                onClick: () => {
                  toggleFocus(layer.id)
                  setLayersOpen(false)
                },
                style: {
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                  padding: '4px 6px', borderRadius: '7px', cursor: 'pointer',
                  background: focused ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
                },
              },
                h('span', { style: { width: '10px', color: 'var(--dsw-alias-brand-primary)' } }, focused ? '●' : ''),
                h('span', { style: { flex: 1, opacity: state.hidden ? 0.5 : 1 } }, layer.name),
                h('button', {
                  type: 'button',
                  title: badgeTitle,
                  'aria-label': badgeTitle,
                  onClick: (event) => {
                    event.stopPropagation()
                    commit((next) => {
                      next.layers = next.layers ?? {}
                      next.layers[layer.id] = { ...layerState(next, layer.id), hidden: !layerState(next, layer.id).hidden }
                    })
                  },
                  style: {
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: '12px', lineHeight: 1, padding: '0 2px',
                    opacity: state.hidden ? 0.45 : 1,
                    filter: state.hidden ? 'grayscale(1)' : 'none',
                  },
                }, badge),
              )
            }),
          ) : null,
        ),
        h('span', {
          style: {
            fontSize: '12px',
            color: mode === 'preview'
              ? 'var(--dsw-alias-brand-primary)'
              : focus === null ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-label-secondary)',
          },
        }, mode === 'preview'
          ? t('designer.preview.hint')
          : focus === null
            ? t('designer.focus.none')
            : t('designer.focus.on').replace('{layer}', focusName ?? '')),
      ),
      h('div', {
        ref: canvasRef,
        'data-c2v-canvas': 'true',
        tabIndex: 0,
        onKeyDown,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        style: {
          position: 'relative', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '12px',
          overflow: 'hidden', background: 'var(--dsw-alias-bg-layer-2)', outline: 'none',
          cursor: mode === 'preview' ? 'pointer' : focus === null ? 'not-allowed' : 'default',
          touchAction: 'none',
        },
        dangerouslySetInnerHTML: {
          __html: panelSvg(doc, assets, {
            controls: true,
            values: previewValues,
            dimLayers: mode === 'preview' ? null : dimLayers,
          }).replace(
            '<svg ',
            '<svg style="width:100%;height:auto;display:block" ',
          ),
        },
      }),
      h('div', { style: labelStyle }, t('designer.hint')),
    ),
    // ---------- inspector
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      inspectorCard,
      h('div', { style: cardStyle },
        h('div', { style: sectionTitle }, t('designer.library')),
        ...libraryGroups().map((group) => {
          const dimmed = mode === 'edit' && group.layer !== focus
          return h('div', { key: group.id, style: { display: 'flex', flexDirection: 'column', gap: '4px', opacity: dimmed ? 0.45 : 1 } },
            h('div', { style: labelStyle }, `${t(group.title)} · ${group.items.length}`),
            h('div', {
              style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '4px', maxHeight: '132px', overflowY: 'auto' },
            }, group.items.map((item) => h('button', {
              key: item.key,
              title: item.key,
              onClick: () => addLibraryItem(group, item.key),
              style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                padding: '3px 2px', borderRadius: '6px', cursor: 'pointer',
                border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: '9px', lineHeight: 1.1,
                overflow: 'hidden',
              },
            },
              // The artwork is ink on transparent: it needs paper behind it, or it
              // disappears on a dark themed card.
              h('img', {
                src: assetThumb(item.thumb),
                alt: item.key,
                style: {
                  width: '100%', height: '26px', objectFit: 'contain', pointerEvents: 'none',
                  background: '#fbfaf7', borderRadius: '4px', padding: '1px', boxSizing: 'border-box',
                },
              }),
              h('span', { style: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.label),
            ))),
          )
        }),
      ),
      h('div', { style: cardStyle },
        h('div', { style: sectionTitle }, t('designer.add')),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
          h('button', { style: buttonStyle, onClick: () => addElement('frame') }, `+ ${t('designer.add.frame')}`),
          h('button', { style: buttonStyle, onClick: () => addElement('rect') }, `+ ${t('designer.add.rect')}`),
        ),
      ),
      h('div', { style: cardStyle },
        h('div', { style: sectionTitle }, t('designer.validate')),
        problems.length === 0
          ? h('div', { style: { ...labelStyle, color: 'var(--dsw-alias-state-success-primary)' } }, t('designer.valid'))
          : problems.map((problem, index) => {
            const soft = problem.includes('超出画布')
            return h('div', {
              key: index,
              style: {
                fontSize: '11px',
                color: soft ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-state-warn-primary)',
              },
            }, `• ${problem}`)
          }),
        blockingProblems.length === problems.length ? null : h('div', { style: { ...labelStyle, fontStyle: 'italic' } }, t('designer.validate.warnOnly')),
      ),
      h('div', { style: cardStyle },
        h('div', { style: sectionTitle }, t('designer.export')),
        h('textarea', {
          readOnly: true,
          value: uiText,
          style: { ...inputStyle, height: '160px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '10px', resize: 'vertical' },
        }),
      ),
    ),
  )
}
