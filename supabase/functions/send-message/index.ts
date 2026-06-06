import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientId = req.headers.get('x-client-id');
  if (!clientId) return json({ error: 'x-client-id header required' }, 400);

  let body: { gameId?: string; role?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { gameId, role, content } = body;
  if (!gameId || !role || !content?.trim()) {
    return json({ error: 'gameId, role, and content are required' }, 400);
  }

  if (!['pilot', 'copilot', 'ai'].includes(role)) {
    return json({ error: 'Invalid role' }, 400);
  }

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
  if (player.role !== role) return json({ error: 'Role mismatch' }, 403);

  const { error } = await supabase.from('messages').insert({
    game_id: gameId,
    role,
    content: content.trim().slice(0, 200),
  });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
