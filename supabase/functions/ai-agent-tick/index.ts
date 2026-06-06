import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSlots } from '../_shared/game/slots.ts';
import { validatePlacement, applyPlacement } from '../_shared/game/validate.ts';
import { DEFAULT_CONFIG } from '../_shared/game/config.ts';
import type { GameState, Role } from '../_shared/game/types.ts';

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

function rollDice(count: number): number[] {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => (b % 6) + 1);
}

const AI_SYSTEM = `You are a Sky Team co-pilot AI. Sky Team is a cooperative 2-player dice game where pilot and copilot place dice on instrument slots to land a plane.

You play as the COPILOT. You will be given:
- Your current dice (secret — never share the exact values in chat)
- Valid placements available to you
- The current game state

Your task: choose the best die-to-slot placement using the place_die tool.

Strategy priorities (highest to lowest):
1. Engine (right, values 4-6) — essential every round for speed
2. Axis (copilot) — prevents tilt crash
3. Gear (right, copilot, value ≥3) — needed before landing round
4. Flaps — sequential, fill when possible
5. Radio — any value, fill if you have no better use
6. Concentration — use only when you have no valid slot for a die

After deciding, send a short in-character chat message (1-2 sentences, aviation tone, do NOT reveal your dice values).`;

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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'AI not configured — set ANTHROPIC_API_KEY secret' }, 503);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify caller is a human player in this game
  const { data: callerPlayer } = await supabase
    .from('players')
    .select('role, is_ai')
    .eq('game_id', gameId)
    .eq('client_id', clientId)
    .single();

  if (!callerPlayer || callerPlayer.is_ai) {
    return json({ error: 'Not a human player in this game' }, 403);
  }

  // Find the AI player
  const { data: aiPlayer } = await supabase
    .from('players')
    .select('role')
    .eq('game_id', gameId)
    .eq('is_ai', true)
    .single();

  if (!aiPlayer) return json({ error: 'No AI player in this game' }, 404);

  const aiRole = aiPlayer.role as Role;

  // Load current game state
  const { data: game } = await supabase
    .from('games')
    .select('state, config')
    .eq('id', gameId)
    .single();

  if (!game) return json({ error: 'Game not found' }, 404);

  let state = game.state as GameState;
  const cfg = game.config ?? DEFAULT_CONFIG;

  // ── Auto-roll for AI if needed ──────────────────────────────────────────────
  if (state.phase === 'PLACING' || state.phase === 'LOBBY') {
    const { data: existingRoll } = await supabase
      .from('dice_rolls')
      .select('id, remaining')
      .eq('game_id', gameId)
      .eq('round', state.round)
      .eq('player_role', aiRole)
      .maybeSingle();

    if (!existingRoll) {
      const dicePerPlayer = cfg?.rules?.dicePerPlayer ?? 4;
      const values = rollDice(dicePerPlayer);
      await supabase.from('dice_rolls').insert({
        game_id: gameId,
        round: state.round,
        player_role: aiRole,
        values,
        remaining: values,
      });

      // Check if both have rolled now
      const { data: allRolls } = await supabase
        .from('dice_rolls')
        .select('player_role, remaining')
        .eq('game_id', gameId)
        .eq('round', state.round);

      if (allRolls && allRolls.length >= 2) {
        const newRemaining: Record<string, number[]> = {};
        for (const r of allRolls) newRemaining[r.player_role] = r.remaining;
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
        state = updatedState;
      }
    }
  }

  // ── Only act if it's AI's turn ──────────────────────────────────────────────
  if (state.phase !== 'PLACING' || state.turn !== aiRole) {
    return json({ ok: true, action: 'none', reason: 'Not AI turn' });
  }

  const aiDice = state.remaining[aiRole];
  if (aiDice.length === 0) return json({ ok: true, action: 'none', reason: 'No dice left' });

  // Build valid placements
  const slots = buildSlots(cfg);
  const validPlacements: { slotId: string; dieValue: number; group: string }[] = [];
  for (const die of aiDice) {
    for (const slot of slots) {
      const result = validatePlacement(
        state,
        { role: aiRole, slotId: slot.id, dieValue: die },
        cfg,
      );
      if (result.ok && !validPlacements.some((v) => v.slotId === slot.id && v.dieValue === die)) {
        validPlacements.push({ slotId: slot.id, dieValue: die, group: slot.group });
      }
    }
  }

  if (validPlacements.length === 0) {
    // Emergency: all dice unplaceable — put first die in concentration slot as last resort
    const concentrationSlot = `concentration_${aiRole}`;
    if (state.concentrationTokens[aiRole] > 0 && !state.placed.some((p) => p.slotId === concentrationSlot)) {
      validPlacements.push({ slotId: concentrationSlot, dieValue: aiDice[0], group: 'concentration' });
    } else {
      return json({ ok: false, error: 'No valid placements available for AI' });
    }
  }

  // ── Call Claude to select placement ────────────────────────────────────────
  const placementList = validPlacements
    .map((p) => `  - slot "${p.slotId}" (${p.group}) with die value ${p.dieValue}`)
    .join('\n');

  const userMsg = `Round ${state.round}. Approach position: ${state.approachPos}/${cfg?.rules?.approachTrackLength ?? 7}. Axis tilt: ${state.axisTilt}. Speed: ${state.speed}. Flaps: ${state.flapsLevel}. Gear deployed: ${state.gearDeployed.join(', ')}.

Your dice (DO NOT reveal exact values in chat): [${aiDice.join(', ')}]

Valid placements:
${placementList}

Use the place_die tool to select ONE placement, then send a short in-character message.`;

  const tools = [
    {
      name: 'place_die',
      description: 'Place one of your dice in a valid slot.',
      input_schema: {
        type: 'object',
        properties: {
          slotId: { type: 'string', description: 'The slot ID to place the die in', enum: validPlacements.map((p) => p.slotId) },
          dieValue: { type: 'number', description: 'The die value to place', enum: [...new Set(validPlacements.map((p) => p.dieValue))] },
          chatMessage: { type: 'string', description: 'Short in-character tactical comment (no die values!)' },
        },
        required: ['slotId', 'dieValue', 'chatMessage'],
      },
    },
  ];

  let chosenPlacement: { slotId: string; dieValue: number; chatMessage: string } | null = null;
  let attempt = 0;
  let lastError = '';

  while (attempt < 3 && !chosenPlacement) {
    attempt++;
    const messages: { role: string; content: string }[] = [
      { role: 'user', content: attempt === 1 ? userMsg : `${userMsg}\n\nPrevious attempt failed: ${lastError}. Choose a different valid placement.` },
    ];

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: AI_SYSTEM,
        tools,
        tool_choice: { type: 'required' },
        messages,
      }),
    });

    if (!claudeRes.ok) {
      lastError = `Claude API ${claudeRes.status}`;
      continue;
    }

    const claudeData = await claudeRes.json();
    const toolUse = claudeData.content?.find((b: { type: string }) => b.type === 'tool_use');
    if (!toolUse) { lastError = 'No tool use in response'; continue; }

    const input = toolUse.input as { slotId: string; dieValue: number; chatMessage: string };

    // Validate the chosen placement
    const validation = validatePlacement(
      state,
      { role: aiRole, slotId: input.slotId, dieValue: input.dieValue },
      cfg,
    );

    if (!validation.ok) {
      lastError = validation.reason;
      continue;
    }

    chosenPlacement = input;
  }

  // Fallback to first valid placement if Claude failed
  if (!chosenPlacement) {
    const fallback = validPlacements[0];
    chosenPlacement = {
      slotId: fallback.slotId,
      dieValue: fallback.dieValue,
      chatMessage: 'Roger that, executing placement.',
    };
  }

  // ── Execute placement ───────────────────────────────────────────────────────
  const newState = applyPlacement(
    state,
    { role: aiRole, slotId: chosenPlacement.slotId, dieValue: chosenPlacement.dieValue },
    cfg,
  );

  // Persist placement record
  await supabase.from('placements').insert({
    game_id: gameId,
    round: state.round,
    player_role: aiRole,
    slot_id: chosenPlacement.slotId,
    die_value: chosenPlacement.dieValue,
    revealed: false,
  });

  // Update game state
  await supabase
    .from('games')
    .update({ state: newState, current_phase: newState.phase })
    .eq('id', gameId);

  // Send chat message (do not reveal die values)
  const safeMessage = chosenPlacement.chatMessage.replace(/\b[1-6]\b/g, '?');
  await supabase.from('messages').insert({
    game_id: gameId,
    role: 'ai',
    content: safeMessage,
  });

  return json({
    ok: true,
    action: 'placed',
    slotId: chosenPlacement.slotId,
    dieValue: chosenPlacement.dieValue,
  });
});
