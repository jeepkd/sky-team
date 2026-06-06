import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  let body: { code?: string; asAi?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const code = body.code?.toUpperCase().trim();
  if (!code) return json({ error: 'code is required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Find room by code
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id')
    .eq('code', code)
    .single();

  if (roomErr || !room) return json({ error: 'Room not found' }, 404);

  // Find game for this room
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id')
    .eq('room_id', room.id)
    .single();

  if (gameErr || !game) return json({ error: 'Game not found' }, 500);

  const gameId = game.id;

  // Load existing players
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (playersErr) return json({ error: playersErr.message }, 500);

  // Check if this client already has a seat (rejoin)
  const existing = players?.find((p) => p.client_id === clientId);
  if (existing) {
    return json({ gameId, role: existing.role });
  }

  // Determine available role
  const takenRoles = new Set(players?.map((p) => p.role) ?? []);
  const availableRole = ['pilot', 'copilot'].find((r) => !takenRoles.has(r));

  if (!availableRole) return json({ error: 'Room is full' }, 409);

  const { error: insertErr } = await supabase.from('players').insert({
    game_id: gameId,
    role: availableRole,
    client_id: clientId,
    is_ai: body.asAi ?? false,
    connected: true,
  });

  if (insertErr) return json({ error: insertErr.message }, 500);

  return json({ gameId, role: availableRole });
});
