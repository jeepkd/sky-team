import type { GameConfig } from './config.ts';

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
  /** Who places first this round (alternates; pilot in round 1). */
  firstPlayer: Role;

  /** Chosen destination airport name (for display). */
  airportName: string;

  /** Plane position on the approach track (1-indexed); airport = approachTrackLength. */
  approachPos: number;

  /** Cumulative signed axis tilt. Positive = toward pilot, negative = toward copilot. */
  axisTilt: number;

  /** Aerodynamics markers on the engine-sum scale. sum<=aeroBlue→0, <=aeroOrange→1, else→2. */
  aeroBlue: number;
  aeroOrange: number;

  /** Last resolved engine sum and advance (for display). */
  speed: number;
  lastAdvance: number;

  /** Flaps deployed so far (0..4), always in order. */
  flapsLevel: number;
  /** Landing gear switches (length 3). */
  gearDeployed: boolean[];
  /** Brakes deployed so far (0..3), always in order [2,4,6]. */
  brakeLevel: number;

  /** Approach-track positions occupied by Airplane tokens (a multiset). */
  traffic: number[];

  placed: PlacedDie[];
  remaining: Record<Role, number[]>;

  /** Shared Coffee tokens (gained from Concentration, spent to ±1 a die). */
  coffee: number;
  /** Shared Reroll tokens available to spend. */
  reroll: number;
  /** A partner who has been granted a one-time free reroll after a token was spent. */
  pendingReroll: Role | null;

  status: 'active' | 'victory' | 'crashed' | 'failed';
}

export interface PlaceAction {
  role: Role;
  slotId: string;
  /** The value placed on the board (after any Coffee adjustment). */
  dieValue: number;
  /**
   * The original die taken from the player's hand. If it differs from dieValue,
   * the difference is paid with Coffee tokens. Defaults to dieValue (no Coffee).
   */
  originalDie?: number;
}

export interface GameEvent {
  type: string;
  payload: Record<string, unknown>;
}
