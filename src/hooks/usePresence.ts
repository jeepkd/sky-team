import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/types';

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

// supabase.channel() deduplicates by topic. In React StrictMode the async
// removeChannel cleanup hasn't finished before the second effect fires, so the
// stale subscribed channel is returned and .on('presence') throws. We work
// around this by synchronously purging matching channels from the internal list
// and firing unsubscribe in the background for server-side cleanup.
function purgeChannel(topic: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtime = (supabase as any).realtime;
  if (!realtime?.channels) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtime.channels = realtime.channels.filter((c: any) => {
    if (c.topic === topic) {
      c.unsubscribe().catch(() => {});
      return false;
    }
    return true;
  });
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
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, role, clientId]);

  return { online };
}
