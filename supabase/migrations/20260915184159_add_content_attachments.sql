-- Attachment metadata stays with the content card. File bytes stay private in Storage.
set local lock_timeout = '5s';

alter table public.bpe_content_items
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('content-attachments', 'content-attachments', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800;
