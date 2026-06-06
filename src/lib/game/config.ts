export interface RulesConfig {
  dicePerPlayer: number;
  /** Absolute max axis tilt (|pilot - copilot|) per round; index 0 = round 1. */
  axisTiltLimitPerRound: number[];
  /** Speed must be within [minSpeed, maxSpeed] at the given altitude level. */
  speedBands: Array<{ altitude: number; minSpeed: number; maxSpeed: number }>;
  /** Minimum die value to occupy each flap position; index 0 = first flap. */
  flapsRequirements: number[];
  /** Minimum die value to deploy a landing gear slot. */
  gearMinValue: number;
  /** Sum of all brake dice must not exceed this value to avoid crashing. */
  brakeMaxForce: number;
  /** Number of positions on the approach track (rounds before landing). */
  approachTrackLength: number;
  /** Concentration tokens each player starts with. */
  startingConcentration: number;
}

export interface AirportConfig {
  name: string;
  /** Approach track positions (1-indexed) that have a traffic token at game start. */
  trafficSlots: number[];
}

export interface GameConfig {
  rules: RulesConfig;
  airport: AirportConfig;
}

// TODO_RULEBOOK: all numeric values below need user verification against the physical rulebook.
// These are best-estimate placeholders to keep the engine runnable; run P2.0 verify to confirm.
export const DEFAULT_CONFIG: GameConfig = {
  rules: {
    dicePerPlayer: 4,
    // Tilt limit (absolute value of pilot_die - copilot_die) relaxes early, tightens near runway.
    // 7 rounds total for base Zürich airport. TODO_RULEBOOK: confirm exact limits per round.
    axisTiltLimitPerRound: [5, 5, 4, 4, 3, 3, 2],
    // Altitude/speed corridors. The plane must stay within band for its current altitude.
    // TODO_RULEBOOK: confirm altitude levels and min/max speed values.
    speedBands: [
      { altitude: 5, minSpeed: 2, maxSpeed: 5 },
      { altitude: 4, minSpeed: 2, maxSpeed: 5 },
      { altitude: 3, minSpeed: 2, maxSpeed: 4 },
      { altitude: 2, minSpeed: 1, maxSpeed: 4 },
      { altitude: 1, minSpeed: 1, maxSpeed: 3 },
    ],
    // 4 flap positions, each requiring at least this die value. TODO_RULEBOOK.
    flapsRequirements: [2, 3, 4, 5],
    // Minimum die value to lock a landing gear position. TODO_RULEBOOK.
    gearMinValue: 3,
    // Brake dice sum must not exceed this or the plane runs off the runway. TODO_RULEBOOK.
    brakeMaxForce: 9,
    // Number of approach track rounds before landing phase. TODO_RULEBOOK.
    approachTrackLength: 7,
    // Concentration tokens per player at game start. TODO_RULEBOOK.
    startingConcentration: 3,
  },
  airport: {
    name: 'Zürich (Base)',
    // Approach track positions with traffic tokens. TODO_RULEBOOK: confirm positions.
    trafficSlots: [3, 5],
  },
};
