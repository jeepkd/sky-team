import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { GameState } from '@/lib/game/types';

export function useGameState(gameId: string | null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!gameId) return;

    async function loadState() {
      const { data } = await supabase
        .from('games')
        .select('state')
        .eq('id', gameId)
        .single();
      if (data?.state) setGameState(data.state as GameState);
    }

    loadState();

    // Purge stale channel before creating (StrictMode dedup workaround)
    const topic = `game-state:${gameId}`;
    supabase.channel(topic).unsubscribe();

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as { state: GameState };
          if (row.state) setGameState(row.state);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [gameId]);

  return gameState;
}
