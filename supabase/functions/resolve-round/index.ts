import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import { resolveRound } from '../_shared/game/resolve.ts';
import type { GameState } from '../_shared/game/types.ts';
import type { GameConfig } from '../_shared/game/config.ts';

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
    .select('state, config')
    .eq('id', gameId)
    .single();

  if (gameErr || !game) return json({ error: 'Game not found' }, 404);

  const state = game.state as GameState;
  const cfg = game.config as GameConfig;

  if (state.phase !== 'RESOLVING') {
    return json({ error: `Cannot resolve in phase ${state.phase}` }, 400);
  }

  const { state: nextState, events } = resolveRound(state, cfg);

  // Persist new state
  const { error: updateErr } = await supabase
    .from('games')
    .update({
      state: nextState,
      status: nextState.status === 'active' ? 'active' : nextState.status,
      current_round: nextState.round,
      current_phase: nextState.phase,
    })
    .eq('id', gameId);

  if (updateErr) return json({ error: updateErr.message }, 500);

  // Emit all resolution events
  if (events.length > 0) {
    await supabase.from('game_events').insert(
      events.map((e) => ({
        game_id: gameId,
        event_type: e.type,
        payload: e.payload,
      })),
    );
  }

  return json({ ok: true, status: nextState.status, phase: nextState.phase });
});
