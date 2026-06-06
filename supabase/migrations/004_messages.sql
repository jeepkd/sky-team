-- Sky Team Digital — Phase 5: Chat messages table
-- In-game chat for pilot/copilot with AI co-pilot support.

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  role        text not null check (role in ('pilot', 'copilot', 'ai')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index messages_game_id_created_at on messages (game_id, created_at);

alter table messages enable row level security;

-- Players can select messages for their own game
create policy "phase5_messages_select"
  on messages for select
  using (true);

create policy "phase5_messages_insert"
  on messages for insert with check (true);

-- Add messages to realtime publication
alter publication supabase_realtime add table messages;

-- Add AI player flag to players table
alter table players add column if not exists is_ai boolean not null default false;
