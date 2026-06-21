-- supabase/daily_state.sql
create table if not exists bpe_daily_state (
  id uuid primary key default gen_random_uuid(),
  state_date date not null unique,
  tomorrow_focus_task_id uuid references bpe_tasks(id) on delete set null,
  closeout_note text not null default '',
  calendar_items jsonb not null default '[]'::jsonb,
  recurring_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bpe_daily_state enable row level security;

create policy "owner access only" on bpe_daily_state
  for all using (auth.role() = 'authenticated');

create index if not exists bpe_daily_state_state_date_idx
  on bpe_daily_state(state_date desc);

create or replace function update_bpe_daily_state_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists bpe_daily_state_updated_at on bpe_daily_state;
create trigger bpe_daily_state_updated_at
  before update on bpe_daily_state
  for each row execute function update_bpe_daily_state_updated_at();
