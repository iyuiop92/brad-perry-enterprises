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

-- ── Personal OS tables ──────────────────────────────────────────────────────

create table if not exists bpe_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  date date not null default current_date,
  bp_systolic integer,
  bp_diastolic integer,
  energy_level integer check (energy_level between 1 and 5),
  sleep_hours numeric(3,1),
  workout_done boolean default false,
  notes text,
  created_at timestamptz not null default now()
);
alter table bpe_daily_checkins enable row level security;
create policy "owner access only" on bpe_daily_checkins
  for all using (auth.role() = 'authenticated');
create unique index if not exists bpe_daily_checkins_user_date
  on bpe_daily_checkins(user_id, date);

create table if not exists bpe_workout_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  date date not null default current_date,
  workout_type text check (workout_type in ('lift','cardio','hockey','hike','rest')),
  duration_mins integer,
  notes text,
  created_at timestamptz not null default now()
);
alter table bpe_workout_log enable row level security;
create policy "owner access only" on bpe_workout_log
  for all using (auth.role() = 'authenticated');

create table if not exists bpe_life_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  title text not null,
  category text check (category in ('home','finance','health','family','errand','other')),
  due_date date,
  done boolean default false,
  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);
alter table bpe_life_tasks enable row level security;
create policy "owner access only" on bpe_life_tasks
  for all using (auth.role() = 'authenticated');

-- ── Personal Feed (persistent Wendy conversation thread) ────────────────────

create table if not exists bpe_feed_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('wendy','brad','system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table bpe_feed_messages enable row level security;
create policy "owner access only" on bpe_feed_messages
  for all using (auth.role() = 'authenticated');
create index if not exists bpe_feed_messages_created_at
  on bpe_feed_messages(created_at desc);
