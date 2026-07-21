# Brief: Voice room shares the dashboard brain + Quick/Deep Bridge toggle

**Date:** 2026-07-21
**Repo:** brad-perry-enterprises (BPE dashboard)
**Requested by:** Brad — greenlit
**Author:** Wendy

## Why

The voice dock (`components/DashboardVoiceDock.tsx` → `/api/room/reply`) is the only agent surface in the dashboard that does NOT read the shared live context. Every text agent route (`/api/dashboard/wendy|ellie|sam|cleaver`) already loads `getDashboardContext()` from `lib/dashboardContext.ts` and builds a rich system prompt with portfolio identity + live task/day/health/inbox state. Voice only gets 18 raw task titles and a thin persona string, so it feels disconnected and has no idea what we're working on.

This brief plugs voice into the exact same shared brain (Brad's "one and three"): portfolio identity (1) + live dashboard state (3) in one move, with zero drift from the text agents.

## Scope — do all four

### 1. Extract ONE shared system-prompt builder (single source of truth)
- The rich `system` string built inline in `app/api/dashboard/wendy/route.ts` (and the Ellie equivalent) should move into a shared helper, e.g. `lib/agentSystemPrompt.ts`, exporting something like `buildAgentSystemPrompt(agent: 'wendy'|'ellie', dashboardContext)`.
- Refactor the existing dashboard chat routes to import from this helper (no behavior change — same prompt they build today).
- This helper file IS the "shared file both agents understand." Everything reads it.

### 2. Point the voice room at the shared brain
- In `app/api/room/reply/route.ts`:
  - Add `requireAuth()` (route currently has no auth) to obtain `supabase`.
  - Call `getDashboardContext(supabase)` and feed it through `buildAgentSystemPrompt()` for both `wendyReply` and `ellieReply`, replacing the thin `WENDY_SYSTEM` / `ELLIE_SYSTEM` constants and the current `context` string injection.
  - Keep the VOICE_RULES layer (short, spoken, no markdown, no em-dashes, lead with the answer) appended AFTER the shared prompt — voice still needs to sound spoken, not written.
- In `app/dashboard/page.tsx` line 69: the `context={tasks.slice(0,18)...}` prop becomes redundant once the route loads full context server-side. Remove or leave as a lightweight hint — route-side context wins.

### 3. Quick / Deep toggle in the voice dock
- Add a subtle tappable colored-text toggle in `DashboardVoiceDock.tsx` (match the existing Pomodoro-timer style; 10px radius per house rule).
- **Quick** (default): current fast path — `/api/room/reply`, now context-aware, 2–4s replies.
- **Deep**: post the utterance to the Bridge (`/api/bridge`, `agent_bridge_messages`, target `claude` for Wendy / `codex` for Ellie). Poll for the reply, then run it through `/api/room/speak` so it's read aloud like any other voice reply.
- Deep replies are slow (headless `claude -p` / `codex exec`, up to minutes). Show a clear persistent "the real agent is working…" state on the orb so it never looks frozen. Do NOT block Quick input while a Deep call is pending.

### 4. Fill in the BPE repo AGENTS.md
- `brad-perry-enterprises/AGENTS.md` is currently just a stray Next.js note. Mirror the real team charter + portfolio + repo rules from `~/aether-hockey/AGENTS.md` so Ellie/Codex has full context when working IN this repo (not just when driven through the Bridge in aether-hockey). Keep the Next.js-version warning block.

### 5. Fix the "Go deeper" focused panel — it renders broken
Current bug (`DashboardVoiceDock.tsx` line 135, the `<aside>`): in focused mode the panel is a right-anchored floating box over a busy dashboard. It reads as broken because (a) it visually bleeds with the board behind it and (b) when empty it's just a large box showing "Ready". Brad's screenshot: unreadable overlap.

Fix — **focused mode becomes a centered modal** (Brad chose centered):
- When `focused` is true, render the panel as a centered modal: `position: fixed`, centered via `inset: 0` flex container OR `left/top: 50%` + transform. Width ~`min(680px, calc(100vw - 48px))`, `maxHeight: calc(100vh - 96px)`, `overflowY: auto`.
- Add a full-screen **backdrop** behind it: `position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); zIndex` just below the modal. Clicking the backdrop closes focused mode (same as Compact). This kills the bleed-through — the board is clearly behind, dimmed.
- Modal background must be **fully opaque** (e.g. `#0a0a12` / `rgba(4,4,10,1)`), solid border, 10px radius (house rule, not 12), clear title row with the × close.
- Compact (non-focused) mode can stay as the small corner dock it is today — just ensure its background is fully opaque too so it never bleeds.
- Give the modal real content: the Quick/Deep toggle (section 3), the conversation transcript (reuse the existing `showText` log list, shown by default in focused mode), and the status line. No more empty "Ready" box.
- Radius: replace the `borderRadius: 12` with `10` to match [[feedback_border_radius]].

## Guardrails
- No behavior change to the existing text agent routes beyond the refactor to the shared helper — verify Wendy/Ellie/Sam/Cleaver chat still answer identically.
- `room/reply` gaining `requireAuth()` means the voice dock must call it authenticated (it already runs inside the authed dashboard — confirm the fetch carries the session).
- `npx tsc --noEmit` clean before commit. Feature branch + PR. Wendy squash-merges on green.

## Out of scope (parked)
- The "Current Focus" manual note (option two) — the live dashboardContext already covers current focus automatically.
- Feeding raw recent Bridge transcript into Quick — dashboardContext is the shared layer for now; revisit only if Brad wants voice to recall specific Bridge exchanges verbatim.
