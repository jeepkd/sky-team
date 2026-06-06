import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import { validateTakeback, applyTakeback } from '../_shared/game/concentration.ts';
import type { GameState, Role } from '../_shared/game/types.ts';
import type { GameConfig } from '../_shared/game/config.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  let body: { gameId?: string; takenBackSlotId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { gameId, takenBackSlotId } = body;
  if (!gameId || !takenBackSlotId) {
    return json({ error: 'gameId and takenBackSlotId are required' }, 400);
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

  const validation = validateTakeback(state, takenBackSlotId, role, cfg);
  if (!validation.ok) return json({ error: validation.reason }, 400);

  const nextState = applyTakeback(state, takenBackSlotId, role);

  // Remove the original placement record from DB
  await supabase
    .from('placements')
    .delete()
    .eq('game_id', gameId)
    .eq('round', state.round)
    .eq('player_role', role)
    .eq('slot_id', takenBackSlotId);

  const { error: updateErr } = await supabase
    .from('games')
    .update({ state: nextState, current_phase: nextState.phase })
    .eq('id', gameId);

  if (updateErr) return json({ error: updateErr.message }, 500);

  await supabase.from('game_events').insert({
    game_id: gameId,
    event_type: 'concentration_used',
    payload: { role, takenBackSlotId, tokensRemaining: nextState.concentrationTokens[role] },
  });

  return json({ ok: true });
});
