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
 */

import { readFileSync, unlinkSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
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

// Full build permissions for the dashboard bridge. A headless bridge cannot
// answer interactive permission prompts, so Claude runs with bypassPermissions
// and Codex with a workspace-write sandbox (matches the Telegram bridge, without
// the prompt friction that used to stall it). Extra repos the agents may build in
// are granted to Claude via --add-dir from BRIDGE_ADD_DIRS (default: the dashboard
// repo, so the dashboard can fix itself). Set BRIDGE_BYPASS_PERMISSIONS=0 to
// disable the bypass, or BRIDGE_CODEX_SANDBOX=read-only to make Codex read-only.
const BYPASS_PERMISSIONS = process.env.BRIDGE_BYPASS_PERMISSIONS !== '0'
const ADD_DIRS = (process.env.BRIDGE_ADD_DIRS || '/Users/bradperry/brad-perry-enterprises')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const CODEX_SANDBOX = process.env.BRIDGE_CODEX_SANDBOX || 'workspace-write'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ---- Session persistence ----
// Stores { "thread-uuid": { "claude": "session-uuid", "codex": "session-uuid" } }
const SESSIONS_FILE = join(homedir(), 'brad-perry-enterprises', '.bridge-sessions.json')

function loadSessions() {
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveSessions(sessions) {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8')
  } catch (e) {
    log('warn: could not save sessions file:', e.message)
  }
}

// Loaded once at startup, mutated in place, saved after each successful reply.
const sessions = loadSessions()

// Each agent's build(prompt, sessionId, addDirs) returns { cmd, args, outFile? }.
// Codex prints a noisy session preamble to stdout, so we use --output-last-message
// to capture ONLY the final reply into a temp file, then read that.
// `addDirs` = extra directories the agent's file tools may read (used so Claude
// can Read downloaded image attachments as image content blocks).
const AGENTS = {
  claude: {
    role: 'claude',
    // In the BPE dashboard bridge this agent is Wendy (not Jack).
    persona: 'You are Wendy, Brad\'s executive partner, replying in the Brad Perry Enterprises dashboard bridge. Always speak and sign as Wendy. Never call yourself Jack.',
    build: (prompt, sessionId, addDirs = []) => {
      const args = []
      if (BYPASS_PERMISSIONS) args.push('--permission-mode', 'bypassPermissions')
      // Session resumption: first turn uses --session-id to create a named session;
      // subsequent turns use -r to resume it so claude remembers tool outputs and
      // chained work across turns (mirrors the Telegram bridge behaviour).
      if (sessionId) {
        args.push('-r', sessionId)
      } else {
        args.push('--session-id', randomUUID())
      }
      args.push('-p', prompt, '--output-format', 'text')
      for (const d of [...ADD_DIRS, ...addDirs]) args.push('--add-dir', d)
      return { cmd: CLAUDE_CMD, args }
    },
  },
  codex: {
    role: 'codex',
    persona: 'You are Ellie, Brad\'s builder/execution collaborator, replying in the Brad Perry Enterprises dashboard bridge. Always speak and sign as Ellie.',
    build: (prompt, sessionId) => {
      const outFile = join(tmpdir(), `codex-out-${Date.now()}-${Math.floor(Math.random() * 1e9)}.txt`)
      let args
      if (sessionId) {
        // Resume an existing Codex session.
        args = ['exec', 'resume', sessionId, '--skip-git-repo-check', '--sandbox', CODEX_SANDBOX, '--cd', CWD, '-o', outFile]
      } else {
        // First turn: start a fresh exec with --json so we can parse the session ID
        // from the JSONL event stream (codex emits session metadata early in output).
        args = ['exec', '--skip-git-repo-check', '--sandbox', CODEX_SANDBOX, '--cd', CWD, '--json', '-o', outFile, prompt]
      }
      return { cmd: CODEX_CMD, args, outFile }
    },
  },
}

// Canonical team + routing. Keep in sync with lib/agentSystemPrompt.ts (TEAM_AND_ROUTING).
const TEAM_AND_ROUTING = `TEAM & ROUTING (single source of truth, identical across every surface):
- Wendy = COO (Anthropic/Claude). Strategy, operations, content in Brad's voice, decisions, honest pushback, and design/brand/aesthetic direction. The high-value, high-stakes work.
- Ellie = CTO / executive (ChatGPT GPT-5 + Codex). Builder, research, implementation. Owns ALL code, repo execution, ops, image generation, realtime voice, and fast/bulk work. Jack's former engineering role is folded into Ellie. Ellie is a first-class executive, never a fallback.
- Cost logic: Ellie is cheaper, so route volume and execution to Ellie and reserve the big work (strategy, design, brand voice, hard decisions) for Wendy/Opus. Design direction stays with Wendy; Ellie implements it.
- Cleaver = Gemini (its local Ollama is currently unreachable). Sam = Gemini. Supporting workers, parked.
- Cross-provider failover runs in BOTH directions and is nobody's identity.
- Single source of truth for work = the bpe_tasks board in this dashboard. The old AI_Team agent_tasks relay is retired.`

// Pull a compact live snapshot of the dashboard board so bridge agents share the
// same context as the dashboard chat agents. Also includes last 6 agent replies
// from agent_bridge_messages for cross-session awareness. Never throws — returns '' on error.
async function buildTeamContext() {
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date())
    const [{ data: tasks }, { data: inbox }, { data: recentReplies }] = await Promise.all([
      supabase.from('bpe_tasks').select('title, status, priority, brand, notes').neq('status', 'done'),
      supabase.from('bpe_inbox').select('content').order('created_at', { ascending: false }).limit(6),
      supabase
        .from('agent_bridge_messages')
        .select('role, content, created_at')
        .neq('role', 'user')
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(6),
    ])
    const rank = { high: 0, medium: 1, low: 2 }
    const taskLines = (tasks ?? [])
      .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3))
      .slice(0, 20)
      .map((t) => `  - [${t.status}/${t.priority}] ${t.title}${t.brand ? ` (${t.brand})` : ''}${t.notes ? ` — ${String(t.notes).slice(0, 160)}` : ''}`)
      .join('\n')
    const inboxLines = (inbox ?? []).map((i) => `  - ${i.content}`).join('\n')
    const replyLines = (recentReplies ?? [])
      .map((r) => `  - [${r.role}] ${String(r.content).slice(0, 200)}`)
      .join('\n')

    return [
      `LIVE DASHBOARD BOARD for ${today} (bpe_tasks, the single source of truth):\n${taskLines || '  (no open tasks)'}`,
      `\nRECENT INBOX / NOTES:\n${inboxLines || '  (empty)'}`,
      replyLines ? `\nRECENT BRIDGE REPLIES (last 6 agent messages, for cross-session awareness):\n${replyLines}` : '',
    ].join('')
  } catch {
    return ''
  }
}

