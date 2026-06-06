-- Sky Team Digital — Phase 6: Room expiry + disconnect cleanup
-- Requires pg_cron extension (enabled by default on Supabase Pro; on Free tier
-- enable it in Dashboard → Database → Extensions → pg_cron).

-- Add connected/disconnected tracking to players
alter table players add column if not exists connected boolean not null default true;
alter table players add column if not exists disconnected_at timestamptz;

-- Add expires_at to rooms so we can prune old rooms
alter table rooms add column if not exists expires_at timestamptz not null default now() + interval '6 hours';

-- Update expires_at when a game becomes active
create or replace function refresh_room_expiry()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' then
    update rooms set expires_at = now() + interval '6 hours' where id = new.room_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_room_expiry on games;
create trigger trg_refresh_room_expiry
  after update of status on games
  for each row execute function refresh_room_expiry();

-- Function: forfeit a game if a player has been disconnected for > 10 minutes
create or replace function forfeit_disconnected_games()
returns void language plpgsql as $$
declare
  rec record;
begin
  for rec in
    select distinct g.id as game_id
    from games g
    join players p on p.game_id = g.id
    where g.status = 'active'
      and p.connected = false
      and p.disconnected_at < now() - interval '10 minutes'
  loop
    update games
    set
      status = 'failed',
      current_phase = 'ENDED',
      state = jsonb_set(
        jsonb_set(state, '{status}', '"failed"'),
        '{phase}', '"ENDED"'
      )
    where id = rec.game_id
      and status = 'active';
  end loop;
end;
$$;

-- Function: delete expired rooms
create or replace function cleanup_expired_rooms()
returns void language plpgsql as $$
begin
  delete from rooms where expires_at < now();
end;
$$;

-- Schedule cleanup jobs (requires pg_cron)
-- These are no-ops if pg_cron is not enabled; uncomment after enabling the extension.
-- select cron.schedule('forfeit-disconnected', '*/5 * * * *', 'select forfeit_disconnected_games()');
-- select cron.schedule('cleanup-rooms', '0 * * * *', 'select cleanup_expired_rooms()');
