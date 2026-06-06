import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';
import { DEFAULT_CONFIG } from '../_shared/game/config.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

function initialGameState(cfg: typeof DEFAULT_CONFIG) {
  return {
    round: 1,
    phase: 'LOBBY',
    turn: 'pilot',
    approachPos: 0,
    altitude: cfg.rules.speedBands.length,
    speed: 3,
    axisTilt: 0,
    flapsLevel: 0,
    gearDeployed: [false, false],
    brakeForce: 0,
    traffic: cfg.airport.trafficSlots,
    placed: [],
    remaining: { pilot: [], copilot: [] },
    concentrationTokens: {
      pilot: cfg.rules.startingConcentration,
      copilot: cfg.rules.startingConcentration,
    },
    coffeeUsed: { pilot: false, copilot: false },
    status: 'active',
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cfg = DEFAULT_CONFIG;
  const state = initialGameState(cfg);

  let roomCode = '';
  let roomId = '';
  let gameId = '';

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, status: 'lobby' })
      .select('id')
      .single();

    if (roomErr) {
      if (roomErr.code === '23505') continue; // unique violation — retry
      return json({ error: roomErr.message }, 500);
    }

    roomCode = code;
    roomId = room.id;

    const { data: game, error: gameErr } = await supabase
      .from('games')
      .insert({
        room_id: roomId,
        status: 'lobby',
        current_round: 1,
        current_phase: 'LOBBY',
        state,
        config: cfg,
      })
      .select('id')
      .single();

    if (gameErr) return json({ error: gameErr.message }, 500);
    gameId = game.id;
    break;
  }

  if (!roomCode) return json({ error: 'Could not generate unique room code' }, 500);

  const { error: playerErr } = await supabase.from('players').insert({
    game_id: gameId,
    role: 'pilot',
    client_id: clientId,
    is_ai: false,
    connected: true,
  });

  if (playerErr) return json({ error: playerErr.message }, 500);

  return json({ roomCode, gameId, role: 'pilot' });
});
