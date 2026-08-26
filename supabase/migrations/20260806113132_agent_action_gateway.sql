-- Agent Action Gateway: the bpe_tasks board remains the single work source of truth.

alter table public.bpe_tasks add column if not exists archived_at timestamptz;
alter table public.bpe_tasks add column if not exists archived_by text;
create index if not exists bpe_tasks_active_idx on public.bpe_tasks (workspace_id, status, sort_order)
  where archived_at is null;

create table if not exists public.agent_identities (
  id text primary key,
  display_name text not null,
  role text not null check (role in ('admin', 'coo', 'cto', 'telegram_user')),
  permissions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.agent_identities (id, display_name, role, permissions) values
  ('ellie', 'Ellie', 'cto', '["task:read","task:create","task:update","task:move","task:archive","note:create","build:trigger"]'),
  ('wendy', 'Wendy', 'coo', '["task:read","task:create","task:update","task:move","task:archive","note:create","decision:create"]'),
  ('brad', 'Brad', 'admin', '["*"]'),
  ('telegram_user_brad', 'Brad on Telegram', 'telegram_user', '["task:read","task:create","task:update","task:move","task:archive"]')
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role, permissions = excluded.permissions;

create table if not exists public.agent_action_policies (
  id boolean primary key default true check (id),
  archive_requires_approval boolean not null default false,
  delete_requires_approval boolean not null default true,
  external_send_requires_approval boolean not null default true,
  publishing_requires_approval boolean not null default true,
  deploy_requires_approval boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.agent_action_policies (id) values (true) on conflict (id) do nothing;

create table if not exists public.bpe_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('note', 'decision')),
  body text not null,
  workspace_id uuid references public.bpe_workspaces(id) on delete set null,
  task_id uuid references public.bpe_tasks(id) on delete set null,
  actor_id text not null references public.agent_identities(id),
  source_channel text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_action_confirmations (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null references public.agent_identities(id),
  source_channel text not null,
  action jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'expired', 'cancelled')),
  expires_at timestamptz not null default now() + interval '15 minutes',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_action_audit_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  actor_id text not null,
  source_channel text not null,
  action_type text not null,
  target_type text,
  target_id text,
  instruction text,
  before_state jsonb,
  after_state jsonb,
  success boolean not null,
  error_details text,
  created_at timestamptz not null default now()
);
create index if not exists agent_action_audit_created_idx on public.agent_action_audit_log (created_at desc);
create index if not exists agent_action_audit_actor_idx on public.agent_action_audit_log (actor_id, created_at desc);

-- Audit rows are append-only, including to service clients after insertion.
create or replace function public.prevent_agent_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'agent_action_audit_log is immutable';
end;
$$;
drop trigger if exists agent_action_audit_immutable on public.agent_action_audit_log;
create trigger agent_action_audit_immutable before update or delete on public.agent_action_audit_log
  for each row execute function public.prevent_agent_audit_mutation();

alter table public.agent_identities enable row level security;
alter table public.agent_action_policies enable row level security;
alter table public.bpe_notes enable row level security;
alter table public.agent_action_confirmations enable row level security;
alter table public.agent_action_audit_log enable row level security;

-- These tables are server-gateway only. RLS remains enabled with no browser
-- policies; the service-role client is used only after route-level auth and
-- permission checks in lib/agent-actions.ts.
