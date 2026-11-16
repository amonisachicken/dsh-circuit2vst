/**
 * Environment doctor.
 *
 * The plugin does not try to fix a machine: it reports what is present, what
 * the current platform needs for "generate" and for "package", and one copyable
 * hint per missing piece. Packaging capability is delegated to the packer's own
 * `doctor.sh`; this file only checks the prerequisites it can see cheaply.
 */
import { release } from 'node:os'
import { join } from 'node:path'
import { firstLine, run, which } from './exec.js'

const MIN_PYTHON = [3, 11]

/**
 * Parse `Python 3.11.4` into a comparable triple.
 * @param version - the first line of `python3 --version`.
 * @returns major/minor/patch, or null.
 */
function parsePython(version) {
  const match = /^Python\s+(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  if (match === null) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Compare a triple against the minimum the framework's tooling needs.
 * @param triple - candidate version.
 * @returns whether it satisfies the minimum.
 */
function pythonAtLeast(triple) {
  if (triple === null) return false
  for (let index = 0; index < MIN_PYTHON.length; index += 1) {
    if (triple[index] > MIN_PYTHON[index]) return true
    if (triple[index] < MIN_PYTHON[index]) return false
  }
  return true
}

/**
 * Read the ngspice version out of its banner.
 * @returns `ngspice-47`-style text, or null when the binary is absent.
 */
async function probeNgspice() {
  const result = await run('ngspice', ['-v'], { timeoutMs: 15000 })
  const text = `${result.stdout}${result.stderr}`
  const match = /ngspice-([0-9][0-9.]*)/i.exec(text)
  if (match !== null) return `ngspice-${match[1]}`
  return result.ok ? 'ngspice' : null
}

/**
 * Shape one doctor row.
 * @param id - stable identifier.
 * @param label - human label.
 * @param status - ok | missing | warn.
 * @param detail - what was found.
 * @param hint - what to do when it is not ok.
 * @param required - whether packaging needs it.
 * @returns the row.
 */
function row(id, label, status, detail, hint, required = false) {
  return { id, label, status, detail, hint, required }
}

/**
 * Probe the toolchain for the current host.
 * @param settings - resolved plugin settings.
 * @returns checks plus the two readiness answers.
 */
export async function probeEnvironment(settings) {
  const platform = process.platform
  const isMac = platform === 'darwin'
  const isWindows = platform === 'win32'

  // Windows ships `python`, not `python3`; the framework only needs 3.11+.
  const [git, python, cargo, rustup, cmake, clt, ngspice, docker] = await Promise.all([
    firstLine('git', ['--version']),
    firstLine('python3', ['--version']).then(async (found) => found ?? firstLine('python', ['--version'])),
    firstLine('cargo', ['--version']),
    firstLine('rustup', ['--version']),
    isMac ? firstLine('cmake', ['--version']) : Promise.resolve(null),
    isMac ? firstLine('xcode-select', ['-p']) : Promise.resolve(null),
    probeNgspice(),
    firstLine('docker', ['--version']),
  ])

  const checks = []
  checks.push(row('git', 'git', git === null ? 'missing' : 'ok', git ?? '未安装', '安装 Xcode 命令行工具或 Git', true))

  const pythonTriple = parsePython(python)
  checks.push(row(
    'python3',
    'python3 ≥ 3.11',
    python === null ? 'missing' : pythonAtLeast(pythonTriple) ? 'ok' : 'warn',
    python ?? '未安装',
    pythonAtLeast(pythonTriple) ? '' : '框架的 plugin_meta.py 需要 python3 ≥ 3.11（brew install python）',
    true,
  ))

  checks.push(row('cargo', 'Rust cargo', cargo === null ? 'missing' : 'ok', cargo ?? '未安装', 'https://rustup.rs', true))

  if (isMac) {
    const targets = rustup === null
      ? null
      : (await run('rustup', ['target', 'list', '--installed'], { timeoutMs: 20000 })).stdout
        .split('\n').map(line => line.trim()).filter(Boolean)
    const needed = ['aarch64-apple-darwin', 'x86_64-apple-darwin']
    const missing = targets === null ? needed : needed.filter(target => !targets.includes(target))
    checks.push(row(
      'rustup',
      'rustup + universal targets',
      targets !== null && missing.length === 0 ? 'ok' : 'missing',
      targets === null ? '未安装 rustup' : (missing.length === 0 ? needed.join(' + ') : `缺 ${missing.join(' / ')}`),
      'rustup target add aarch64-apple-darwin x86_64-apple-darwin（universal 产物需要两个 target）',
      true,
    ))
    checks.push(row('cmake', 'cmake ≥ 3.20', cmake === null ? 'missing' : 'ok', cmake ?? '未安装', 'brew install cmake（AU 的 clap-wrapper 外壳要它）', true))
    checks.push(row('xcode-clt', 'Xcode Command Line Tools', clt === null ? 'missing' : 'ok', clt ?? '未安装', 'xcode-select --install', true))
  }

  if (isWindows) {
    // The framework scripts and the Windows packer are bash scripts: without a
    // bash on PATH (Git Bash / MSYS2) neither can start at all.
    const bash = await which('bash')
    checks.push(row(
      'bash', 'bash（Git Bash / MSYS2）',
      bash === null ? 'missing' : 'ok',
      bash ?? '未找到 bash：框架脚本与 Windows 打包器都无法启动',
      '安装 Git for Windows（含 Git Bash）或 MSYS2，并确保 bash 在 PATH 里',
      true,
    ))
    // Probe the VS C++ toolchain directly: hard-coding this row as a warning kept
    // `canGenerate` false forever, because readiness only accepts `ok`.
    const vswhere = join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Microsoft Visual Studio', 'Installer', 'vswhere.exe',
    )
    const vswhereResult = await run(vswhere, [
      '-latest', '-products', '*',
      '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property', 'installationPath',
    ], { timeoutMs: 20000 })
    const vsPath = vswhereResult.ok ? vswhereResult.stdout.trim() : ''
    checks.push(row(
      'msvc', 'MSVC 工具链',
      vsPath === '' ? 'missing' : 'ok',
      vsPath === '' ? '没找到 Visual Studio 的 C++ 工具链' : `${vsPath}（打包器 doctor.sh 会再校验一次）`,
      '安装 Visual Studio Build Tools 2022，勾选「使用 C++ 的桌面开发」',
      true,
    ))
  }

  const nihPlugList = cargo === null ? null : (await run('cargo', ['--list'], { timeoutMs: 30000 })).stdout
  const hasNihPlug = nihPlugList === null ? false : /(^|\n)\s*nih-plug\b/.test(nihPlugList)
  checks.push(row(
    'cargo-nih-plug',
    'cargo nih-plug 子命令',
    hasNihPlug ? 'ok' : 'missing',
    hasNihPlug ? '已安装' : '未安装',
    'cargo install --git https://github.com/robbert-vdh/nih-plug.git --rev de42101 cargo-nih-plug --locked',
    true,
  ))

  checks.push(row(
    'ngspice',
    'ngspice（可选）',
    ngspice === null ? 'missing' : 'ok',
    ngspice === null ? '未安装：电路设计器的【仿真】与对拍不可用' : ngspice,
    'brew install ngspice；缺失只影响仿真与 ngspice 对拍，不影响生成与打包',
    false,
  ))
  checks.push(row(
    'docker',
    'docker（可选）',
    docker === null ? 'missing' : 'ok',
    docker ?? '未安装：无法在本机验证 Linux 产物',
    '用于在 macOS 上真实验证 rustomp-linux-plugin；不装只少一条验证路径',
    false,
  ))

  const canGenerate = checks.filter(check => check.required && check.id !== 'cmake').every(check => check.status === 'ok')
  const canPack = checks.filter(check => check.required).every(check => check.status === 'ok')

  return {
    platform,
    arch: process.arch,
    osRelease: release(),
    platformLabel: platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform,
    checks,
    canGenerate,
    canPack,
    missingRequired: checks.filter(check => check.required && check.status !== 'ok').map(check => check.id),
  }
}

/**
 * Human wording for one check, shared by the panel and the tool.
 * @param check - a doctor row.
 * @returns a single line.
 */
export function describeCheck(check) {
  const state = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'
  return `${state} ${check.label}: ${check.detail}`
}

/**
 * Confirm a command exists before an action builds on it.
 * @param command - executable name.
 * @returns whether it is on PATH.
 */
export async function requireCommand(command) {
  const found = await which(command)
  if (found === null) throw new Error(`缺少命令 ${command}：请先安装，或在面板里查看环境体检的提示`)
  return found
}
