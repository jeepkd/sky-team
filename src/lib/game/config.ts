// Exact Sky Team base-game values (rules) transcribed from the official Scorpion
// Masqué rulebook. Per-destination traffic layouts are printed on the physical
// approach-track components; only YUL Montréal is verified, the others are
// playable approximations marked TODO_RULEBOOK.

/** A space that accepts a die showing either of two values (e.g. the "3/4" space). */
export type ValuePair = [number, number];

export interface RulesConfig {
  dicePerPlayer: number;
  totalRounds: number;
  aeroBlueStart: number;
  aeroOrangeStart: number;
  flaps: ValuePair[];
  gear: ValuePair[];
  brakes: number[];
  brakeThresholds: number[];
  radioPilotSlots: number;
  radioCopilotSlots: number;
  concentrationSlots: number;
  coffeeMax: number;
  rerollTokens: number;
  /** Rounds (1-indexed) whose altitude space grants a reroll token at round start. */
  rerollRounds: number[];
  axisSpinLimit: number;
}

export interface Destination {
  id: string;
  name: string;
  difficulty: 'Intro' | 'Easy' | 'Medium' | 'Hard';
  /** Number of spaces from the plane's start (1) to the airport. */
  approachTrackLength: number;
  /** Approach-track positions (1-indexed) holding an Airplane token at setup; repeats = stacked planes. */
  trafficSlots: number[];
}

export type AirportConfig = Destination;

export interface GameConfig {
  rules: RulesConfig;
  airport: AirportConfig;
}

export const RULES: RulesConfig = {
  dicePerPlayer: 4,
  totalRounds: 7,
  // Blue marker between 4 and 5, orange between 8 and 9.
  aeroBlueStart: 4,
  aeroOrangeStart: 8,
  // Flaps deployed in order 1/2 → 2/3 → 3/4 → 4/5 (orange marker ends just past 12).
  flaps: [[1, 2], [2, 3], [3, 4], [4, 5]],
  // Landing gear spaces 1/2, 3/4, 5/6 (blue marker ends between 7 and 8).
  gear: [[1, 2], [3, 4], [5, 6]],
  // Brakes deployed in order: 2, then 4, then 6.
  brakes: [2, 4, 6],
  // Red brake marker thresholds by number deployed (0..3): left-of-2, 2/3, 4/5, 6/7.
  brakeThresholds: [2, 3, 5, 7],
  radioPilotSlots: 1,
  radioCopilotSlots: 2,
  concentrationSlots: 3,
  coffeeMax: 3,
  rerollTokens: 2,
  rerollRounds: [1, 4], // TODO_RULEBOOK: exact altitude spaces with reroll icons.
  axisSpinLimit: 3, // Valid axis is -2..+2; |tilt| >= 3 reaches the X and is a loss.
};

// All 7 rounds long. Difficulty is driven by how much traffic clogs the approach.
// TODO_RULEBOOK: real per-airport traffic layouts are printed on each track.
export const DESTINATIONS: Destination[] = [
  { id: 'yul', name: 'YUL Montréal-Trudeau', difficulty: 'Intro', approachTrackLength: 7, trafficSlots: [3, 5] },
  { id: 'ord', name: "ORD Chicago O'Hare", difficulty: 'Easy', approachTrackLength: 7, trafficSlots: [2, 4, 6] },
  { id: 'dca', name: 'DCA Washington Reagan', difficulty: 'Medium', approachTrackLength: 7, trafficSlots: [2, 3, 5, 6] },
  { id: 'hnd', name: 'HND Tokyo Haneda', difficulty: 'Hard', approachTrackLength: 7, trafficSlots: [2, 3, 4, 5, 6, 6] },
];

export function makeConfig(destinationId?: string): GameConfig {
  const airport = DESTINATIONS.find((d) => d.id === destinationId) ?? DESTINATIONS[0];
  return { rules: RULES, airport };
}

export const DEFAULT_CONFIG: GameConfig = makeConfig();
