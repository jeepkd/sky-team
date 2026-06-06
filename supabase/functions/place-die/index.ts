import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import { validatePlacement, applyPlacement } from '../_shared/game/validate.ts';
import type { GameState, Role } from '../_shared/game/types.ts';
import type { GameConfig } from '../_shared/game/config.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  let body: { gameId?: string; slotId?: string; dieValue?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { gameId, slotId, dieValue } = body;
  if (!gameId || !slotId || dieValue === undefined) {
    return json({ error: 'gameId, slotId, and dieValue are required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('role')
    .eq('game_id', gameId)
    .eq('client_id', clientId)
    .single();

  if (playerErr || !player) return json({ error: 'Not a player in this game' }, 403);

  const role = player.role as Role;

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('state, config')
    .eq('id', gameId)
    .single();

  if (gameErr || !game) return json({ error: 'Game not found' }, 404);

  const state = game.state as GameState;
  const cfg = game.config as GameConfig;

  const action = { role, slotId, dieValue };
  const validation = validatePlacement(state, action, cfg);
  if (!validation.ok) return json({ error: validation.reason }, 400);

  const nextState = applyPlacement(state, action, cfg);

  // Count existing placements this round for sequence number
  const { count } = await supabase
    .from('placements')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('round', state.round);

  const sequence = (count ?? 0) + 1;

  const { error: placementErr } = await supabase.from('placements').insert({
    game_id: gameId,
    round: state.round,
    player_role: role,
    slot_id: slotId,
    die_value: dieValue,
    sequence,
    revealed: false,
  });

  if (placementErr) return json({ error: placementErr.message }, 500);

  // Update game state
  const { error: updateErr } = await supabase
    .from('games')
    .update({ state: nextState, current_phase: nextState.phase })
    .eq('id', gameId);

  if (updateErr) return json({ error: updateErr.message }, 500);

  // Emit game event (value masked — set to null for Phase 2; Phase 4 will enforce this)
  await supabase.from('game_events').insert({
    game_id: gameId,
    event_type: 'die_placed',
    payload: { role, slotId, value: null, sequence },
  });

  return json({ ok: true, phase: nextState.phase });
});
