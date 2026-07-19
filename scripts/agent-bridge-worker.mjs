#!/usr/bin/env node
/**
 * Agent Bridge Worker
 * -------------------
 * Runs on Brad's Mac. Polls the Supabase `agent_bridge_messages` table for
 * pending user messages, drives the requested terminal agent (Claude/Jack or
 * Codex), and writes the reply back so the BPE dashboard can show it.
 *
 * This is standalone. It does NOT touch Hermes / the Telegram bridge, so it
 * can't break Brad's phone link.
 *
 * Run from the repo root:  node scripts/agent-bridge-worker.mjs
 *
 * Env (reads .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL       required
 *   SUPABASE_SERVICE_ROLE_KEY      required
 *   BRIDGE_CWD                     working dir agents run in (default: ~/aether-hockey)
 *   BRIDGE_CLAUDE_CMD              default: "claude"
 *   BRIDGE_CODEX_CMD               default: "codex"
 *   BRIDGE_POLL_MS                 default: 2000
 *   BRIDGE_TIMEOUT_MS              default: 240000 (4 min per agent call)
 *   BRIDGE_HISTORY                 how many prior messages to pass as context (default: 12)
 */

import { readFileSync, unlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ---- load .env.local (simple parser, no dependency) ----
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const key = m[1]
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    // no .env.local — rely on real env
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local.')
  process.exit(1)
}

const CWD = process.env.BRIDGE_CWD || join(homedir(), 'aether-hockey')
const CLAUDE_CMD = process.env.BRIDGE_CLAUDE_CMD || 'claude'
const CODEX_CMD = process.env.BRIDGE_CODEX_CMD || 'codex'
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || 2000)
const TIMEOUT_MS = Number(process.env.BRIDGE_TIMEOUT_MS || 600000)
const HISTORY = Number(process.env.BRIDGE_HISTORY || 12)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Each agent's build(prompt) returns { cmd, args, outFile? }.
// Codex prints a noisy session preamble to stdout, so we use --output-last-message
// to capture ONLY the final reply into a temp file, then read that.
const AGENTS = {
  claude: {
    role: 'claude',
    build: (prompt) => ({ cmd: CLAUDE_CMD, args: ['-p', prompt, '--output-format', 'text'] }),
  },
  codex: {
    role: 'codex',
    build: (prompt) => {
      const outFile = join(tmpdir(), `codex-out-${Date.now()}-${Math.floor(Math.random() * 1e9)}.txt`)
      return { cmd: CODEX_CMD, args: ['exec', '--skip-git-repo-check', '-o', outFile, prompt], outFile }
    },
  },
}

function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

// Run one agent CLI call, return { ok, text }
function runAgent(agent, prompt) {
  return new Promise((resolve) => {
    const spec = agent.build(prompt)
    let out = ''
    let err = ''
    let done = false

    // If the agent wrote its clean reply to a file, prefer that over noisy stdout.
    const readReply = () => {
      if (spec.outFile) {
        try {
          const fileText = readFileSync(spec.outFile, 'utf8').trim()
          unlinkSync(spec.outFile)
          if (fileText) return fileText
        } catch {
          try { unlinkSync(spec.outFile) } catch {}
        }
      }
      return out.trim()
    }

    const child = spawn(spec.cmd, spec.args, { cwd: CWD, env: process.env })

    const timer = setTimeout(() => {
      if (done) return
      done = true
      child.kill('SIGKILL')
      resolve({ ok: false, text: `Agent timed out after ${Math.round(TIMEOUT_MS / 1000)}s.` })
    }, TIMEOUT_MS)

    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ ok: false, text: `Could not launch "${spec.cmd}": ${e.message}. Check BRIDGE_${agent.role === 'claude' ? 'CLAUDE' : 'CODEX'}_CMD.` })
    })
    child.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      const text = readReply()
      if (code === 0 && text) resolve({ ok: true, text })
      else resolve({ ok: false, text: text || err.trim() || `Agent exited with code ${code}.` })
    })
  })
}

// Build a prompt with recent thread context so the agent has continuity
async function buildPrompt(userRow) {
  const { data } = await supabase
    .from('agent_bridge_messages')
    .select('role, content, created_at')
    .eq('thread', userRow.thread)
    .lt('created_at', userRow.created_at)
    .order('created_at', { ascending: false })
    .limit(HISTORY)

  const history = (data ?? []).reverse()
  if (!history.length) return userRow.content

  const lines = history.map((m) => {
    const who = m.role === 'user' ? 'Brad' : m.role === 'claude' ? 'Jack' : m.role === 'codex' ? 'Codex' : m.role
    return `${who}: ${m.content}`
  })
  return `You are being messaged from Brad's BPE dashboard bridge. Recent conversation for context:\n\n${lines.join('\n')}\n\nBrad now says:\n${userRow.content}`
}

async function insertReply(thread, role, content, status = 'done') {
  await supabase.from('agent_bridge_messages').insert({ thread, role, content, status })
}

async function handle(userRow) {
  const targets = userRow.target === 'both' ? ['claude', 'codex'] : [userRow.target]
  log(`handling ${userRow.id} -> ${targets.join(', ')}`)

  await supabase.from('agent_bridge_messages').update({ status: 'processing' }).eq('id', userRow.id)
  const prompt = await buildPrompt(userRow)

  let anyError = false
  for (const key of targets) {
    const agent = AGENTS[key]
    if (!agent) continue
    const result = await runAgent(agent, prompt)
    await insertReply(userRow.thread, agent.role, result.text, result.ok ? 'done' : 'error')
    if (!result.ok) {
      anyError = true
      log(`  ${key} error:`, result.text.slice(0, 160))
    } else {
      log(`  ${key} replied (${result.text.length} chars)`)
    }
  }

  await supabase
    .from('agent_bridge_messages')
    .update({ status: anyError ? 'error' : 'done', error: anyError ? 'One or more agents failed — see reply.' : null })
    .eq('id', userRow.id)
}

let busy = false
async function tick() {
  if (busy) return
  busy = true
  try {
    const { data, error } = await supabase
      .from('agent_bridge_messages')
      .select('id, thread, target, content, created_at')
      .eq('role', 'user')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) {
      log('poll error:', error.message)
    } else if (data && data.length) {
      await handle(data[0])
    }
  } catch (e) {
    log('tick crashed:', e?.message || e)
  } finally {
    busy = false
  }
}

log(`Agent bridge worker up. cwd=${CWD} claude="${CLAUDE_CMD}" codex="${CODEX_CMD}" poll=${POLL_MS}ms`)
log('Waiting for dashboard messages… (Ctrl+C to stop)')
setInterval(tick, POLL_MS)
tick()
