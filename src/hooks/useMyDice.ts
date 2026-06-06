import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/game/types';

export function useMyDice(gameId: string | null, role: Role | null, round: number) {
  const [remaining, setRemaining] = useState<number[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!gameId || !role) return;

    async function loadDice() {
      const { data } = await supabase
        .from('dice_rolls')
        .select('remaining')
        .eq('game_id', gameId)
        .eq('round', round)
        .eq('player_role', role)
        .maybeSingle();
      setRemaining(data?.remaining ?? []);
    }

    loadDice();

    const topic = `my-dice:${gameId}:${role}:${round}`;
    supabase.channel(topic).unsubscribe();

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dice_rolls',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as { player_role: string; round: number; remaining: number[] };
          if (row.player_role === role && row.round === round) {
            setRemaining(row.remaining ?? []);
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, role, round]);

  return remaining;
}
