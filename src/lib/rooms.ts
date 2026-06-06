import { supabase, getClientId } from '@/lib/supabase';
import type { Player, Role, Session } from '@/types';
import { ROLES } from '@/types';

// 32-char unambiguous alphabet: no O/0/I/1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let code = '';
  for (const b of bytes) {
    code += ALPHABET[b % 32];
  }
  return code;
}

export async function createRoom(): Promise<Session> {
  const clientId = getClientId();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, status: 'lobby' })
      .select('id')
      .single();

    if (roomErr) {
      if (roomErr.code === '23505') continue; // unique collision — retry
      throw roomErr;
    }

    const { data: game, error: gameErr } = await supabase
      .from('games')
      .insert({ room_id: room.id, status: 'lobby', current_phase: 'LOBBY' })
      .select('id')
      .single();

    if (gameErr) throw gameErr;

    const { error: playerErr } = await supabase
      .from('players')
      .insert({ game_id: game.id, role: 'pilot' as Role, client_id: clientId });

    if (playerErr) throw playerErr;

    return { roomCode: code, gameId: game.id, role: 'pilot' };
  }

  throw new Error('Failed to generate a unique room code after 5 attempts');
}

export async function joinRoom(code: string): Promise<Session> {
  const normalizedCode = code.trim().toUpperCase();
  const clientId = getClientId();

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id')
    .eq('code', normalizedCode)
    .single();

  if (roomErr || !room) throw new Error('Room not found');

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id')
    .eq('room_id', room.id)
    .single();

  if (gameErr || !game) throw new Error('Room not found');

  const players = await fetchPlayers(game.id);

  // Rejoin: this client already owns a seat
  const existing = players.find((p) => p.client_id === clientId);
  if (existing) {
    return { roomCode: normalizedCode, gameId: game.id, role: existing.role };
  }

  // Take the first empty seat in ROLES order
  for (const role of ROLES) {
    const taken = players.some((p) => p.role === role);
    if (!taken) {
      const { error: insertErr } = await supabase
        .from('players')
        .insert({ game_id: game.id, role, client_id: clientId });

      if (insertErr) {
        if (insertErr.code === '23505') continue; // race — try next seat
        throw insertErr;
      }

      return { roomCode: normalizedCode, gameId: game.id, role };
    }
  }

  throw new Error('Room is full');
}

export async function fetchPlayers(gameId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId);

  if (error) throw error;
  return (data ?? []) as Player[];
}
