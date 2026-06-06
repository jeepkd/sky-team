import { supabase, getClientId } from '@/lib/supabase';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

async function callFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'x-client-id': getClientId(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `${name} failed (${res.status})`);
  return data as T;
}

export async function createRoom(): Promise<{ roomCode: string; gameId: string; role: string }> {
  return callFunction('create-room', {});
}

export async function joinRoom(code: string): Promise<{ gameId: string; role: string }> {
  return callFunction('join-room', { code });
}

export async function rollDice(gameId: string): Promise<{ ok: boolean }> {
  return callFunction('roll-dice', { gameId });
}

export async function placeDie(
  gameId: string,
  slotId: string,
  dieValue: number,
): Promise<{ ok: boolean; phase: string }> {
  return callFunction('place-die', { gameId, slotId, dieValue });
}

export async function revealRound(gameId: string): Promise<{ ok: boolean }> {
  return callFunction('reveal-round', { gameId });
}

export async function resolveRound(gameId: string): Promise<{ ok: boolean; status: string; phase: string }> {
  return callFunction('resolve-round', { gameId });
}

export { supabase };
