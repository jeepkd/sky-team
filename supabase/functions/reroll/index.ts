import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import { validateReroll, applyReroll } from '../_shared/game/concentration.ts';
import type { GameState, Role } from '../_shared/game/types.ts';

function rollOne(): number {
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return (b[0] % 6) + 1;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  let body: { gameId?: string; indices?: number[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { gameId, indices } = body;
  if (!gameId || !Array.isArray(indices)) {
    return json({ error: 'gameId and indices[] are required' }, 400);
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
    .select('state')
    .eq('id', gameId)
    .single();

  if (gameErr || !game) return json({ error: 'Game not found' }, 404);

  const state = game.state as GameState;

  const validation = validateReroll(state, role);
  if (!validation.ok) return json({ error: validation.reason }, 400);

  // Reroll the selected dice positions, keep the rest.
  const newValues = state.remaining[role].map((v, i) => (indices.includes(i) ? rollOne() : v));
  const nextState = applyReroll(state, role, newValues);

  // Keep the dice_rolls.remaining mirror in sync for this round.
  await supabase
    .from('dice_rolls')
    .update({ remaining: newValues })
    .eq('game_id', gameId)
    .eq('round', state.round)
    .eq('player_role', role);

  const { error: updateErr } = await supabase
    .from('games')
    .update({ state: nextState, current_phase: nextState.phase })
    .eq('id', gameId);

  if (updateErr) return json({ error: updateErr.message }, 500);

  await supabase.from('game_events').insert({
    game_id: gameId,
    event_type: 'reroll',
    payload: { role, count: indices.length },
  });

  return json({ ok: true, rerollRemaining: nextState.reroll });
});
