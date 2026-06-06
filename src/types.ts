export type Role = 'pilot' | 'copilot';
export const ROLES: Role[] = ['pilot', 'copilot'];

export interface Player {
  id: string;
  game_id: string;
  role: Role;
  client_id: string | null;
  is_ai: boolean;
  connected: boolean;
  created_at: string;
}

export interface Session {
  roomCode: string;
  gameId: string;
  role: Role;
}
