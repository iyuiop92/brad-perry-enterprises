-- The Vault: Brad's things-to-remember store (rules, words to live by, frameworks).
create table if not exists public.bpe_vault_notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text default '',
  category    text not null default 'Reminders',
  pinned      boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists bpe_vault_notes_category_idx on public.bpe_vault_notes (category);

create or replace function public.bpe_vault_notes_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bpe_vault_notes_touch on public.bpe_vault_notes;
create trigger bpe_vault_notes_touch
  before update on public.bpe_vault_notes
  for each row execute function public.bpe_vault_notes_touch();

-- Seed (only if empty)
insert into public.bpe_vault_notes (title, body, category, pinned)
select * from (values
  (
    'Words to Live By',
    E'You don''t know what you don''t know.\n\nThe coach in front of you is 100% correct. You can coach yourself, I''ll teach you.\n\nThe small details stack into big things. Nobody fixes them because nobody can see them.',
    'Words to Live By',
    true
  ),
  (
    'Aether''s Eye Challenge — rules + 3 protections',
    E'THE RULES (post them up front): Send me a video that teaches an actual on-ice skill and shows the demonstration. A real technique, a shot, an edge, a turn, a habit, something a player executes. Not motivation, not mindset, not gear, not vague advice. And an established skill, not a brand-new made-up move.\n\nTwo kinds of mistake: what they SAY, and what they DEMONSTRATE (a flawed demo teaches a flawed rep).\n\n3 PROTECTIONS:\n1. Rules reject the junk (pep talks, gear, 5-sec clips, vague advice).\n2. Flip the vagueness: if it''s hard-to-mess-up advice, the vagueness IS the mistake. "Sounds great, teaches a player nothing they can do at the rink. Here''s what a real cue sounds like."\n3. You''re the judge, not a vending machine. Pick which videos to feature. Never promise "I''ll do them all."',
    'Content Rules',
    true
  )
) as seed(title, body, category, pinned)
where not exists (select 1 from public.bpe_vault_notes);
