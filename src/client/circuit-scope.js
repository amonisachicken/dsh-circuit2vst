/**
 * Simulation dialog and scope for the circuit designer (M5).
 *
 * The Host runs ngspice (`src/host/sim.js`); this module owns the interaction and
 * the two pieces of maths the upstream app does in Rust:
 *
 * - `circuitFftSpectrum`: uniform resample → Hann → FFT → single-sided RMS dB →
 *   log frequency axis with max pooling (port of `backend/src/fft.rs`). The FFT
 *   here is radix-2 with zero padding, so the bin spacing is finer than the
 *   upstream N-point transform while the amplitude calibration stays `4/n`.
 * - `circuitPlot`: the scope drawing (port of `frontend/src/plot.ts`): 5×4 grid,
 *   legend, optional log-x and dB axes.
 *
 * THD is computed on the Host with the upstream formula; this module just shows
 * it next to the summary.
 */

/** Series colours, cycled like the upstream scope. */
const PLOT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2']

/**
 * In-place radix-2 FFT (length must be a power of two).
 * @param re - real parts, mutated.
 * @param im - imaginary parts, mutated.
 */
function fftRadix2(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let start = 0; start < n; start += length) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < length / 2; k += 1) {
        const a = start + k
        const b = a + length / 2
        const vRe = re[b] * curRe - im[b] * curIm
        const vIm = re[b] * curIm + im[b] * curRe
        re[b] = re[a] - vRe
        im[b] = im[a] - vIm
        re[a] += vRe
        im[a] += vIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

/**
 * Linear interpolation on a sorted time axis (clamped at the ends).
 * @param x - sorted times.
 * @param y - values.
 * @param t - query time.
 * @returns interpolated value.
 */
function interpolate(x, y, t) {
  if (t <= x[0]) return y[0]
  if (t >= x[x.length - 1]) return y[y.length - 1]
  let low = 0
  let high = x.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (x[mid] <= t) low = mid
    else high = mid
  }
  const span = x[high] - x[low]
  if (span === 0) return y[low]
  const ratio = (t - x[low]) / span
  return y[low] + (y[high] - y[low]) * ratio
}

/**
 * Single-sided spectrum on a log frequency axis.
 * @param x - time axis (seconds).
 * @param y - samples (volts).
 * @param maxFreq - upper frequency limit.
 * @returns `{f, db}` with 200 log-spaced points.
 */
function circuitFftSpectrum(x, y, maxFreq) {
  if (x.length < 4 || x.length !== y.length) throw new Error('波形数据不足')
  const steps = []
  for (let index = 1; index < x.length; index += 1) {
    const step = x[index] - x[index - 1]
    if (step > 0) steps.push(step)
  }
  if (steps.length === 0) throw new Error('波形时间步长为 0')
  steps.sort((left, right) => left - right)
  const dt = steps[Math.floor(steps.length / 2)]
  const sampleRate = 1 / dt

  const t0 = x[0]
  const t1 = x[x.length - 1]
  const count = Math.max(4, Math.round((t1 - t0) / dt)) + 1
  const uniform = new Array(count)
  for (let index = 0; index < count; index += 1) uniform[index] = interpolate(x, y, t0 + index * dt)
  const mean = uniform.reduce((sum, value) => sum + value, 0) / count

  let size = 1
  while (size < count) size <<= 1
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let index = 0; index < count; index += 1) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (count - 1)))
    re[index] = (uniform[index] - mean) * window
  }
  fftRadix2(re, im)

  const freqs = []
  const dbs = []
  for (let index = 0; index < size / 2; index += 1) {
    const frequency = (index * sampleRate) / size
    if (frequency > maxFreq) break
    const amplitude = (4 * Math.hypot(re[index], im[index])) / count
    const rms = amplitude / Math.SQRT2
    freqs.push(frequency)
    dbs.push(rms > 1e-12 ? 20 * Math.log10(rms) : -140)
  }
  if (freqs.length < 2) throw new Error('频谱点数不足')

  const points = 200
  const fMin = sampleRate / size
  const fMax = Math.max(Math.min(maxFreq, freqs[freqs.length - 1]), fMin)
  const logF = []
  for (let index = 0; index < points; index += 1) {
    const ratio = index / (points - 1)
    logF.push(fMin * (fMax / fMin) ** ratio)
  }
  const indexOf = (frequency) => Math.min(dbs.length - 1, Math.max(0, Math.round((frequency / sampleRate) * size)))
  const logDb = logF.map((frequency, index) => {
    const low = index === 0 ? fMin : logF[index - 1]
    const high = index === points - 1 ? fMax : logF[index + 1]
    const lowIndex = indexOf(low)
    const highIndex = indexOf(high)
    if (lowIndex > highIndex) return dbs[indexOf(frequency)]
    let best = -Infinity
    for (let bin = lowIndex; bin <= highIndex; bin += 1) best = Math.max(best, dbs[bin])
    return best
  })
  return { f: logF, db: logDb }
}

