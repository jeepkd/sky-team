import type { GameConfig } from './config';

export type Role = 'pilot' | 'copilot';

export interface SlotDef {
  id: string;
  group: 'axis' | 'engine' | 'flaps' | 'gear' | 'radio' | 'brakes' | 'concentration';
  owner: Role | 'any';
  validate(die: number, state: GameState, cfg: GameConfig, role?: Role): { ok: true } | { ok: false; reason: string };
}

export interface PlacedDie {
  slotId: string;
  role: Role;
  value: number;
}

export interface GameState {
  round: number;
  phase: 'LOBBY' | 'PLACING' | 'REVEALING' | 'RESOLVING' | 'ENDED';
  turn: Role;
  approachPos: number;
  altitude: number;
  speed: number;
  axisTilt: number;
  flapsLevel: number;
  gearDeployed: boolean[];
  brakeForce: number;
  traffic: number[];
  placed: PlacedDie[];
  remaining: Record<Role, number[]>;
  concentrationTokens: Record<Role, number>;
  coffeeUsed: Record<Role, boolean>;
  status: 'active' | 'victory' | 'crashed' | 'failed';
}

export interface PlaceAction {
  role: Role;
  slotId: string;
  dieValue: number;
}

export interface GameEvent {
  type: string;
  payload: Record<string, unknown>;
}
