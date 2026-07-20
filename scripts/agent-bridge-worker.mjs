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

import { readFileSync, unlinkSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'bridge-uploads'

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
// `addDirs` = extra directories the agent's file tools may read (used so Claude
// can Read downloaded image attachments as image content blocks).
const AGENTS = {
  claude: {
    role: 'claude',
    // In the BPE dashboard bridge this agent is Wendy (not Jack).
    persona: 'You are Wendy, Brad\'s executive partner, replying in the Brad Perry Enterprises dashboard bridge. Always speak and sign as Wendy. Never call yourself Jack.',
    build: (prompt, addDirs = []) => {
      const args = ['-p', prompt, '--output-format', 'text']
      for (const d of addDirs) args.push('--add-dir', d)
      return { cmd: CLAUDE_CMD, args }
    },
  },
  codex: {
    role: 'codex',
    persona: 'You are Ellie, Brad\'s builder/execution collaborator, replying in the Brad Perry Enterprises dashboard bridge. Always speak and sign as Ellie.',
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
function runAgent(agent, prompt, addDirs = []) {
  return new Promise((resolve) => {
    const spec = agent.build(prompt, addDirs)
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

    // stdin must be closed (/dev/null), not an open pipe: codex `exec` reads
    // stdin and blocks on "Reading additional input from stdin..." until it
    // gets EOF, which otherwise never comes and the agent times out.
    const child = spawn(spec.cmd, spec.args, { cwd: CWD, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })

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
    const who = m.role === 'user' ? 'Brad' : m.role === 'claude' ? 'Wendy' : m.role === 'codex' ? 'Ellie' : m.role
    return `${who}: ${m.content}`
  })
  return `You are being messaged from Brad's BPE dashboard bridge. Recent conversation for context:\n\n${lines.join('\n')}\n\nBrad now says:\n${userRow.content}`
}

async function insertReply(thread, role, content, status = 'done') {
  await supabase.from('agent_bridge_messages').insert({ thread, role, content, status })
}

// Download a user row's image attachments from the private Storage bucket into a
// fresh temp dir. Returns { dir, files:[{path, filename}] } or null if none.
// Caller must clean up `dir`.
async function downloadAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null
  const dir = mkdtempSync(join(tmpdir(), 'bridge-att-'))
  const files = []
  for (const att of attachments) {
    if (!att?.storage_path) continue
    const { data, error } = await supabase.storage.from(BUCKET).download(att.storage_path)
    if (error || !data) {
      log('  attachment download failed:', att.storage_path, error?.message || 'no data')
      continue
    }
    const bytes = Buffer.from(await data.arrayBuffer())
    const filename = (att.filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = join(dir, `${files.length}-${filename}`)
    writeFileSync(path, bytes)
    files.push({ path, filename })
  }
  if (!files.length) {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
    return null
  }
  return { dir, files }
}

async function handle(userRow) {
  const targets = userRow.target === 'both' ? ['claude', 'codex'] : [userRow.target]
  log(`handling ${userRow.id} -> ${targets.join(', ')}`)

  await supabase.from('agent_bridge_messages').update({ status: 'processing' }).eq('id', userRow.id)
  const basePrompt = await buildPrompt(userRow)

  // Pull down any image attachments so the agent can actually see them.
  const bundle = await downloadAttachments(userRow.attachments)
  if (bundle) log(`  downloaded ${bundle.files.length} attachment(s)`)

  let anyError = false
  // Relay: on 'both', each agent runs in turn and sees the teammate's reply from
  // this same message, so they build on / challenge each other instead of
  // answering in parallel isolation. Order is targets[] (claude -> codex).
  const priorReplies = []
  const label = (key) => (key === 'claude' ? 'Wendy' : key === 'codex' ? 'Ellie' : key)
  try {
    for (const key of targets) {
      const agent = AGENTS[key]
      if (!agent) continue

      let prompt = agent.persona ? `${agent.persona}\n\n${basePrompt}` : basePrompt
      let addDirs = []
      if (bundle) {
        const list = bundle.files.map((f) => `- ${f.path}`).join('\n')
        // Claude Code's Read tool ingests these local image paths as image blocks;
        // --add-dir grants tool access to the temp dir. Codex just gets the note.
        prompt = `${prompt}\n\nBrad attached ${bundle.files.length} image(s). Read each one before replying:\n${list}`
        addDirs = [bundle.dir]
      }

      if (priorReplies.length) {
        const teammate = priorReplies
          .map((r) => `${r.who} already replied to this message:\n${r.text}`)
          .join('\n\n')
        prompt = `${prompt}\n\nYou are collaborating with your teammate in a shared room. ${teammate}\n\nBuild on or respectfully challenge their answer with your own distinct perspective. Do not just repeat what they said. Address them by name if you disagree.`
      }

      const result = await runAgent(agent, prompt, addDirs)
      await insertReply(userRow.thread, agent.role, result.text, result.ok ? 'done' : 'error')
      if (!result.ok) {
        anyError = true
        log(`  ${key} error:`, result.text.slice(0, 160))
      } else {
        priorReplies.push({ who: label(key), text: result.text })
        log(`  ${key} replied (${result.text.length} chars)`)
      }
    }
  } finally {
    if (bundle) {
      try { rmSync(bundle.dir, { recursive: true, force: true }) } catch {}
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
      .select('id, thread, target, content, attachments, created_at')
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
