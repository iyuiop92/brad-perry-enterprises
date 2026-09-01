-- Content Command board (Phase 1)
-- One row per piece of content: article, video, or social post.
-- Blotato and per-platform published-link columns are included now so Phase 2/3
-- (auto-publish + live links) never needs another migration.

create table if not exists public.bpe_content_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content_type  text not null default 'social'   check (content_type in ('article','video','social')),
  status        text not null default 'idea'      check (status in ('idea','draft','ready','scheduled','posted')),
  brand         text not null default 'aether',
  caption       text default '',
  platforms     text[] not null default '{}',      -- instagram, tiktok, youtube, facebook, threads, linkedin
  media_url     text,
  scheduled_at  timestamptz,
  posted_at     timestamptz,
  blotato_ids   jsonb not null default '{}'::jsonb, -- { platform: postSubmissionId }  (Phase 2)
  published_urls jsonb not null default '{}'::jsonb,-- { platform: liveUrl }            (Phase 3)
  notes         text default '',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists bpe_content_items_status_idx    on public.bpe_content_items (status);
create index if not exists bpe_content_items_scheduled_idx on public.bpe_content_items (scheduled_at);

-- Keep updated_at fresh
create or replace function public.bpe_content_items_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bpe_content_items_touch on public.bpe_content_items;
create trigger bpe_content_items_touch
  before update on public.bpe_content_items
  for each row execute function public.bpe_content_items_touch();
