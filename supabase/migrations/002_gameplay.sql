-- Sky Team Digital — Phase 2 schema (gameplay tables)
-- Run this in Supabase Studio → SQL Editor.

-- ---------------------------------------------------------------------------
-- Add state + config columns to games
-- ---------------------------------------------------------------------------
alter table games
  add column if not exists state  jsonb,
  add column if not exists config jsonb;

-- ---------------------------------------------------------------------------
-- dice_rolls: server-generated rolls, one row per player per round.
-- Phase 4 RLS will restrict reads to the owning role; until then permissive.
-- ---------------------------------------------------------------------------
create table if not exists dice_rolls (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  round       int  not null,
  player_role text not null,   -- 'pilot' | 'copilot'
  values      int[] not null,  -- full rolled set
  remaining   int[] not null,  -- dice not yet placed
  rolled_at   timestamptz not null default now(),
  unique (game_id, round, player_role)
);

create index if not exists dice_rolls_game_round_idx on dice_rolls(game_id, round);

-- ---------------------------------------------------------------------------
-- placements: one row per die placed; revealed atomically by resolve-round.
-- ---------------------------------------------------------------------------
create table if not exists placements (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  round       int  not null,
  player_role text not null,
  slot_id     text not null,
  die_value   int  not null,
  sequence    int  not null,   -- order within the round
  revealed    bool not null default false,
  placed_at   timestamptz not null default now()
);

create index if not exists placements_game_round_idx on placements(game_id, round);

-- ---------------------------------------------------------------------------
-- game_events: append-only feed for the realtime action log.
-- ---------------------------------------------------------------------------
create table if not exists game_events (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  event_type  text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists game_events_game_id_idx on game_events(game_id);

-- ---------------------------------------------------------------------------
-- Realtime: publish new tables so clients can subscribe.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table dice_rolls;
alter publication supabase_realtime add table placements;
alter publication supabase_realtime add table game_events;

-- ---------------------------------------------------------------------------
-- Row Level Security: permissive for Phase 2 dev (tightened in Phase 4).
-- ---------------------------------------------------------------------------
alter table dice_rolls   enable row level security;
alter table placements   enable row level security;
alter table game_events  enable row level security;

create policy "phase2_open_dice_rolls"  on dice_rolls  for all using (true) with check (true);
create policy "phase2_open_placements"  on placements  for all using (true) with check (true);
create policy "phase2_open_game_events" on game_events for all using (true) with check (true);
