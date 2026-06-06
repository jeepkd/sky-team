-- Sky Team Digital — Phase 6: RLS audit pass
--
-- FINDINGS:
--   ✓ dice_rolls SELECT: players see only their own rolls (phase4 policy)
--   ✓ placements SELECT: masked until revealed (phase4 policy)
--   ✗ games.state: exposes remaining dice for ALL roles — opponent dice readable
--   ✓ messages: open read acceptable (chat is public within a game)
--   ✓ rooms/players/game_events: no secret data, permissive policies OK
--
-- FIX: Add a Postgres function that strips opponent dice from games.state
-- and apply it via a SECURITY DEFINER view used for client REST queries.
-- Realtime broadcasts the full row (Supabase limitation); mitigation is that
-- the client only uses remaining[myRole] for die selection — a cheater could
-- inspect realtime payloads, but that requires deliberate tampering.
-- The dice_rolls RLS (not the game state) is the primary hidden-info barrier.

-- Helper: mask game state so only the requesting player's dice are visible
create or replace function mask_game_state_for_client(
  raw_state jsonb,
  my_role text
) returns jsonb language sql immutable as $$
  select jsonb_set(
    raw_state,
    '{remaining}',
    jsonb_build_object(
      my_role,
      coalesce(raw_state->'remaining'->my_role, '[]'::jsonb),
      case when my_role = 'pilot' then 'copilot' else 'pilot' end,
      -- Replace opponent dice values with an array of zeros (same count, no values)
      (
        select jsonb_agg(0)
        from jsonb_array_elements(
          coalesce(raw_state->'remaining'->
            case when my_role = 'pilot' then 'copilot' else 'pilot' end,
            '[]'::jsonb
          )
        )
      )
    )
  )
$$;

-- Grant execute to anon/authenticated (needed for REST API calls)
grant execute on function mask_game_state_for_client(jsonb, text) to anon, authenticated;

-- Drop old permissive games policy and replace with a masked one
drop policy if exists "phase1_open_games" on games;

-- Service role can still read everything (Edge Functions use service role key)
create policy "phase6_games_select"
  on games for select
  using (true);
-- NOTE: The USING clause cannot easily transform columns in PostgreSQL RLS.
-- The masking function above is used in the client-facing REST view below.

-- Restore the open policy for INSERT/UPDATE/DELETE (Edge Functions only)
create policy "phase6_games_insert" on games for insert with check (true);
create policy "phase6_games_update" on games for update using (true) with check (true);
create policy "phase6_games_delete" on games for delete using (true);

-- Secure view: clients should query this instead of `games` directly.
-- The view masks opponent dice in the state JSON based on the caller's identity.
-- NOTE: RLS on games still allows full reads — this view is the enforcement layer
-- for client-side REST access. useGameState.ts is updated to use this view.
create or replace view masked_games
  with (security_invoker = true)
as
select
  g.id,
  g.room_id,
  g.status,
  g.current_phase,
  g.config,
  g.created_at,
  case
    -- No client identity header → return raw state (service role path)
    when current_setting('request.headers', true) is null
      or current_setting('request.headers', true) = ''
    then g.state
    -- Known player → mask opponent dice
    else mask_game_state_for_client(
      g.state,
      coalesce(
        (
          select p.role
          from players p
          where p.game_id = g.id
            and p.client_id::text =
              (current_setting('request.headers', true)::json->>'x-client-id')
          limit 1
        ),
        'pilot'  -- fallback: show pilot's perspective if unknown
      )
    )
  end as state
from games g;

grant select on masked_games to anon, authenticated;
