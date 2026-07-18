# Agent Bridge — Setup & Run (Phase 1: Claude/Jack + Codex)

Talk to your terminal agents (Jack/Claude and Codex) from inside the BPE dashboard.
Standalone — does not touch Hermes / your Telegram bridge.

## How it works
1. Dashboard page `/dashboard/bridge` writes your message to a Supabase table.
2. A local worker on your Mac reads it, runs the agent CLI, writes the reply back.
3. The dashboard polls and shows the reply. Pick **Jack**, **Codex**, or **Both**.

## One-time setup

**1. Create the table.** In the Supabase SQL editor, run the contents of
`supabase/agent_bridge.sql`.

**2. Confirm your `.env.local`** (in the BPE repo root) has:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
(Both already exist for the dashboard — nothing new needed.)

**3. Optional worker config** — add to `.env.local` only if defaults are wrong:
```
BRIDGE_CWD=/Users/bradperry/aether-hockey   # repo the agents work in
BRIDGE_CLAUDE_CMD=claude                     # how you launch Claude Code
BRIDGE_CODEX_CMD=codex                       # how you launch Codex
```

## Running it

From the BPE repo root:
```
node scripts/agent-bridge-worker.mjs
```
Leave it running in a terminal (or a tmux window like your Telegram bridge).
You'll see `Agent bridge worker up…` and a log line each time it handles a message.

Then open the dashboard, go to `/dashboard/bridge`, pick who to talk to, and send.

## Notes & limits (Phase 1)
- Replies arrive as full messages, not token-by-token streaming yet.
- Each message runs a fresh headless agent call with the last ~12 messages of the
  thread passed in for context.
- If an agent fails to launch, the reply row shows the error (usually a wrong
  `BRIDGE_*_CMD`).
- The worker must be running for messages to get answered. If it's off, your
  message just sits as "queued" until you start it.

## Next phases (not built yet)
- Token streaming into the dashboard.
- Have replies flow back to Telegram too, so phone + dashboard stay in sync.
- Auto-start the worker via a LaunchAgent (like your iMessage bridge).
