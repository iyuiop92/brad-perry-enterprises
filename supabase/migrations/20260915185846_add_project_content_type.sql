-- Projects use the existing Content Command calendar, lanes, notes, and files.
set local lock_timeout = '5s';

alter table public.bpe_content_items
  drop constraint if exists bpe_content_items_content_type_check;

alter table public.bpe_content_items
  add constraint bpe_content_items_content_type_check
  check (content_type in ('article', 'video', 'social', 'project'));
