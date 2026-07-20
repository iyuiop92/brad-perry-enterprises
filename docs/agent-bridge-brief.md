# Brief: Operate Claude/Jack + Codex from inside the BPE Dashboard

**Owner:** Jack (build) · greenlit by Brad
**Status:** PARKED — do not start until Aether Hockey launch + Aether's Edge clear. Revenue first.
**Date:** 2026-07-18

## Goal
Let Brad drive his two daily-driver terminal coding agents — Claude/Jack and Codex — directly from the BPE dashboard chat, the same way he talks to Wendy on Telegram today. Kill the app-switching (Telegram for Claude, separate app for Codex, neither aware of the dashboard).

## Why this is smaller than it looks
The hard part already exists. The Hermes bridge (`~/.hermes/hermes-agent`) already connects a chat channel (Telegram/iMessage) to a live terminal Claude Code session on Brad's Mac. We are NOT rebuilding that. We are adding one more transport: a web doorway from the dashboard chat into the same pipeline, with responses streamed back into the dashboard UI.

## Scope — Phase 1 (Claude / Jack only)
1. **Web transport into Hermes.** Add a "web" channel so a message typed in the BPE dashboard reaches the same terminal Claude Code session the Telegram bridge drives. Reuse Hermes; do not fork it.
2. **Dashboard chat surface.** New panel (or repurpose the Wendy panel) that posts to the transport and streams the agent reply token-by-token. Match existing drawer UX.
3. **Auth lock.** Only Brad can drive it. Gate behind the existing `bpe_dashboard_session` cookie AND a server-side check; never expose the relay publicly.
4. **Session reliability.** Assume the Mac stays awake via existing tmux + caffeinate. Surface a clear "agent offline / session not reachable" state in the UI instead of hanging.
5. **Cloud→local relay.** Dashboard is on Vercel (cloud); agents run on Brad's Mac. Use the relay/tunnel Hermes already relies on. Document the exact path.

## Scope — Phase 2 (Codex)
Same pattern, second doorway into a Codex session. Codex plugs in differently than Claude Code — budget extra wiring + testing. Ship Phase 1 usable first.

## Explicitly OUT of scope (for now)
- Cleaver and Sam dashboard→terminal bridges (Brad will wait on these).
- Any change to how the four existing chat workers (Wendy/Ellie/Cleaver/Sam) behave.

## Cost note
No new meaningful token cost. Same Claude/Codex sessions Brad already pays for daily — just a different front door. Relay infra ≈ zero.

## Definition of done (Phase 1)
Brad types a build request in the BPE dashboard, Jack executes it against the real repo with full tool access, and the streamed reply appears in the dashboard — no Telegram, no app switch. Locked to Brad only.
