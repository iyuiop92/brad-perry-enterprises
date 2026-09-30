create table public.bpe_task_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.bpe_tasks(id) on delete cascade,
  mode text not null check (mode in ('sprint', 'deep', 'admin', 'closeout')),
  planned_minutes integer not null check (planned_minutes > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

alter table public.bpe_task_sessions enable row level security;
revoke all on table public.bpe_task_sessions from anon, authenticated;
grant select, insert, update, delete on table public.bpe_task_sessions to authenticated;

create policy "authenticated can read task sessions"
  on public.bpe_task_sessions for select to authenticated using (true);
create policy "authenticated can add task sessions"
  on public.bpe_task_sessions for insert to authenticated with check (true);
create policy "authenticated can update task sessions"
  on public.bpe_task_sessions for update to authenticated using (true) with check (true);
create policy "authenticated can remove task sessions"
  on public.bpe_task_sessions for delete to authenticated using (true);

create index bpe_task_sessions_started_at_idx on public.bpe_task_sessions (started_at desc);
create index bpe_task_sessions_task_id_idx on public.bpe_task_sessions (task_id);
