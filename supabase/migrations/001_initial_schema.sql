-- Sky Team Digital — Phase 1 schema (Lobby only)
-- Run this in Supabase Studio → SQL Editor.
--
-- Scope: just enough to create/join a room and see player presence.
-- Dice, placements, messages, and game_events arrive in Phase 2.
--
-- RLS: we turn it ON with permissive "allow-all" policies (see bottom of
-- file). This keeps the same open dev experience as RLS-off, but the
-- security boundary exists from day 1 — Phase 6 hardening is just a matter
-- of rewriting these policies, not enabling RLS table-by-table. (Note:
-- RLS ON with NO policies blocks everything, including the app's setup
-- check, so the open policies below are required for Phase 1 to work.)

-- ---------------------------------------------------------------------------
-- rooms: a joinable lobby identified by a short human-typable code
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  status      text not null default 'lobby',   -- lobby | playing | done
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- games: one game per room (1:1 for base game), holds phase/round cursor
-- ---------------------------------------------------------------------------
create table if not exists games (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  status         text not null default 'lobby', -- lobby | active | victory | crashed
  current_round  int  not null default 0,
  current_phase  text not null default 'LOBBY',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- players: the two seats (pilot / copilot), human or AI
-- ---------------------------------------------------------------------------
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  role        text not null,                    -- pilot | copilot
  client_id   uuid,                             -- localStorage identity (Phase 1)
  is_ai       boolean not null default false,
  connected   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (game_id, role)
);

create index if not exists players_game_id_idx on players(game_id);
create index if not exists games_room_id_idx on games(room_id);

-- ---------------------------------------------------------------------------
-- Realtime: broadcast changes so both tabs see lobby/presence updates.
-- One channel philosophy — clients subscribe to these tables filtered by id.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;

-- ---------------------------------------------------------------------------
-- Row Level Security: ON, with permissive policies for Phase 1 dev.
-- These say "anyone with the anon key can do anything" — same effective
-- access as RLS-off, but the policies are now the single place to tighten
-- later (e.g. "only players in this game can read its rows").
-- ---------------------------------------------------------------------------
alter table rooms   enable row level security;
alter table games   enable row level security;
alter table players enable row level security;

create policy "phase1_open_rooms"   on rooms   for all using (true) with check (true);
create policy "phase1_open_games"   on games   for all using (true) with check (true);
create policy "phase1_open_players" on players for all using (true) with check (true);
