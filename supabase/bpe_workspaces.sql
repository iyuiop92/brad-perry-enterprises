create table if not exists bpe_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null default 'brand' check (type in ('brand','client','internal')),
  color text not null default '#00b4ff',
  url text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bpe_workspaces enable row level security;

create policy "owner access only" on bpe_workspaces
  for all using (auth.role() = 'authenticated');

create or replace function update_bpe_workspaces_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger bpe_workspaces_updated_at
  before update on bpe_workspaces
  for each row execute function update_bpe_workspaces_updated_at();

alter table bpe_tasks add column if not exists workspace_id uuid references bpe_workspaces(id) on delete set null;

alter table bpe_tasks drop constraint if exists bpe_tasks_owner_check;
alter table bpe_tasks add constraint bpe_tasks_owner_check
  check (owner in ('brad','wendy','ellie','cleaver','sam'));
