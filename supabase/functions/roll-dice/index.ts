import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import type { GameState, Role } from '../_shared/game/types.ts';

function rollDice(count: number): number[] {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => (b % 6) + 1);
}

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

  // Verify caller is a player in this game
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
  const cfg = game.config as { rules: { dicePerPlayer: number } };
  const dicePerPlayer = cfg?.rules?.dicePerPlayer ?? 4;
  const round = state.round;
  const role = player.role as Role;

  // Idempotent: if already rolled this round, return ok
  const { data: existing } = await supabase
    .from('dice_rolls')
    .select('id')
    .eq('game_id', gameId)
    .eq('round', round)
    .eq('player_role', role)
    .maybeSingle();

  if (existing) return json({ ok: true });

  const values = rollDice(dicePerPlayer);

  const { error: rollErr } = await supabase.from('dice_rolls').insert({
    game_id: gameId,
    round,
    player_role: role,
    values,
    remaining: values,
  });

  if (rollErr) return json({ error: rollErr.message }, 500);

  // Check if both players have rolled — if so, advance game phase to PLACING
  const { data: rolls } = await supabase
    .from('dice_rolls')
    .select('player_role, remaining')
    .eq('game_id', gameId)
    .eq('round', round);

  if (rolls && rolls.length >= 2) {
    const newRemaining: Record<string, number[]> = {};
    for (const r of rolls) {
      newRemaining[r.player_role] = r.remaining;
    }

    const updatedState: GameState = {
      ...state,
      phase: 'PLACING',
      turn: 'pilot',
      remaining: newRemaining as Record<Role, number[]>,
    };

    await supabase
      .from('games')
      .update({ state: updatedState, current_phase: 'PLACING' })
      .eq('id', gameId);
  }

  return json({ ok: true });
});
