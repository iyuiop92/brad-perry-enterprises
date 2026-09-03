-- Today's Big 3: the three things that make the day a win. One row per Phoenix day.
create table if not exists public.bpe_big_three (
  day        date primary key,
  items      jsonb not null default '[]'::jsonb,  -- [{ text, done }]
  updated_at timestamptz not null default now()
);
