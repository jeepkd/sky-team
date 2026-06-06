import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
  const { data: caller } = await supabase
    .from('players')
    .select('role')
    .eq('game_id', gameId)
    .eq('client_id', clientId)
    .single();

  if (!caller) return json({ error: 'Not a player in this game' }, 403);

  // Find taken roles
  const { data: players } = await supabase
    .from('players')
    .select('role, is_ai')
    .eq('game_id', gameId);

  if (!players) return json({ error: 'Could not load players' }, 500);

  // Check not already full
  if (players.length >= 2) return json({ error: 'Game already has two players' }, 409);
  if (players.some((p) => p.is_ai)) return json({ error: 'AI player already added' }, 409);

  const takenRoles = new Set(players.map((p) => p.role));
  const aiRole = ['pilot', 'copilot'].find((r) => !takenRoles.has(r));
  if (!aiRole) return json({ error: 'No available role for AI' }, 409);

  // Synthetic stable UUID for AI (one per game, deterministic-ish)
  const aiClientId = crypto.randomUUID();

  const { data: game } = await supabase
    .from('games')
    .select('room_id')
    .eq('id', gameId)
    .single();

  if (!game) return json({ error: 'Game not found' }, 404);

  const { error } = await supabase.from('players').insert({
    game_id: gameId,
    room_id: game.room_id,
    client_id: aiClientId,
    role: aiRole,
    is_ai: true,
    connected: true,
  });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, role: aiRole });
});
