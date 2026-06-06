import { supabase, getClientId } from '@/lib/supabase';
import type { Role } from '@/types';

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

export async function createRoom(role: Role = 'pilot'): Promise<{ roomCode: string; gameId: string; role: Role }> {
  return callFunction('create-room', { role });
}

export async function joinRoom(code: string): Promise<{ gameId: string; role: Role }> {
  return callFunction('join-room', { code });
}

export async function rollDice(gameId: string): Promise<{ ok: boolean }> {
  return callFunction('roll-dice', { gameId });
}

export async function placeDie(
  gameId: string,
  slotId: string,
  dieValue: number,
  originalDie?: number,
): Promise<{ ok: boolean; phase: string; status: string }> {
  return callFunction('place-die', { gameId, slotId, dieValue, originalDie });
}

export async function reroll(gameId: string, indices: number[]): Promise<{ ok: boolean; rerollRemaining: number }> {
  return callFunction('reroll', { gameId, indices });
}

export async function sendMessage(gameId: string, role: string, content: string): Promise<void> {
  return callFunction('send-message', { gameId, role, content });
}

export async function triggerAiTick(gameId: string): Promise<{ ok: boolean; action?: string }> {
  return callFunction('ai-agent-tick', { gameId });
}

export async function addAiPlayer(gameId: string): Promise<{ ok: boolean; role: string }> {
  return callFunction('add-ai-player', { gameId });
}

export { supabase };
