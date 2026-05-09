-- supabase/migration.sql
create table if not exists bpe_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  status text not null default 'idea' check (status in ('idea','in_progress','blocked','done')),
  type text not null default 'internal' check (type in ('internal','client')),
  brand text,
  owner text not null default 'brad' check (owner in ('brad','wendy','ellie')),
  phase text check (phase in ('discovery','design','build','launch','live')),
  deliverables jsonb not null default '[]'::jsonb,
  handoff_checklist jsonb not null default '[]'::jsonb,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bpe_tasks enable row level security;

create policy "owner access only" on bpe_tasks
  for all using (auth.role() = 'authenticated');

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger bpe_tasks_updated_at
  before update on bpe_tasks
  for each row execute function update_updated_at();
