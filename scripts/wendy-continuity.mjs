import { readFileSync, existsSync, openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs'
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

// Match Telegram's Claude Max login. The BPE API key must not override it.
export function wendyEnvironment(environment) {
  const result = { ...environment }
  delete result.ANTHROPIC_API_KEY
  delete result.ANTHROPIC_AUTH_TOKEN
  delete result.ANTHROPIC_BASE_URL
  return result
}

export function acquireWorkerLock(path) {
  if (existsSync(path)) {
    const pid = Number(readFileSync(path, 'utf8'))
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid worker lock; inspect before restarting.')
    try { process.kill(pid, 0) }
    catch (error) {
      if (error.code !== 'ESRCH') throw error
      unlinkSync(path)
    }
  }
  const fd = openSync(path, 'wx', 0o600)
  writeFileSync(fd, String(process.pid))
  closeSync(fd)
  process.once('exit', () => { try { if (readFileSync(path, 'utf8') === String(process.pid)) unlinkSync(path) } catch {} })
}