function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

// Build a simple user prompt that lets the agent's session handle history natively.
// This replaces the old 12-message history injection — claude's --session-id/-r flags
// give it real tool-output continuity without text-dumping the whole thread.
function buildUserPrompt(userRow, teamContext, persona) {
  const contextBlock = teamContext ? `${TEAM_AND_ROUTING}\n\n${teamContext}` : TEAM_AND_ROUTING
  return `${persona}\n\n${contextBlock}\n\n${userRow.content}`
}

// Parse the Codex JSONL stdout stream and extract a session ID from the event
// metadata it emits early in the stream (looks for session_id or id field).
function parseCodexSessionId(jsonlText) {
  const lines = jsonlText.split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      if (obj && typeof obj === 'object') {
        if (typeof obj.session_id === 'string' && obj.session_id) return obj.session_id
        if (typeof obj.id === 'string' && obj.id && obj.type) return obj.id
      }
    } catch {
      // not JSON, skip
    }
  }
  return null
}

// Run one agent CLI call, return { ok, text, rawStdout }
function runAgent(agent, prompt, sessionId, addDirs = []) {
  return new Promise((resolve) => {
    const spec = agent.build(prompt, sessionId, addDirs)
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
      resolve({ ok: false, text: `Agent timed out after ${Math.round(TIMEOUT_MS / 1000)}s.`, rawStdout: out })
    }, TIMEOUT_MS)

    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ ok: false, text: `Could not launch "${spec.cmd}": ${e.message}. Check BRIDGE_${agent.role === 'claude' ? 'CLAUDE' : 'CODEX'}_CMD.`, rawStdout: out })
    })
    child.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      const text = readReply()
      if (code === 0 && text) resolve({ ok: true, text, rawStdout: out })
      else resolve({ ok: false, text: text || err.trim() || `Agent exited with code ${code}.`, rawStdout: out })
    })
  })
}

