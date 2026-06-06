import { useEffect, useState } from 'react';
import { supabase, purgeChannel } from '@/lib/supabase';
import type { Role } from '@/types';

async function markConnected(gameId: string, clientId: string, connected: boolean) {
  await supabase
    .from('players')
    .update(connected
      ? { connected: true, disconnected_at: null }
      : { connected: false, disconnected_at: new Date().toISOString() }
    )
    .eq('game_id', gameId)
    .eq('client_id', clientId);
}

interface PresencePayload {
  role: Role;
  clientId: string;
}

type OnlineState = Record<Role, boolean>;

const OFFLINE: OnlineState = { pilot: false, copilot: false };

function deriveOnline(state: Record<string, PresencePayload[]>): OnlineState {
  const result: OnlineState = { pilot: false, copilot: false };
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p.role === 'pilot' || p.role === 'copilot') result[p.role] = true;
    }
  }
  return result;
}


export function usePresence(
  gameId: string,
  role: Role,
  clientId: string,
): { online: OnlineState } {
  const [online, setOnline] = useState<OnlineState>(OFFLINE);

  useEffect(() => {
    const topic = `realtime:game:${gameId}`;
    purgeChannel(topic);

    const channel = supabase.channel(`game:${gameId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(deriveOnline(channel.presenceState<PresencePayload>()));
      })
      .on('presence', { event: 'join' }, () => {
        setOnline(deriveOnline(channel.presenceState<PresencePayload>()));
      })
      .on('presence', { event: 'leave' }, () => {
        setOnline(deriveOnline(channel.presenceState<PresencePayload>()));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ role, clientId } satisfies PresencePayload);
          await markConnected(gameId, clientId, true);
        }
      });

    return () => {
      markConnected(gameId, clientId, false).catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [gameId, role, clientId]);

  return { online };
}
