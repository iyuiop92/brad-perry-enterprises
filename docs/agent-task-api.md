# Agent Task API — Wendy + Ellie

This API is the shared, live task-board integration for Wendy (Claude) and Ellie (GPT-5/Codex). Both read and write the same Supabase `bpe_tasks` rows, so the next request always observes the other executive's latest change. Route handlers are dynamic and return no cached board state.

## Setup

1. Run [`supabase/agent_task_api.sql`](../supabase/agent_task_api.sql) in the project's Supabase SQL editor. It converts the legacy dashboard `blocked` value to `to_do`, then adds archive and audit fields.
2. Add these server-side variables to the deployment and the local `.env.local` file. Generate two distinct, long random values; never expose either key to browser code, repositories, or chat transcripts.

```bash
BPE_WENDY_AGENT_API_KEY=replace-with-a-unique-secret
BPE_ELLIE_AGENT_API_KEY=replace-with-a-different-unique-secret
```

For the optional smoke test only:

```bash
BPE_AGENT_API_BASE_URL=https://your-command-center.example.com
```

The existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` remain server-only dashboard configuration. The route detects the caller from `Authorization: Bearer <agent-key>`; clients never send an agent name, so Wendy cannot be recorded as Ellie or vice versa.

## HTTP contract

All endpoints require `Authorization: Bearer <agent-key>`. A missing or invalid key receives `401`; missing server configuration receives `503`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/agent/tasks` | Live tasks plus workspaces. Optional `workspace_id`, `status`, `include_archived=true`. |
| `POST /api/agent/tasks` | Create a task. |
| `GET /api/agent/tasks/:id` | Read one task. |
| `PATCH /api/agent/tasks/:id` | Update fields or move with `{ "status": "done" }`; archive with `{ "archive": true }`. |
| `DELETE /api/agent/tasks/:id` | Permanently delete a task only when explicitly requested. |

Valid statuses are `idea`, `to_do`, `in_progress`, and `done`. The GET response includes titles, types, statuses, priorities, notes, workspace IDs, and the latest agent audit fields. Every agent write stamps `agent_last_actor`, `agent_last_action`, and `agent_last_action_at` on the task, plus a row in `bpe_task_agent_audit`.

## Provider tools

[`lib/agent-task-tools.ts`](../lib/agent-task-tools.ts) exports both provider definitions:

- `claudeTaskTools`: Anthropic/Claude `name`, `description`, and `input_schema` format for Wendy.
- `openAITaskTools`: OpenAI/Codex `{ type: 'function', function: { ... } }` format for Ellie.

Map tool names to HTTP this way in each agent host: `bpe_list_board` → `GET /api/agent/tasks`; `bpe_get_task` → `GET /api/agent/tasks/:id`; `bpe_create_task` → `POST /api/agent/tasks`; `bpe_update_task` and `bpe_move_task` → `PATCH /api/agent/tasks/:id`; `bpe_archive_task` → `PATCH /api/agent/tasks/:id` with `archive: true`; `bpe_delete_task` → `DELETE /api/agent/tasks/:id`.

## Safe smoke test

After deploying to a preview environment and setting its variables, run:

```bash
node scripts/test-agent-task-api.mjs
```

The test creates one uniquely named task, reads it back, updates it, moves it to `done`, archives it, then deletes that exact UUID in `finally` cleanup. It does not query for or delete any other task.
