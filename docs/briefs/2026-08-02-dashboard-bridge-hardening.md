# Dashboard Bridge Hardening (not a rebuild)

Date: 2026-08-02
Owner: Wendy → hand to Fable 5 / Ellie
Priority: P1 (blocks Brad using the dashboard as his source of truth pre-launch)

## What we THOUGHT was wrong
The dashboard chat "doesn't connect" and hangs silently. Assumed the relay
worker was dead or the whole thing needed rebuilding to match the Telegram
bridge.

## What is ACTUALLY wrong (diagnosed from logs 2026-08-02)
The bridge already works. Proof from ~/Library/Logs/agent-bridge.log:
- Worker runs under launchd (com.wendy.agent-bridge, KeepAlive, RunAtLoad) —
  already always-on, auto-restarts. PID confirmed live.
- Claude/Wendy replied fine multiple times (02:29 832 chars, 02:36 954 chars).
- Codex/Ellie replied fine (05:37, 21:28 with image).
- Image attachments download and reach the agent ("downloaded 1 attachment(s)").

Two real defects:
1. PRIMARY — Claude's OAuth token on the Mac expired at 21:27:
   `claude error: Failed to authenticate. API Error: 401 OAuth access token has
   expired. Re-authenticate to continue.`
   When Wendy's token dies, messages to 'claude' fail with NO reply and NO
   error shown in the dashboard. Ellie/'codex' keeps working, so it looks
   random. This is the "two days broken" cause.
   Immediate unstick: run `claude` in Terminal, `/login`, re-auth.
2. SECONDARY — intermittent `poll error: TypeError: fetch failed` (worker
   briefly can't reach Supabase). Self-recovers but adds flakiness.

## The fix (small, no UI rebuild)
1. Detect expired/失败 auth and agent errors in scripts/agent-bridge-worker.mjs
   and WRITE THEM BACK as the assistant reply / error status on the message row
   (status='error', error=<message>) so the dashboard shows "Wendy's Claude
   login expired — re-authenticate on the Mac" instead of hanging silent.
2. In the dashboard chat UI, render that error/status per message. NEVER silent.
   Add a per-agent "awake / working / error" indicator.
3. Add retry + backoff around the Supabase poll so transient fetch failures
   don't surface as gaps.
4. Optional: a lightweight auth-health check + notification (Telegram/push) when
   Claude's token expires, so Brad knows before he notices silence.
5. OPEN-CHANNEL "Lock talk" (DashboardVoiceDock.tsx): today locked mode still
   needs a manual Stop click before the agent responds (recognition.continuous
   = false, no silence detection). Make Lock talk a true hands-free open channel:
   after Brad stops speaking, wait a 5-SECOND pause timer, then auto-send, speak
   the reply, then auto-resume listening — loop until Brad clicks Unlock. No Stop
   click in locked mode. The 5s pause must be a single named constant (e.g.
   LOCK_TALK_PAUSE_MS = 5000) so it's trivial to tune later. Reset the timer if
   Brad keeps talking. Barge-in should still interrupt a reply.
6. Two DIFFERENT backends — keep both first-class: Wendy = Claude Code (Anthropic,
   target 'claude'); Ellie = ChatGPT/Codex (OpenAI, target 'codex'). This is not a
   Claude-only build. Voice routing (route() in DashboardVoiceDock) must reach the
   right backend per name.

## Already done — do NOT rebuild
- Always-on worker (launchd KeepAlive). ✅
- Image upload + delivery to agent. ✅
- Wendy=claude / Ellie=codex routing with build permissions. ✅
- Worker already supports BRIDGE_CWD + extra build repos (verify scope).

## Config decisions Brad confirmed (for any future work, not this fix)
- Host: MacBook now (already the case), cloud box later.
- Repo scope: all repos (aether-hockey, portfolio sites, BPE).
- Parallel with isolation: git worktrees so Wendy + Ellie don't collide.
- Deploy authority: PR + Brad greenlight, then team merges/deploys.

## Model note
Use Fable 5 or Opus 4.8 for the hardening PR — it's error-path plumbing across
worker + UI. The failure was never a model-horsepower problem; it was an expired
token plus no error visibility.
