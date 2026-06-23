-- supabase/video_ideas.sql
create table if not exists bpe_video_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  status text not null default 'idea'
    check (status in ('idea','research','planned','filmed','edited','published')),
  social_media text not null default '',
  free_tier text not null default '',
  paid_tier text not null default '',
  notes text not null default '',
  research_notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bpe_video_ideas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bpe_video_ideas'
      and policyname = 'owner access only'
  ) then
    create policy "owner access only" on bpe_video_ideas
      for all using (auth.role() = 'authenticated');
  end if;
end $$;

create index if not exists bpe_video_ideas_status_idx
  on bpe_video_ideas(status, sort_order, created_at);

create index if not exists bpe_video_ideas_updated_at_idx
  on bpe_video_ideas(updated_at desc);

create or replace function update_bpe_video_ideas_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists bpe_video_ideas_updated_at on bpe_video_ideas;
create trigger bpe_video_ideas_updated_at
  before update on bpe_video_ideas
  for each row execute function update_bpe_video_ideas_updated_at();

insert into bpe_video_ideas
  (title, status, social_media, free_tier, paid_tier, notes, research_notes, sort_order)
values
  (
    'Research most-viewed hockey videos and make better corrections',
    'research',
    'Find a high-view video, show the missed correction, then show Brad''s cleaner version.',
    'Show the surface-level correction and why the popular clip is incomplete.',
    'Full breakdown: what the popular video misses, progression drill, and how to self-check it.',
    'Research most viewed hockey videos, identify the issue in each video, then film the better version.',
    'Use AI/research to find most-viewed hockey videos and the correction opportunity.',
    10
  ),
  (
    'Two puck stack',
    'planned',
    'Fast visual: stacked pucks become one puck when the blade settles.',
    'Track the puck in practice and show what the puck looks like when it goes back to one puck.',
    'Deeper stickhandling progression: full body, puck, blade, and glass-side angle.',
    'Show full body, puck, and blade from behind the glass across the ice.',
    '',
    20
  ),
  (
    'Learn how to hockey stop in a couple minutes',
    'planned',
    'Show one strong hockey stop in slow motion with the key edge mistake.',
    'Where the hollow bites, how too much edge causes trouble, and why the puck stays in its lane.',
    'Full progression with puck carrying, lane control, and common handling mistake before the stop.',
    'Show a real good hockey stop. Slow motion. Talk about where. Show too much edge and the hollow.',
    '',
    30
  ),
  (
    'Cradle',
    'planned',
    'Show the wrong toe-point receive versus a clean cradle into space.',
    'Blade matches puck speed, first touch, and why double tapping forces eyes down.',
    'Cradle receive, redirect, drop pass, cradle shot versus snapshot, and right winger receiving on left side.',
    'Demo the cradle. Puck into open space. Explain that coach may be right if they teach a different context.',
    '',
    40
  ),
  (
    'Butt on the wall',
    'idea',
    'Slam butt to wall, show puck rolling properly around the boards.',
    'Where you are on the ice and how to make the wall play into your skates.',
    'Set up net, show hit/next play, and show puck shooting off skate versus controlled wall receive.',
    'Lefty as a right hander to get the puck to roll around the wall the correct way.',
    '',
    50
  ),
  (
    'Always head up and gray space',
    'idea',
    'Blur/focus demo showing up, down, and gray space.',
    'Three cone drill teaching eyes in gray space.',
    'Full awareness progression: puck control without staring, scanning rhythm, and pressure decisions.',
    'Capture the difference between up, down, and gray space. Maybe lock exposure or focus to blur.',
    '',
    60
  ),
  (
    'Watch the billboard, wall, or object',
    'idea',
    'Show the difference between looking at the puck, wall, and billboard.',
    'Simple looking-up play tied to real rink references.',
    'Scanning system for practice: object references, timing, and decision cues.',
    'This may be the same as the looking up play.',
    '',
    70
  ),
  (
    'Point at your target',
    'idea',
    'Slow-motion blade parking and what happens clipping the back of the puck.',
    'Basic shot direction: point blade/path at the target.',
    'Blade contact map, puck spin, miss patterns, and correction drills.',
    'Show parking slow motion on the blade. Show what happens when you clip the back part of the puck.',
    '',
    80
  ),
  (
    'Shoot from the toe',
    'idea',
    'Shoot from different blade spots and show results fast.',
    'Mark stick blade tape as reference and show where contact happens.',
    'Hands without gloves, blade contact points, release changes, and when to use each contact point.',
    'Shoot from every part of the stick blade and show the different results.',
    '',
    90
  ),
  (
    'Player stickhandling with glove off',
    'idea',
    'Glove-off closeup of hand position changing handle, shot, and pass.',
    'Difference between handle, shot, and pass. Shoot with three fingers.',
    'Full hand mechanics breakdown for stickhandling, passing, and shooting.',
    'Show player stickhandling with glove off.',
    '',
    100
  ),
  (
    'Two puck stickhandle',
    'idea',
    'Two pucks create brain stress. Show the chaos and the correction.',
    'Why adding pucks stresses the brain and improves control.',
    'Progressions with more pucks, movement, and decision pressure.',
    'Why creates brain stress. Adding pucks.',
    '',
    110
  ),
  (
    'Fundamentals of moving and stickhandling',
    'idea',
    'Closeup of what stickhandling forward should actually look like.',
    'Basic forward movement and puck rhythm.',
    'Forward, side, backward, and transition handling progressions.',
    'What does it look like to stick handle forward, closeup.',
    '',
    120
  ),
  (
    'Shooting hand wrist not bending fix for more power',
    'idea',
    'Quick wrist bend mistake and the power fix.',
    'Loosen top hand and re-grip like starting a deke.',
    'Power generation breakdown: top hand, bottom hand, release timing, and wrist position.',
    'Loosen up on the top hand and re-grip like you are trying to do a deke.',
    '',
    130
  ),
  (
    'Slapshot',
    'idea',
    'Slow-motion line on the blade and ice forensics after contact.',
    'Grip, body position, blade contact, and timing basics.',
    'Half-wall drill, full timing progression, weight transfer, and glass-side filming breakdown.',
    'Grip position and strength. Weight/body position. Where on blade. Timing. Film on other side of glass.',
    '',
    140
  ),
  (
    'Hockey stops',
    'idea',
    'Beginner stop mistake: heel chatter, loose skates, and sliding in.',
    'Ways to learn, slip start, up and down, stick and shoulder position.',
    'With/without puck, outside edge steps, wall support drill, and tight-skate setup.',
    'Sliding in. Where on the blade. Beginner tips. Slide one skate holding the wall. Make sure skates are tight.',
    '',
    150
  ),
  (
    'Outside edge stop like the pros',
    'idea',
    'Show the outside-edge stop compared with a regular hockey stop.',
    'What makes the outside edge stop different.',
    'Pro-level progression into outside-edge control, exits, and puck use.',
    'Similar to the hockey stop outside edge.',
    '',
    160
  ),
  (
    'How to punch stop',
    'planned',
    'Show where the snow comes out. Body position. Start with sliding skate behind support skate.',
    'Bunion part touches the heel more on the outside edge with light pressure. Push and punch slide longer with more weight on support skate.',
    'Wider feet into the slide, turn almost facing the other direction, crossovers out, stick detail, puck version, arms crossing in tight spaces, and coach caveat.',
    'If your coach says not to cross your arms, do what they tell you to do.',
    '',
    170
  ),
  (
    'Intro hitting',
    'idea',
    'Safe contact intro: what hitting is and what it is not.',
    'Basic body position and how to prepare for contact.',
    'Full contact progression, receiving hits, angling, and age-appropriate details.',
    '',
    '',
    180
  ),
  (
    'Crossovers problems no one is talking about',
    'idea',
    'Loose skates, leaning back, and slipping out behind.',
    'The three crossover problems players miss.',
    'Forward/backward crossover fixes with balance, edge pressure, and acceleration exits.',
    'Loose skates. Body leaning too far back. Slipping out behind.',
    '',
    190
  ),
  (
    'Laces',
    'idea',
    'Fast gear truth: wax, top eyelet, tongue, and gimmicky tying.',
    'What actually matters when tying skates.',
    'Full skate fit and lace setup: wax, tie-around, tongue in/out, loose bottom, top eyelet, knot, color versus white.',
    'Wax, tie around, tongue in, loose bottom if needed, top eyelet, gimmicks, knot at end, color vs white.',
    '',
    200
  ),
  (
    'Stickhandling moving forward, side, and backwards',
    'idea',
    'Tap-tap zigzag forward motion and backward practice.',
    'Forward and side handling basics.',
    'Full forward/backward handling progressions with zigzag, heel work, and movement patterns.',
    'Tapping in a zigzag forward motion off the heel. Practice backwards, tap tap.',
    '',
    210
  ),
  (
    'Gloves off segments',
    'idea',
    'Closeup glove-off hand position for stickhandling, passing, and shooting.',
    'Slow closeup of hand positions.',
    'Different shot types, passing mechanics, and stickhandling hand changes.',
    'Show hand position. Stickhandling, passing, shooting, slow closeup.',
    '',
    220
  ),
  (
    'Snap shot versus wrist shot',
    'idea',
    'Show the visual difference between snap shot and wrist shot.',
    'When each shot is used and what changes.',
    'Full mechanics and decision breakdown with drills.',
    '',
    '',
    230
  ),
  (
    'Lifting the puck bar down',
    'idea',
    'Start with 20 rapid-fire pucks, then slow motion.',
    'Basic puck lift sequence and blade angle.',
    'Full breakdown of forehand/backhand lift, mistakes, and progression.',
    'Start with a sequence of about 20 pucks rapid fire and then slow motion and breakdown.',
    '',
    240
  ),
  (
    'Three Cone Tight-turn with a puck drill',
    'idea',
    'Three-cone tight turn with puck, fast before/after.',
    'Basic drill setup and one correction.',
    'Full drill progression, edge details, puck position, exits, and common mistakes.',
    '',
    '',
    250
  ),
  (
    'Handling the puck around defender',
    'idea',
    'Move puck opposite side of defender and protect it.',
    'Back to defender, get puck clear, prepare for contact.',
    'Defender-side puck protection, contact prep, fake/check pressure, and exit choices.',
    'Get the puck to opposite side of defender. Put your back to defender. Show me check and contact.',
    '',
    260
  )
on conflict (title) do nothing;
