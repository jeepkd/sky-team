import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import type { GameState } from '../_shared/game/types.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  let body: { gameId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { gameId } = body;
  if (!gameId) return json({ error: 'gameId is required' }, 400);

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

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('state')
    .eq('id', gameId)
    .single();

  if (gameErr || !game) return json({ error: 'Game not found' }, 404);

  const state = game.state as GameState;
  if (state.phase !== 'REVEALING') {
    return json({ error: `Cannot reveal in phase ${state.phase}` }, 400);
  }

  const round = state.round;

  // Atomically reveal all placements for this round
  const { error: revealErr } = await supabase
    .from('placements')
    .update({ revealed: true })
    .eq('game_id', gameId)
    .eq('round', round);

  if (revealErr) return json({ error: revealErr.message }, 500);

  // Advance state to RESOLVING
  const resolvingState: GameState = { ...state, phase: 'RESOLVING' };
  await supabase
    .from('games')
    .update({ state: resolvingState, current_phase: 'RESOLVING' })
    .eq('id', gameId);

  await supabase.from('game_events').insert({
    game_id: gameId,
    event_type: 'round_revealed',
    payload: { round },
  });

  return json({ ok: true });
});
