-- supabase/agent_bridge.sql
-- Run this in the Supabase SQL editor.
-- Message bus for the dashboard <-> terminal agent bridge (Claude/Jack + Codex).
-- The dashboard writes user rows; a local worker on Brad's Mac reads pending
-- user rows, drives the agent, and writes back reply rows.

create table if not exists agent_bridge_messages (
  id uuid primary key default gen_random_uuid(),
  thread text not null default 'main',
  -- who the row is from
  role text not null check (role in ('user', 'claude', 'codex', 'system')),
  -- for user rows: which agent(s) the message is addressed to
  target text check (target in ('claude', 'codex', 'both')),
  content text not null,
  -- lifecycle of a user row: pending -> processing -> done | error
  -- agent/system rows are inserted already 'done'
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  error text,
  created_at timestamptz not null default now()
);

-- Worker polls pending user rows oldest-first
create index if not exists agent_bridge_pending_idx
  on agent_bridge_messages (status, created_at)
  where role = 'user';

-- Dashboard reads a thread in order
create index if not exists agent_bridge_thread_idx
  on agent_bridge_messages (thread, created_at);

alter table agent_bridge_messages enable row level security;

-- Server routes use the service-role key (bypasses RLS). This restrictive
-- policy is defense-in-depth so the anon key can never read the bus.
create policy "owner access only" on agent_bridge_messages
  for all using (auth.role() = 'authenticated');
