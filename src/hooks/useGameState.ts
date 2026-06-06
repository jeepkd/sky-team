import { useEffect, useRef, useState } from 'react';
import { supabase, purgeChannel } from '@/lib/supabase';
import type { GameState, Role } from '@/lib/game/types';

// Replace opponent dice values with zeros (preserves count for the face-down token UI)
// while keeping our own dice intact. Mirrors the DB-side mask_game_state_for_client().
function maskOpponentDice(state: GameState, myRole: Role): GameState {
  const opponentRole: Role = myRole === 'pilot' ? 'copilot' : 'pilot';
  const opponentCount = state.remaining[opponentRole].length;
  return {
    ...state,
    remaining: {
      ...state.remaining,
      [opponentRole]: Array(opponentCount).fill(0),
    },
  };
}

export function useGameState(gameId: string | null, myRole: Role | null = null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!gameId) return;

    async function loadState() {
      // Use the masked_games view for initial REST fetch — opponent dice are zeroed by DB function
      const { data } = await supabase
        .from('masked_games')
        .select('state')
        .eq('id', gameId)
        .single();
      if (data?.state) setGameState(data.state as GameState);
    }

    loadState();

    const topic = `game-state:${gameId}`;
    purgeChannel(topic);

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as { state: GameState };
          if (!row.state) return;
          // Realtime delivers the full row (Supabase doesn't support per-column masking in
          // realtime). Apply client-side masking to strip opponent dice values.
          const masked = myRole ? maskOpponentDice(row.state, myRole) : row.state;
          setGameState(masked);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, myRole]);

  return gameState;
}
