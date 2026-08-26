---
title: Content Intake Pipeline (Brain Dump to Enriched Card)
owner: Brad
author: Wendy
build: Jack
date: 2026-07-26
status: greenlit, ready to build
repo: brad-perry-enterprises (BPE dashboard)
---

# Content Intake Pipeline

## The point in one line
Brad captures a raw content idea by voice or text inside the dashboard (or over Telegram), it becomes a card in the existing Video Pipeline instantly, and Wendy enriches that rough card into a full launch package (tailored captions per platform, free-tier article angle, paid-tier angle) on demand. Capture the second it hits, shape it later. Built for how Brad works.

## Why now
Every idea Brad and Wendy build currently lives in a Telegram thread that scrolls away. The dashboard already has the bones to fix this. We are connecting pieces that mostly exist, not inventing a new system.

## What already exists (do not rebuild)
- `components/VideoPipelinePanel.tsx` — the pipeline board, status flow: idea, research, planned, filmed, edited, published.
- `video_ideas` table + `supabase/migrations/video_ideas.sql`.
- `app/api/video-ideas/route.ts` — GET and POST, protected by `requireAuth`. `[id]` route for updates.
- `lib/types.ts` — `VideoIdea` interface, `VideoIdeaStatus` type.
- `components/DashboardVoiceDock.tsx` — voice capture surface.
- `components/QuickChatComposer.tsx` — text capture surface.
- `supabase/migrations/agent_bridge.sql` — the agent bridge (Hermes) that lets an agent worker act on dashboard data. Wendy = the Claude worker.

## Build it in three parts

### Part 1 — Capture creates a card
- Add a "New content idea" action to DashboardVoiceDock and QuickChatComposer.
- Voice path: reuse whatever transcription DashboardVoiceDock already uses. If it only records, add a transcription step (Whisper or the local Ollama path Brad already runs). Voice note becomes text.
- On submit, POST to `/api/video-ideas` and create a card with:
  - `status: 'idea'`
  - `title`: first line of the dump, or an auto-summary if long
  - `research_notes`: the full raw transcript/text, untouched
  - everything else empty
- The card shows up in the Video Pipeline board immediately in the Idea column.

### Part 2 — Data model additions
Extend `video_ideas` (new migration, do not edit the existing one) with:
- `captions_by_platform` jsonb — one entry per platform: instagram, facebook, tiktok, youtube, threads, linkedin. Each holds the tailored caption text.
- `brief_path` text — relative path to a matching markdown brief (e.g. `docs/briefs/2026-07-26-stops-and-starts-32-mistakes.md`) so the card, article, and captions all connect.
- `enrichment_status` text — one of `raw`, `requested`, `enriched`. Defaults to `raw`.
Update `VideoIdea` in `lib/types.ts` to match.

### Part 3 — Wendy enrichment
- Add a "Send to Wendy to shape" button on each card (and a matching action from Telegram).
- Clicking it sets `enrichment_status: 'requested'` and drops a job on the agent bridge for the Claude/Wendy worker.
- Wendy reads `research_notes`, writes back: `social_media` summary, `captions_by_platform` (all six, tailored), `free_tier` angle, `paid_tier` angle, and moves the card to `planned` with `enrichment_status: 'enriched'`.
- Enrichment writes go through the same authed API / bridge path, not a raw table write.

## Calls I made — override any of these
1. **Enrichment is manual, not automatic.** A card is NOT auto-shaped the moment it is created. Brad hits "Send to Wendy" when he wants it. Reason: some dumps are personal asides or half-thoughts (the "side note" rule), and Wendy should not churn tokens shaping every stray idea. Recommend keeping it manual.
2. **Raw dump is preserved forever** in `research_notes`. Enrichment adds, never overwrites the original words.
3. **One card = one content package** across all platforms and tiers, not one card per platform. Matches how the pipeline already thinks.
4. **Telegram is a first-class capture and trigger surface,** equal to the dashboard. Same idea can be created and sent-to-Wendy from either.

## Part 4 — Model-agnostic enrichment (redundancy)
Brad's requirement: enrichment must not be single-threaded on one agent. If Wendy (Claude) is unavailable, the process continues.

- **Extract the shaping logic into a shared spec.** Create `docs/specs/content-shaping-spec.md` holding the full instruction set for turning a raw dump into a finished card: Brad's voice rules (contractions, no em dashes, no markdown, "Aether Hockey" spacing, "almost always/almost never" framing, exclude "side note" asides), the six target platforms and their tone, the diagnosis (free tier) vs cure (paid tier) split, and the output field mapping. This is the source of truth. Any worker loads it and produces the same result. Losing any single agent loses nothing.
- **Make the enrichment worker pluggable.** The "Send to Wendy to shape" action routes an enrichment job through the agent bridge to a selectable worker:
  - Wendy (Claude) — primary/default
  - Ellie (OpenAI/ChatGPT) — fallback
  - Both load the same `content-shaping-spec.md`.
- **Automatic failover.** If the primary worker errors or is unreachable after a short retry, the job re-routes to the fallback worker automatically, and the card notes which worker shaped it.
- **Manual override.** Brad can pick the worker per card, or set a global default, from the card UI and from Telegram.
- **Codex, accurately.** Per how the dashboard actually works, Codex is a clipboard prompt-builder, not an autonomous chat worker. Its role here is the manual escape hatch: it builds a ready-to-paste shaping prompt (raw dump + the spec) that Brad can drop into any external model and paste the result back into the card. So the redundancy ladder is: Wendy auto, Ellie auto-fallback, Codex manual last resort. This guarantees Brad can always finish a card by hand even if every bridge is down.

## Acceptance criteria
- Brad can speak or type an idea in the dashboard and see a card appear in the Idea column within seconds, raw text intact.
- Brad can do the same from Telegram.
- Each card can hold six per-platform captions and a link to a brief.
- Hitting "Send to Wendy" produces an enriched card (captions, free/paid angles) and moves it to planned, without losing the original dump.
- Nothing bypasses `requireAuth`.
- A raw card can be enriched by Wendy (Claude) or Ellie (OpenAI), both loading `content-shaping-spec.md`, with equivalent output.
- If the primary worker is down, the job fails over to the fallback automatically and records which worker did the work.
- Codex can produce a paste-ready shaping prompt as a manual last resort.

## Out of scope for this build
- Auto-posting to Blotato from the card (separate build, the Blotato skill covers publishing).
- AI video generation.
- Migrating old ideas in bulk.

## First test card
Seed the stops-and-starts package (title, six captions, free/paid angles, brief_path to the stops brief) as the first enriched card so we can watch the whole flow end to end on real content.
