# Brief: Paperclip image upload on the dashboard Bridge chat

**Date:** 2026-07-20
**Author:** Wendy
**Status:** Greenlit by Brad — images first, video as a fast-follow
**Why:** Brad wants to move his daily Wendy conversations from Telegram to the BPE dashboard. The ONLY blocker is the ability to attach images (screenshots) the way he does over Telegram. The dashboard **Bridge** chat already routes to the same Claude Code worker as Telegram (via the `agent_bridge_messages` Supabase queue), so this is the correct surface — it keeps full Wendy (tools + memory), unlike the voice page or the tiered-model chat.

## The 3 coordinated pieces (all required — a button alone that Wendy can't read is worse than nothing)

1. **Upload UI** — `app/dashboard/bridge/page.tsx`: add a paperclip button + hidden `<input type="file" accept="image/*">` (allow multiple). Show a thumbnail preview chip before send; allow removing before send. Keep the current text box + target selector. Match design tokens (black base, #00b4ff accent, 10px radius, no gradients — the repo AGENTS/design rules).

2. **Store + queue** — `app/api/bridge/route.ts` POST: accept optional `attachments`. Store image bytes in **Supabase Storage** (private bucket, e.g. `bridge-uploads/`), NOT inline base64 in the DB row (rows are polled 200 at a time — base64 would bloat every poll). Add an `attachments jsonb` column to `agent_bridge_messages` (migration) holding `[{storage_path, mime, filename}]`. Keep the existing text `content` (can be empty if only an image is sent — relax the "Message is empty" guard when attachments exist). GET should return `attachments` so the UI can render sent thumbnails.

3. **Worker reads the image** — the local Claude Code bridge worker (the same process that services Telegram; see wendy-bridge / reference_telegram_model_config) must, when a queued message has attachments, fetch them from Supabase Storage (signed URL or service-role download) and pass them to Claude as image content blocks so Wendy actually sees them. This is the linchpin — coordinate with wherever the worker lives (likely outside this repo). If the worker code isn't reachable in this repo, flag it and open a companion issue/PR against the worker so both land together.

## Constraints
- Read `node_modules/next/dist/docs/` first — this repo runs a modified Next (see AGENTS.md). Confirm route-handler + upload conventions before coding.
- `npx tsc --noEmit` clean. Feature branch + PR + preview. Never push to main.
- Auth: reuse `requireAuth` on the API — uploads must be behind Brad's login.
- Private storage bucket; do not expose uploaded images publicly.

## Also in this PR — bump the chat text size (Brad's comfort ask)
The Bridge chat text is too small on mobile. In `app/dashboard/bridge/page.tsx`:
- Message bubbles (line ~106) are `text-sm` → bump to `text-[16px]` (or `text-base`), keep `leading-relaxed`.
- The compose textarea (line ~167) is `text-sm` → bump to `text-[16px]` too (16px also stops iOS from zoom-on-focus).
- Leave the small uppercase labels/timestamps as-is; only the actual message + input text should grow.
Target: comfortable phone reading, close to Telegram's default message size.

## Out of scope (fast-follow, note in PR)
- **Video:** Claude can't ingest raw video. A later brief adds client- or server-side frame extraction (sample N frames) so Wendy can read a clip. Ship images first.

## Acceptance test
Brad opens the dashboard Bridge, clicks the paperclip, picks a screenshot, sends it (with or without text), and Wendy responds referencing what's actually in the image — same as Telegram today.
