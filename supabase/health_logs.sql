-- supabase/health_logs.sql
create table if not exists bpe_health_logs (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('blood_pressure','nutrition','workout')),
  logged_at timestamptz not null default now(),
  bp_systolic integer,
  bp_diastolic integer,
  pulse integer,
  meal_name text,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  workout_type text,
  duration_mins integer,
  intensity text,
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table bpe_health_logs enable row level security;

create policy "owner access only" on bpe_health_logs
  for all using (auth.role() = 'authenticated');

create index if not exists bpe_health_logs_logged_at_idx
  on bpe_health_logs(logged_at desc);

create index if not exists bpe_health_logs_entry_type_idx
  on bpe_health_logs(entry_type, logged_at desc);
