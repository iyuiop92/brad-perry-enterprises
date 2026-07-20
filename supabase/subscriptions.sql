-- supabase/subscriptions.sql
-- Run this in the Supabase SQL editor

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  cost_cents integer not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  next_billing_date date not null,
  billing_url text,
  notes text,
  alert_sent_7d boolean not null default false,
  alert_sent_1d boolean not null default false,
  created_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "owner access only" on subscriptions
  for all using (auth.role() = 'authenticated');

-- Seed with Brad's known subscriptions
insert into subscriptions (service, cost_cents, billing_cycle, next_billing_date, billing_url, notes) values
  ('Claude Code', 10000, 'monthly', (now() + interval '30 days')::date, 'https://claude.ai/settings/billing', 'Wendy runs on this'),
  ('OpenAI', 2000, 'monthly', (now() + interval '30 days')::date, 'https://platform.openai.com/settings/billing', null),
  ('Vercel Pro', 2000, 'monthly', (now() + interval '30 days')::date, 'https://vercel.com/account/billing', 'Hosts all sites'),
  ('Anthropic API', 0, 'monthly', (now() + interval '30 days')::date, 'https://console.anthropic.com/settings/billing', 'Usage-based — check dashboard for actual cost'),
  ('Mux', 0, 'monthly', (now() + interval '30 days')::date, 'https://dashboard.mux.com/settings/billing', 'Usage-based — AetherHockey video'),
  ('Twilio', 0, 'monthly', (now() + interval '30 days')::date, 'https://console.twilio.com/billing', 'Business phone AI for service clients');
