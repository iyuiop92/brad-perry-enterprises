-- Dashboard Agent Integration API Tool Layer
-- Apply in the Supabase SQL editor before setting agent API keys.

-- The existing UI used "blocked" as its label for "To do". Normalize it once
-- so the board and agents share the documented four-status contract.
update bpe_tasks set status = 'to_do' where status = 'blocked';
alter table bpe_tasks drop constraint if exists bpe_tasks_status_check;
alter table bpe_tasks add constraint bpe_tasks_status_check
  check (status in ('idea', 'to_do', 'in_progress', 'done'));

alter table bpe_tasks add column if not exists archived_at timestamptz;
alter table bpe_tasks add column if not exists agent_last_actor text
  check (agent_last_actor in ('wendy', 'ellie'));
alter table bpe_tasks add column if not exists agent_last_action text;
alter table bpe_tasks add column if not exists agent_last_action_at timestamptz;
create index if not exists bpe_tasks_active_sort_idx
  on bpe_tasks (archived_at, sort_order, created_at);

create table if not exists bpe_task_agent_audit (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  agent text not null check (agent in ('wendy', 'ellie')),
  action text not null check (action in ('create', 'update', 'move', 'archive', 'delete')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table bpe_task_agent_audit enable row level security;
create policy "authenticated users can read agent task audit" on bpe_task_agent_audit
  for select using (auth.role() = 'authenticated');
create index if not exists bpe_task_agent_audit_task_created_idx
  on bpe_task_agent_audit (task_id, created_at desc);
