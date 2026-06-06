export interface RulesConfig {
  dicePerPlayer: number;
  /** Absolute max axis tilt per round; index 0 = round 1. */
  axisTiltLimitPerRound: number[];
  /** Speed must be within [minSpeed, maxSpeed] at the given altitude level. */
  speedBands: Array<{ altitude: number; minSpeed: number; maxSpeed: number }>;
  /** Minimum die value to occupy each flap position; index 0 = first flap. */
  flapsRequirements: number[];
  /** Minimum die value to deploy a landing gear position. */
  gearMinValue: number;
  /** Sum of all brake dice must not exceed this value. */
  brakeMaxForce: number;
  /** Number of spaces on the approach track (including start and runway). */
  approachTrackLength: number;
  /** Concentration tokens each player starts with. */
  startingConcentration: number;
}

export interface AirportConfig {
  name: string;
  /** Approach track positions that have a traffic token at game start. */
  trafficSlots: number[];
}

export interface GameConfig {
  rules: RulesConfig;
  airport: AirportConfig;
}

// TODO_RULEBOOK: placeholders below — fill in after user verifies against rulebook.
export const DEFAULT_CONFIG: GameConfig = {
  rules: {
    dicePerPlayer: 4,
    axisTiltLimitPerRound: [], // TODO_RULEBOOK: [limit_round1, limit_round2, ...]
    speedBands: [],            // TODO_RULEBOOK: [{ altitude, minSpeed, maxSpeed }, ...]
    flapsRequirements: [],     // TODO_RULEBOOK: [min_flap1, min_flap2, ...]
    gearMinValue: 0,           // TODO_RULEBOOK
    brakeMaxForce: 0,          // TODO_RULEBOOK
    approachTrackLength: 0,    // TODO_RULEBOOK
    startingConcentration: 0,  // TODO_RULEBOOK
  },
  airport: {
    name: 'Base Airport',
    trafficSlots: [],          // TODO_RULEBOOK: positions on the approach track
  },
};