/** Number of ticks on the x axis. */
const X_TICKS = 5
/** Number of horizontal grid lines. */
const Y_TICKS = 4

/**
 * Scope plot: plain SVG, no dependencies.
 * @param props.series - `[{name, x[], y[]}]`.
 * @param props.logX - log frequency axis.
 * @param props.db - dB values on the y axis.
 * @param props.width - pixel width.
 * @param props.height - pixel height.
 * @param props.xUnit - x axis unit (`s` for transient, `Hz` for AC/FFT).
 * @param props.t - translator.
 */
function CircuitPlot({ series, logX, db, width, height, xUnit, t }) {
  const pad = { left: 52, right: 12, top: 12, bottom: 26 }
  const innerW = Math.max(10, width - pad.left - pad.right)
  const innerH = Math.max(10, height - pad.top - pad.bottom)
  const xs = series.flatMap((entry) => entry.x)
  const ys = series.flatMap((entry) => entry.y)
  const xRawMin = Math.min(...xs)
  const xRawMax = Math.max(...xs)
  let yMin = Math.min(...ys, 0)
  let yMax = Math.max(...ys)
  if (!(yMax > yMin)) { yMax += 1; yMin -= 1 }
  const yPad = (yMax - yMin) * 0.05
  yMin -= yPad
  yMax += yPad

  const useLog = logX === true
  const xMin = useLog ? Math.log10(Math.max(xRawMin, 1e-12)) : xRawMin
  const xMax = useLog ? Math.log10(Math.max(xRawMax, 1e-12)) : xRawMax
  const safeSpan = xMax > xMin ? xMax - xMin : 1
  const px = (value) => pad.left + ((useLog ? Math.log10(Math.max(value, 1e-12)) : value) - xMin) / safeSpan * innerW
  const py = (value) => pad.top + innerH - ((value - yMin) / (yMax - yMin)) * innerH

  const grid = []
  for (let index = 0; index <= Y_TICKS; index += 1) {
    const y = pad.top + (innerH * index) / Y_TICKS
    grid.push({ key: `gy${index}`, x1: pad.left, y1: y, x2: pad.left + innerW, y2: y })
  }
  for (let index = 0; index <= X_TICKS; index += 1) {
    const x = pad.left + (innerW * index) / X_TICKS
    grid.push({ key: `gx${index}`, x1: x, y1: pad.top, x2: x, y2: pad.top + innerH })
  }

  /** Compact axis label. */
  const format = (value) => {
    if (Math.abs(value) < 1e-9) return '0'
    const magnitude = Math.abs(value)
    if (magnitude >= 1000) return value.toFixed(0)
    if (magnitude >= 10) return value.toFixed(1)
    if (magnitude >= 0.1) return value.toFixed(2)
    if (magnitude >= 0.001) return value.toFixed(3)
    return value.toExponential(0)
  }

  const yLabels = []
  for (let index = 0; index <= Y_TICKS; index += 1) {
    const value = yMin + ((yMax - yMin) * (Y_TICKS - index)) / Y_TICKS
    yLabels.push({ key: `yl${index}`, y: pad.top + (innerH * index) / Y_TICKS + 3, text: db ? `${value.toFixed(0)}` : format(value) })
  }
  const xLabels = []
  for (let index = 0; index <= X_TICKS; index += 1) {
    const ratio = index / X_TICKS
    const value = useLog ? 10 ** (xMin + safeSpan * ratio) : xMin + (xMax - xMin) * ratio
    xLabels.push({ key: `xl${index}`, x: pad.left + innerW * ratio, text: format(value) })
  }

  const node = (tag, props, ...children) => React.createElement(tag, props, ...children)
  return node('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { display: 'block' } },
    node('rect', { x: 0, y: 0, width, height, fill: '#ffffff' }),
    grid.map((line) => node('line', {
      key: line.key, x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, stroke: '#e2e8f0', strokeWidth: 1,
    })),
    yLabels.map((label) => node('text', {
      key: label.key, x: pad.left - 6, y: label.y, textAnchor: 'end', fontSize: 9, fill: '#64748b',
    }, label.text)),
    xLabels.map((label) => node('text', {
      key: label.key, x: label.x, y: pad.top + innerH + 14, textAnchor: 'middle', fontSize: 9, fill: '#64748b',
    }, label.text)),
    series.map((entry, index) => {
      const path = entry.x.map((x, point) => `${point === 0 ? 'M' : 'L'}${px(x).toFixed(1)} ${py(entry.y[point]).toFixed(1)}`).join(' ')
      return node('path', {
        key: entry.name, d: path, fill: 'none',
        stroke: PLOT_COLORS[index % PLOT_COLORS.length], strokeWidth: 1.4,
      })
    }),
    series.map((entry, index) => node('g', { key: `${entry.name}-legend` },
      node('line', {
        x1: pad.left + index * 96, y1: pad.top - 4, x2: pad.left + 12 + index * 96, y2: pad.top - 4,
        stroke: PLOT_COLORS[index % PLOT_COLORS.length], strokeWidth: 2,
      }),
      node('text', { x: pad.left + 16 + index * 96, y: pad.top - 1, fontSize: 10, fill: '#334155' }, entry.name),
    )),
    node('text', {
      x: pad.left + innerW / 2, y: height - 2, textAnchor: 'middle', fontSize: 9, fill: '#94a3b8',
    }, xUnit ?? (useLog ? 'Hz' : 's')),
    node('text', {
      x: 12, y: pad.top + innerH / 2, textAnchor: 'middle', fontSize: 9, fill: '#94a3b8',
      transform: `rotate(-90 12 ${pad.top + innerH / 2})`,
    }, db ? 'dB' : 'V'),
  )
}

