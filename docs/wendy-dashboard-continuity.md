# Wendy in BPE

The dashboard home chat, Command Room and dashboard microphone use `/api/bridge` and the persistent local worker. The old separate voice pages redirect to the dashboard. Historical API chat tables are retained.

## Conversation continuity

Local configuration lives at `~/.claude/bpe-wendy-session.json` (outside git). It pins a Claude session, executable, model and working directory. The initial dashboard session is a tested fork of Brad's direct Telegram conversation, retaining its context while preserving the original for rollback. Group chat is not imported. Telegram messages sent after the fork are not automatically synchronized.

Claude uses its existing Max authentication. The worker removes the BPE Anthropic API key and API base/auth overrides from Wendy's child environment. Other agents retain their existing configuration. Text chat does not call ElevenLabs; voice still does.

Pinned sessions never automatically reset on errors. Investigate the session before retrying an action; an agent may have completed work even if reply delivery failed. Do not replace the session merely to clear an error.

## Runtime

`com.wendy.agent-bridge` runs `scripts/run-agent-bridge.sh`. It must be running on Brad's awake, connected Mac. A local PID lock prevents duplicate migrated workers. Database claims change pending to processing conditionally. A heartbeat uses one system row in thread `_worker`; authenticated `/api/bridge?health=1` exposes connectivity without session IDs or credentials.

## Cutover and rollback

1. Verify a no-tools fork recalls a specific Telegram decision.
2. Configure the tested fork; restart the dashboard worker only when its queue is idle.
3. Send and receive a continuity probe through authenticated BPE. Verify a follow-up after worker restart and page reload.
4. Pause the Telegram launch service only after those checks. Preserve its plist, sessions and history. Do not delete the bot.
5. To restore Telegram, bootstrap its saved launch plist. Dashboard and Telegram have separate branches of the same starting conversation, so explicitly transfer any later decisions before changing the primary channel again.

No claim of uninterrupted availability: Mac sleep, connectivity, Claude authentication and provider limits can delay work. The UI shows queued/processing/error states and retains failed drafts. The primary chat retries use stable message IDs to avoid duplicate execution when an acknowledgment is lost.

## Verification status — September 4, 2026

Not ready to merge or retire Telegram. The migrated session recalled a specific prior Telegram caption decision. Interactive Claude launches with normal tools and dashboard directory access also replied successfully. Authenticated local API tests confirmed recent history, retired-route notices, and duplicate message IDs creating only one queued job.

The launchd worker did not complete the same no-action probe. A process sample showed its main thread blocked in `openat`; macOS TCC logs recorded a denied Full Disk Access preflight for its responsible Node executable. That is the current service-environment blocker to investigate with Brad's permission. Do not bypass macOS privacy controls or grant broad access automatically. All diagnostic probes were stopped; no business actions were requested. Temporary timeout changes did not fix the service and were removed.

Production ElevenLabs playback is not verified: the local development environment lacks a voice configuration, and locally available production credential exports were empty. Browser/phone microphone and playback acceptance remain outstanding. Known review follow-ups before release: deterministic voice-reply correlation, safe Ellie session resumption, and mobile/browser validation.

The migration branch is preserved as work in progress. The live service must remain on the existing production code until the service-access issue is resolved and the full cutover checklist passes. The external migrated session/config and original Telegram session remain intact.
