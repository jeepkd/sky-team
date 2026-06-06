-- Sky Team Digital — Phase 4: Hidden information RLS
-- Tightens dice_rolls and placements so each player only sees their own
-- dice values, and placements are masked until the round is revealed.
--
-- Run this in Supabase Studio → SQL Editor after Phase 3 is stable.

-- ---------------------------------------------------------------------------
-- dice_rolls: each player may only SELECT their own rolls.
-- The permissive Phase 2 policy is dropped and replaced.
-- ---------------------------------------------------------------------------
drop policy if exists "phase2_open_dice_rolls" on dice_rolls;

-- Insert/update/delete still open (service role key used by Edge Functions).
create policy "phase4_dice_rolls_select_own"
  on dice_rolls for select
  using (
    player_role = (
      select role from players
      where game_id = dice_rolls.game_id
        and client_id::text = current_setting('request.headers', true)::json->>'x-client-id'
      limit 1
    )
  );

create policy "phase4_dice_rolls_insert" on dice_rolls for insert with check (true);
create policy "phase4_dice_rolls_update" on dice_rolls for update using (true) with check (true);
create policy "phase4_dice_rolls_delete" on dice_rolls for delete using (true);

-- ---------------------------------------------------------------------------
-- placements: SELECT is allowed only when revealed=true OR the row belongs
-- to the requesting player.
-- ---------------------------------------------------------------------------
drop policy if exists "phase2_open_placements" on placements;

create policy "phase4_placements_select"
  on placements for select
  using (
    revealed = true
    or player_role = (
      select role from players
      where game_id = placements.game_id
        and client_id::text = current_setting('request.headers', true)::json->>'x-client-id'
      limit 1
    )
  );

create policy "phase4_placements_insert" on placements for insert with check (true);
create policy "phase4_placements_update" on placements for update using (true) with check (true);
create policy "phase4_placements_delete" on placements for delete using (true);
