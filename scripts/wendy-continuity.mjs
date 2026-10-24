import { readFileSync, existsSync, openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const WENDY_CONFIG_PATH = process.env.BRIDGE_WENDY_CONFIG || join(homedir(), '.claude', 'bpe-wendy-session.json')

export function readWendyConfig(path = WENDY_CONFIG_PATH) {
  if (!existsSync(path)) return null
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (!/^[0-9a-f-]{36}$/i.test(config.sessionId) || !config.cwd?.startsWith('/') || !config.command?.startsWith('/') || !config.model) {
    throw new Error('Invalid Wendy continuity configuration. Refusing to start a replacement session.')
  }
  return config
}

// Claude transcripts in ~/.claude/projects age out (cleanupPeriodDays, 30 by
// default), so a pinned session that goes unused for a month stops existing and
// every resume fails with "No conversation found with session ID". Recognising
// that exact message is what lets the worker re-pin itself instead of staying
// broken until someone reads the logs. Deliberately narrow: any other failure
// must NOT discard Brad's long-running conversation.
export function isMissingSessionError(text) {
  return /No conversation found with session ID/i.test(text ?? '')
}

export function writeWendyConfig(config, path = WENDY_CONFIG_PATH) {
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

// Match Telegram's Claude Max login. The BPE API key must not override it.
export function wendyEnvironment(environment) {
  const result = { ...environment }
  delete result.ANTHROPIC_API_KEY
  delete result.ANTHROPIC_AUTH_TOKEN
  delete result.ANTHROPIC_BASE_URL
  return result
}

// A live PID is not proof the worker is running. The OS recycles PIDs, so the
// number in a stale lock can end up owned by something unrelated. On 2026-10-24
// the lock held PID 832, which after a reboot belonged to Apple's postersyncd.
// process.kill(832, 0) succeeded, the lock looked valid, and the worker refused
// to start for weeks with no way to self-heal.
//
// Identity is PID + process start time. A recycled PID always has a different
// start time, which is what makes this reliable; matching on the command line
// is not, because any process whose arguments happen to mention this script
// would look like a match.
function processStartedAt(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch {
    return null // no such process, or ps failed
  }
}

function lockIsLive(raw) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { return false } // bare-PID legacy lock, treat as stale
  const { pid, started } = parsed ?? {}
  if (!Number.isSafeInteger(pid) || pid <= 0 || typeof started !== 'string') return false
  if (pid === process.pid) return false
  const current = processStartedAt(pid)
  return current !== null && current === started
}

export function acquireWorkerLock(path) {
  if (existsSync(path)) {
    // Anything we cannot positively confirm as the running worker is stale and
    // gets cleared. Refusing to start is the far worse failure: it is silent,
    // it never recovers, and the dashboard just queues messages forever.
    if (lockIsLive(readFileSync(path, 'utf8'))) {
      const { pid } = JSON.parse(readFileSync(path, 'utf8'))
      throw new Error(`Worker already running as PID ${pid}; refusing to start a second one.`)
    }
    unlinkSync(path)
  }
  const payload = JSON.stringify({ pid: process.pid, started: processStartedAt(process.pid) })
  const fd = openSync(path, 'wx', 0o600)
  writeFileSync(fd, payload)
  closeSync(fd)
  process.once('exit', () => {
    // Only remove a lock we still own, so a successor that already took over
    // does not get its lock deleted out from under it.
    try { if (JSON.parse(readFileSync(path, 'utf8')).pid === process.pid) unlinkSync(path) } catch {}
  })
}