// Extract the actual session ID that was passed to --session-id in the claude args,
// so we can store it for future -r resumption.
function extractClaudeSessionId(args) {
  const idx = args.indexOf('--session-id')
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return null
}

async function insertReply(thread, role, content, status = 'done') {
  await supabase.from('agent_bridge_messages').insert({ thread, role, content, status })
}

// Turn a raw agent failure into a clear, actionable message the dashboard can
// show Brad instead of a silent hang. The #1 cause is an expired CLI login.
function friendlyAgentError(key, raw) {
  const text = (raw || '').toString().trim()
  const who = key === 'claude' ? 'Wendy' : key === 'codex' ? 'Ellie' : key
  const cli = key === 'codex' ? 'Codex' : 'Claude'
  const cmd = key === 'codex' ? 'codex' : 'claude'
  if (/401|oauth|unauthor|authenticate|token has expired|access token/i.test(text)) {
    return `${who}'s ${cli} login on the Mac has expired. Open Terminal, run \`${cmd}\`, then /login to reconnect. (${text.slice(0, 140)})`
  }
  if (/credit balance|insufficient|quota|billing/i.test(text)) {
    const acct = key === 'codex' ? 'OpenAI' : 'Anthropic'
    return `${who} is connected but the ${acct} account is out of credits. Top it up to continue. (${text.slice(0, 140)})`
  }
  if (/timed out/i.test(text)) {
    return `${who} took too long and timed out. Try again, or break the request into a smaller step.`
  }
  if (/could not launch|BRIDGE_/i.test(text)) {
    return `${who}'s agent could not start on the Mac. ${text.slice(0, 180)}`
  }
  return `${who} hit an error: ${text.slice(0, 200)}`
}

