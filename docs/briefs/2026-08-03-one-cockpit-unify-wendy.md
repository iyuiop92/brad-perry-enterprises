# One Cockpit: Unify Wendy Across Telegram + Dashboard

Date: 2026-08-03
Owner: Wendy → build after Aether launch settles (Brad may start tomorrow after the fighting post publishes)
Priority: P2 (not launch-blocking; the core already works via the Bridge)
Risk: MEDIUM. Touches the live relay worker and the voice path — both hot zones. Do NOT rush this into launch night.

## The goal in one line
Make the dashboard the real cockpit: every way Brad talks to Wendy (text, Quick voice, Deep voice) reaches the SAME real agent — the one he talks to in Telegram — with shared memory across both surfaces.

## What ALREADY works today (do not rebuild)
- The "Message Wendy" bar (components/QuickChatComposer.tsx) and the Bridge page (app/dashboard/bridge/page.tsx) POST to /api/bridge with target 'claude' → the REAL `claude` CLI via scripts/agent-bridge-worker.mjs. Same agent as Telegram; reads the same global ~/.claude/CLAUDE.md + memory.
- Deep voice mode (DashboardVoiceDock) also routes to the Bridge (real agent).
- The worker injects the last 12 thread messages (buildPrompt, BRIDGE_HISTORY) so the dashboard conversation has continuity already.
- Cross-surface "same Wendy" persona: buildAgentSystemPrompt('wendy') for API surfaces; the Bridge's claude reads global CLAUDE.md + memory. Persona aligned (no signoff, no em dashes) as of 2026-08-02.

## What is NOT unified yet (the actual work)

### Piece 1 — Quick voice should hit the real agent, not the chatbot
Today DashboardVoiceDock Quick mode calls /api/room/reply (Anthropic API, persona only, NO tools, NO memory). Deep mode calls the Bridge (real agent). Brad wants one Wendy, so Quick should also be the real agent — OR Quick stays as the fast "just chat" tier and is clearly labeled as such.
- Decision needed from Brad: collapse Quick into the real Bridge agent (slower, but real + tools + memory), or keep a labeled two-tier (fast chat vs real builder)?
- Files: components/DashboardVoiceDock.tsx (route Quick through deepReply path), app/api/room/reply/route.ts.
- RISK: this is the file the parallel mobile-voice team keeps changing. Coordinate / rebase onto latest main first (see 2026-08-02 collision that forced a re-do).

### Piece 2 — Deeper session memory in the Bridge worker (optional, marginal)
Worker spawns `claude -p` fresh each message with injected history. Telegram's wendy-bridge.ts keeps a stateful session per chat (`--session-id` new, `-r <id>` resume, `--output-format json`, persisted to a sessions JSON, auto-reset on non-zero exit while resuming). Mirroring that in the worker gives true working-memory continuity (tool state, not just text history).
- Files: scripts/agent-bridge-worker.mjs — add a sessions map keyed by `thread`, persisted to a JSON file; special-case the claude agent to use session flags + json output + parse `parsed.result`. Leave Codex as-is (different session model).
- Reference: ~/.claude/channels/telegram/wendy-bridge.ts askWendy() is the exact pattern to copy.
- RISK: changes the live relay's core exec (text → json, adds resume flags). Test end-to-end locally (restart worker, send two messages via the DB, confirm the 2nd shows memory of the 1st) BEFORE relying on it. Merge without auto-restarting the production worker; Brad restarts when ready via `launchctl kickstart -k gui/$(id -u)/com.wendy.agent-bridge`.
- Marginal value: injected history already gives conversational continuity. Only do this if Brad wants deeper persistence.

### Piece 3 — Live shared memory across Telegram AND dashboard (the real prize)
Today the ONLY shared layer between Telegram-Wendy and dashboard-Wendy is the global memory files + CLAUDE.md. This is NOT live conversation sync — the dashboard can't see what was said in Telegram in real time, and vice versa.
- Option A (lighter): a shared conversation log table both surfaces read recent context from. The Telegram bridge and the dashboard Bridge worker both append their turns to it and inject the recent cross-surface tail into each prompt. Gives "she knows what we said on the other channel."
- Option B (heavier): a single canonical thread/session that both surfaces attach to (shared session id + shared store). More work, more correctness edge cases.
- Recommendation: Option A. It is additive, low-risk, and delivers the felt outcome ("one Wendy who remembers everything, everywhere") without unifying runtimes.
- Files: new Supabase table (e.g. wendy_shared_log: surface, role, content, created_at); write hooks in scripts/agent-bridge-worker.mjs and ~/.claude/channels/telegram/wendy-bridge.ts; read/inject in both buildPrompt paths.

## Recommended sequence
1. Piece 3 Option A (shared log) — highest felt value, lowest risk, additive.
2. Piece 1 — decide the Quick-voice question, then wire it (coordinate with mobile-voice branch).
3. Piece 2 — only if deeper persistence is still wanted after 3 + injected history.

## Definition of done
- From the dashboard, Brad talks to Wendy (text and voice) and it is the real agent with tools + memory.
- Wendy references something said in Telegram while in the dashboard (and vice versa) — proving shared memory.
- No regression to the live relay or the mobile voice work. Verify with a real device for voice.

## Guardrails
- Rebase onto latest main before touching DashboardVoiceDock or the worker — parallel Codex worktrees change these often.
- Merge behind PR + preview; do not restart the production worker automatically. Brad restarts on his say-so.
- Server TTS (/api/room/speak, ElevenLabs) is confirmed healthy — voice failures are client/iOS or double-trigger, not the server.
