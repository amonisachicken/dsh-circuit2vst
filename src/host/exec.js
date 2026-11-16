/**
 * Process helpers every Host action shares.
 *
 * The rust toolchain installed by `rustup` lives in `~/.cargo/bin`, which is
 * not on the PATH of a GUI-launched Harness. Every child therefore gets a PATH
 * with that directory first, so `cargo`, `rustup` and the packers' scripts see
 * the same toolchain the user sees in a terminal.
 */
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

const CARGO_BIN = join(homedir(), '.cargo', 'bin')

/**
 * Build the PATH child processes should inherit.
 * @param path - an existing PATH value, defaults to the current process one.
 * @returns PATH with `~/.cargo/bin` in front exactly once.
 */
/**
 * Path form for shell scripts: MSYS2/Git Bash tools write the value into files
 * (a Cargo.toml `path =`), where a Windows backslash is an escape character.
 * `..\.deps\rustomp` becomes `../.deps/rustomp`; the drive letter stays.
 * @param value - absolute or relative path.
 * @returns the path with forward slashes on Windows, unchanged elsewhere.
 */
export function scriptPath(value) {
  const text = String(value ?? '')
  return process.platform === 'win32' ? text.replace(/\\/g, '/') : text
}

export function shellPath(path = process.env.PATH) {
  const current = String(path ?? '')
  const parts = current.split(delimiter).filter(Boolean)
  if (parts.includes(CARGO_BIN)) return current
  return [CARGO_BIN, ...parts].join(delimiter)
}

/**
 * Run one command and capture its output.
 * @param command - executable.
 * @param args - argument vector, never a shell string.
 * @param options - cwd, timeout, extra environment.
 * @returns a settled result; a non-zero exit is reported, never thrown.
 */
export function run(command, args = [], options = {}) {
  const { cwd, timeoutMs = 120000, env } = options
  return new Promise((resolvePromise) => {
    const startedAt = Date.now()
    let child
    try {
      child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: shellPath(), ...(env ?? {}) },
      })
    } catch (error) {
      resolvePromise({
        ok: false, code: -1, stdout: '', stderr: String(error), command, args, ms: 0,
      })
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const settle = (result) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      resolvePromise(result)
    }
    const timer = timeoutMs > 0
      ? setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, timeoutMs)
      : undefined
    child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', (error) => settle({
      ok: false, code: -1, stdout, stderr: `${stderr}${error.message}`, command, args, ms: Date.now() - startedAt,
    }))
    child.on('close', (code) => settle({
      ok: !timedOut && code === 0,
      code: code ?? -1,
      timedOut,
      stdout,
      stderr,
      command,
      args,
      ms: Date.now() - startedAt,
    }))
  })
}

/**
 * Read the first line a command prints on either stream.
 * @param command - executable.
 * @param args - argument vector.
 * @returns that line, or null when the command is absent or failed.
 */
export async function firstLine(command, args) {
  const result = await run(command, args, { timeoutMs: 15000 })
  if (!result.ok) return null
  const text = (result.stdout.trim() === '' ? result.stderr : result.stdout).trim()
  const line = text.split('\n')[0]?.trim() ?? ''
  return line === '' ? null : line
}

/**
 * Resolve a command exactly as a child of this Host would.
 * @param command - executable name.
 * @returns its path, or null when it is not installed.
 */
export async function which(command) {
  const result = process.platform === 'win32'
    ? await run('where', [command], { timeoutMs: 10000 })
    : await run('sh', ['-c', `command -v ${command}`], { timeoutMs: 10000 })
  if (!result.ok) return null
  const found = result.stdout.trim().split('\n')[0]?.trim() ?? ''
  return found === '' ? null : found
}

/**
 * Run a shell script shipped by the ecosystem.
 *
 * The framework and the Windows packer are bash scripts; on Windows they run
 * under Git Bash/MSYS2, where `bash` resolves from PATH (the packer's own
 * doctor checks that). Elsewhere the script is executable on its own.
 * @param script - absolute path of the shell script.
 * @param args - script arguments.
 * @param options - cwd, timeout, extra environment.
 * @returns the command result, with `command` naming the script.
 */
export async function runScript(script, args = [], options = {}) {
  const command = process.platform === 'win32' ? 'bash' : script
  const argv = process.platform === 'win32' ? [script, ...args] : args
  const result = await run(command, argv, options)
  return { ...result, command: script }
}

/**
 * Keep a log at a useful size without hiding that it was cut.
 * @param text - accumulated text.
 * @param limit - character bound.
 * @returns the text, or its tail with a leading marker.
 */
export function tail(text, limit = 20000) {
  if (text.length <= limit) return text
  return `…（前 ${text.length - limit} 字符已省略）\n${text.slice(-limit)}`
}