// Friendly stale-session error — tells Brad to resend once.
function staleSessionError(key) {
  const who = key === 'claude' ? 'Wendy' : key === 'codex' ? 'Ellie' : key
  return `${who}'s session got stale — send the message again and I'll start fresh.`
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

  // Shared context so bridge Wendy/Ellie see the same team + live board as the
  // dashboard chat agents. teamContext is '' if the fetch fails — never blocks.
  const teamContext = await buildTeamContext()

  // Pull down any image attachments so the agent can actually see them.
  const bundle = await downloadAttachments(userRow.attachments)
  if (bundle) log(`  downloaded ${bundle.files.length} attachment(s)`)

  let anyError = false
  let lastError = null
  // Relay: on 'both', each agent runs in turn and sees the teammate's reply from
  // this same message, so they build on / challenge each other instead of
  // answering in parallel isolation. Order is targets[] (claude -> codex).
  const priorReplies = []
  const label = (key) => (key === 'claude' ? 'Wendy' : key === 'codex' ? 'Ellie' : key)
  try {
    for (const key of targets) {
      const agent = AGENTS[key]
      if (!agent) continue

      // Session continuity: look up existing session for this thread+agent.
      const threadSessions = sessions[userRow.thread] ?? {}
      const existingSessionId = threadSessions[key] ?? null

      // Build the user prompt — simple, clean. claude's session handles history natively.
      let basePrompt = buildUserPrompt(userRow, teamContext, agent.persona)

      let addDirs = []
      if (bundle) {
        const list = bundle.files.map((f) => `- ${f.path}`).join('\n')
        // Claude Code's Read tool ingests these local image paths as image blocks;
        // --add-dir grants tool access to the temp dir. Codex just gets the note.
        basePrompt = `${basePrompt}\n\nBrad attached ${bundle.files.length} image(s). Read each one before replying:\n${list}`
        addDirs = [bundle.dir]
      }

      let prompt = basePrompt
      if (priorReplies.length) {
        const teammate = priorReplies
          .map((r) => `${r.who} already replied to this message:\n${r.text}`)
          .join('\n\n')
        prompt = `${prompt}\n\nYou are collaborating with your teammate in a shared room. ${teammate}\n\nBuild on or respectfully challenge their answer with your own distinct perspective. Do not just repeat what they said. Address them by name if you disagree.`
      }

      const result = await runAgent(agent, prompt, existingSessionId, addDirs)

      if (!result.ok) {
        if (existingSessionId) {
          // Stale session — clear it and return a friendly nudge to retry.
          delete sessions[userRow.thread][key]
          if (Object.keys(sessions[userRow.thread]).length === 0) delete sessions[userRow.thread]
          saveSessions(sessions)
          const friendly = staleSessionError(key)
          await insertReply(userRow.thread, agent.role, friendly, 'error')
          anyError = true
          lastError = friendly
          log(`  ${key} stale session cleared`)
        } else {
          // No existing session — surface a proper error message.
          const friendly = friendlyAgentError(key, result.text)
          await insertReply(userRow.thread, agent.role, friendly, 'error')
          anyError = true
          lastError = friendly
          log(`  ${key} error:`, result.text.slice(0, 160))
        }
      } else {
        // Success — store or update the session ID.
        if (!sessions[userRow.thread]) sessions[userRow.thread] = {}
        if (key === 'claude') {
          // For a new session, extract the ID we generated in build() via --session-id.
          // For a resumed session (-r), the session ID is unchanged.
          if (!existingSessionId) {
            const spec = agent.build(prompt, null, addDirs)
            const newId = extractClaudeSessionId(spec.args)
            if (newId) {
              sessions[userRow.thread][key] = newId
              log(`  claude new session: ${newId}`)
            }
          }
        } else if (key === 'codex') {
          // For Codex, parse the session ID from the JSONL stdout if this was a fresh exec.
          if (!existingSessionId) {
            const parsedId = parseCodexSessionId(result.rawStdout)
            if (parsedId) {
              sessions[userRow.thread][key] = parsedId
              log(`  codex new session: ${parsedId}`)
            }
          }
        }
        saveSessions(sessions)

        await insertReply(userRow.thread, agent.role, result.text, 'done')
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
    .update({ status: anyError ? 'error' : 'done', error: anyError ? (lastError || 'One or more agents failed — see reply.') : null })
    .eq('id', userRow.id)
}

// Poll for the next pending message, retrying transient network blips a couple
// times with short backoff so an occasional "fetch failed" never surfaces as a
// missed message or log spam. Returns the supabase result of the last attempt.
async function selectPending(retries = 2) {
  let last
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await supabase
      .from('agent_bridge_messages')
      .select('id, thread, target, content, attachments, created_at')
      .eq('role', 'user')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
    if (!last.error) return last
    if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
  }
  return last
}

let busy = false
async function tick() {
  if (busy) return
  busy = true
  try {
    const { data, error } = await selectPending()

    if (error) {
      log('poll error (after retries):', error.message)
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
log(`Sessions file: ${SESSIONS_FILE} (${Object.keys(sessions).length} thread(s) loaded)`)
log('Waiting for dashboard messages… (Ctrl+C to stop)')
setInterval(tick, POLL_MS)
tick()
