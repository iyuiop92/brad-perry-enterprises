-- Fix: Universal Inbox captures never showed in the dashboard.
-- bpe_inbox had RLS with no policy for the app's authenticated session, so the
-- logged-in dashboard client could neither read nor insert (service role, which
-- bypasses RLS, still saw the rows — hence "Inbox is clear" in the UI).
-- Mirror the working bpe_tasks policy.
--
-- Run in the Supabase SQL editor (or apply as a migration).

alter table bpe_inbox enable row level security;

drop policy if exists "owner access only" on bpe_inbox;
create policy "owner access only" on bpe_inbox
  for all using (auth.role() = 'authenticated');
