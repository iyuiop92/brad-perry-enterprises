-- supabase/agent_bridge_attachments.sql
-- Run this in the Supabase SQL editor AFTER agent_bridge.sql.
-- Adds image-attachment support to the dashboard <-> terminal agent bridge.
--
-- The table `agent_bridge_messages` already exists in prod. This migration only
-- adds the new `attachments` column, so it is safe to run against the live DB.
--
-- Each user row may carry a list of uploaded images stored in the PRIVATE
-- `bridge-uploads` Storage bucket. Shape of each element:
--   { "storage_path": "main/<uuid>-<filename>", "mime": "image/png", "filename": "screenshot.png" }
-- Image bytes live in Storage, NOT in this column (rows are polled in bulk;
-- inline base64 would bloat every poll).

alter table agent_bridge_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Private Storage bucket for bridge image uploads.
-- Created here so the migration is self-contained; the worker downloads bytes
-- with the service-role key. `public = false` keeps images off the public CDN.
insert into storage.buckets (id, name, public)
values ('bridge-uploads', 'bridge-uploads', false)
on conflict (id) do nothing;