/**
 * Simulation dialog: parameters, scope, FFT and the batch log.
 * @param props.open - whether the dialog is shown.
 * @param props.onClose - close handler.
 * @param props.api - `{simulate(request)}`.
 * @param props.cir - generated netlist.
 * @param props.ports - `{in, out}`.
 * @param props.probes - extra probe nets (test points).
 * @param props.signals - `{amp, freq}` from the IN part.
 * @param props.onSignals - persist edited generator settings into the IN part.
 * @param props.focus - `{net, label}` when opened from OUT / a test point.
 * @param props.t - translator.
 * @param props.onError - error reporter.
 */
function CircuitSimDialog({ open, onClose, api, cir, ports, probes, signals, onSignals, focus, t, onError }) {
  const [kind, setKind] = React.useState('tran')
  // Transient timing is edited in milliseconds; seconds are only sent to ngspice.
  const [step, setStep] = React.useState('0.01')
  const [start, setStart] = React.useState('0')
  const [duration, setDuration] = React.useState('20')
  const [points, setPoints] = React.useState('100')
  const [fStart, setFStart] = React.useState('10')
  const [fStop, setFStop] = React.useState('100000')
  // IN 兼作波形发生器：幅值和频率在弹窗里改，改完写回 IN 元件（只用于仿真）。
  const [amp, setAmp] = React.useState(String(signals?.amp ?? 0.2))
  const [freq, setFreq] = React.useState(String(signals?.freq ?? 1000))
  const [result, setResult] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [showFft, setShowFft] = React.useState(false)
  const [showLog, setShowLog] = React.useState(false)
  /** Latest `run` for the focus effect below (effects must not depend on it). */
  const runRef = React.useRef(null)

  // Double-clicking OUT / a test point opens the instrument on that net: run
  // once so the scope shows a waveform instead of an empty panel.
  React.useEffect(() => {
    if (!open) return
    if (focus === null || focus === undefined) return
    runRef.current?.()
  }, [open, focus])

  if (!open) return null

  const run = async () => {
    setBusy(true)
    try {
      const params = kind === 'tran'
        ? {
          step: Number(step) / 1000,
          start: Number(start) / 1000,
          duration: Number(duration) / 1000,
          amp: Number(amp),
          freq: Number(freq),
        }
        : { points: Number(points), fStart: Number(fStart), fStop: Number(fStop), amp: Number(amp), freq: Number(freq) }
      const payload = await api.simulate({ cir, ports, kind, params, probes })
      setResult(payload)
      setShowFft(false)
    } catch (failure) {
      onError(failure)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  /** 示波器只画被双击的那个网络；OUT 额外带输入做对照（与上游一致）。 */
  const focusSeries = (() => {
    if (result === null || focus === null || focus === undefined) return null
    const want = `v(${focus.net})`.toLowerCase()
    const picked = result.traces.filter((trace) => trace.name.toLowerCase() === want)
    if (focus.net.toLowerCase() !== 'out') return picked
    const input = result.traces.find((trace) => /v\(in\)/i.test(trace.name))
    return input === undefined || picked.length === 0 ? picked : [...picked, input]
  })()

  runRef.current = run

  const frequencySeries = (() => {
    if (result === null || !showFft) return null
    const source = (focusSeries ?? []).find((trace) => !/v\(in\)/i.test(trace.name))
      ?? result.traces.find((trace) => /v\(out\)/i.test(trace.name))
      ?? result.traces[0]
    if (source === undefined) return null
    try {
      const spectrum = circuitFftSpectrum(source.x, source.y, 20000)
      return [{ name: `${source.name} FFT`, x: spectrum.f, y: spectrum.db }]
    } catch {
      return null
    }
  })()

  const node = (tag, props, ...children) => React.createElement(tag, props, ...children)
  const label = { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' }
  const input = {
    font: 'inherit', fontSize: '12px', padding: '3px 6px', borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-primary)', width: '86px', boxSizing: 'border-box',
  }
  const button = {
    font: 'inherit', fontSize: '12px', padding: '4px 9px', borderRadius: '7px',
    border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
  }

  return node('div', {
    style: {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 7,
      width: 'min(760px, 92%)', maxHeight: '90%', overflow: 'auto',
      background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: '12px', padding: '14px', boxShadow: '0 12px 32px rgba(15,23,42,.22)',
      display: 'flex', flexDirection: 'column', gap: '10px',
    },
    onPointerDown: (event) => { event.stopPropagation() },
    onWheel: (event) => { event.stopPropagation() },
  },
    node('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      node('div', { style: { fontSize: '13px', fontWeight: 600, flex: 1 } },
        focus === null || focus === undefined
          ? t('sim.title')
          : `${focus.label} · ${t('sim.scope')} v(${focus.net.toLowerCase()})`),
      result === null ? null : node('span', { style: label },
        `${result.traces.length ? result.traces[0].x.length : 0} 点${result.thd === null ? '' : ` · THD = ${(result.thd * 100).toFixed(2)}%`}`),
      node('button', { style: { ...button, padding: '0 6px' }, onClick: onClose }, '×')),
    node('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
      node('span', { style: label }, t('sim.analysis')),
      node('select', { style: { ...input, width: 'auto' }, value: kind, onChange: (event) => setKind(event.target.value) },
        node('option', { value: 'tran' }, '瞬态 tran'),
        node('option', { value: 'ac' }, '频响 ac')),
      node('button', { style: { ...button, opacity: busy ? 0.5 : 1 }, disabled: busy, onClick: () => { void run() } },
        busy ? t('sim.running') : t('sim.run')),
      node('span', { style: label }, `${t('sim.amp')} (V)`),
      node('input', {
        style: { ...input, width: '64px' },
        value: amp,
        onChange: (event) => { setAmp(event.target.value); onSignals?.({ amp: Number(event.target.value), freq: Number(freq) }) },
      }),
      node('span', { style: label }, `${t('sim.freq')} (Hz)`),
      node('input', {
        style: { ...input, width: '72px' },
        value: freq,
        onChange: (event) => { setFreq(event.target.value); onSignals?.({ amp: Number(amp), freq: Number(event.target.value) }) },
      }),
      node('span', { style: { ...label, flex: 1 } }, `${t('sim.stimulus')}: ${t('sim.generatorHint')}`),
    ),
    focus === null || focus === undefined
      ? node('div', { style: { ...label, opacity: 0.8 } }, t('sim.instrumentHint'))
      : null,
    kind === 'tran'
      ? node('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
        node('span', { style: label }, `${t('sim.step')} (ms)`),
        node('input', { style: input, value: step, onChange: (event) => setStep(event.target.value) }),
        node('span', { style: label }, `${t('sim.start')} (ms)`),
        node('input', { style: input, value: start, onChange: (event) => setStart(event.target.value) }),
        node('span', { style: label }, `${t('sim.duration')} (ms)`),
        node('input', { style: input, value: duration, onChange: (event) => setDuration(event.target.value) }))
      : node('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
        node('span', { style: label }, 'points'),
        node('input', { style: input, value: points, onChange: (event) => setPoints(event.target.value) }),
        node('span', { style: label }, 'f start'),
        node('input', { style: input, value: fStart, onChange: (event) => setFStart(event.target.value) }),
        node('span', { style: label }, 'f stop'),
        node('input', { style: input, value: fStop, onChange: (event) => setFStop(event.target.value) })),
    result === null
      ? node('div', { style: { ...label, padding: '10px 0' } }, t('sim.hint'))
      : node('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        node('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          node('button', {
            style: { ...button, background: showFft ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-base)', color: showFft ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-label-primary)' },
            onClick: () => setShowFft((value) => !value),
          }, frequencySeries === null ? t('sim.fft') : t('sim.fft')),
          node('span', { style: label }, `${result.traces.map((trace) => trace.name).join(' · ')}`),
          node('span', { style: { flex: 1 } }),
          node('button', { style: button, onClick: () => setShowLog((value) => !value) }, t('sim.log'))),
        node(CircuitPlot, {
          series: frequencySeries ?? focusSeries ?? result.traces,
          logX: frequencySeries !== null || kind === 'ac',
          db: frequencySeries !== null,
          width: 700,
          height: 240,
          xUnit: frequencySeries !== null || kind === 'ac' ? 'Hz' : 's',
          t,
        }),
        showLog ? node('pre', {
          style: {
            margin: 0, maxHeight: '120px', overflow: 'auto', fontSize: '10px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--dsw-alias-label-secondary)',
          },
        }, result.log === '' ? result.cir : `${result.log}\n\n${result.cir}`) : null),
  )
}
