// Exact Sky Team base-game values (YUL Montréal-Trudeau) transcribed from the
// official Scorpion Masqué rulebook. Values printed only on physical components
// (the YUL approach-track traffic layout and the exact axis marks-to-X) are not
// in the rules text and are marked TODO_RULEBOOK with playable placeholders.

/** A space that accepts a die showing either of two values (e.g. the "3/4" space). */
export type ValuePair = [number, number];

export interface RulesConfig {
  dicePerPlayer: number;
  totalRounds: number;

  /** Engine-sum boundaries. sum <= aeroBlueStart → 0 spaces; <= aeroOrangeStart → 1; else 2. */
  aeroBlueStart: number;
  aeroOrangeStart: number;

  /** Flaps: deployed in order, top to bottom; each space accepts one of its two values. */
  flaps: ValuePair[];
  /** Landing gear (pilot): order-free; each space accepts one of its two values. */
  gear: ValuePair[];
  /** Brakes (pilot): deployed in order; each space requires an exact value. */
  brakes: number[];
  /** Final-round landing: speed must be < brakeThresholds[brakeLevel]. Index 0 = none deployed. */
  brakeThresholds: number[];

  radioPilotSlots: number;
  radioCopilotSlots: number;

  concentrationSlots: number;
  coffeeMax: number;

  rerollTokens: number;
  /** Rounds (1-indexed) whose altitude space grants a reroll token at round start. */
  rerollRounds: number[];

  /**
   * Axis goes into a spin (lose) when |tilt| >= axisSpinLimit.
   * TODO_RULEBOOK: exact marks-to-X is printed on the physical Axis disc.
   */
  axisSpinLimit: number;
}

export interface AirportConfig {
  name: string;
  /** Number of spaces from the plane's start to the airport. */
  approachTrackLength: number;
  /**
   * Approach-track positions (1-indexed) holding an Airplane token at setup.
   * TODO_RULEBOOK: the real YUL layout is printed on the approach-track component.
   */
  trafficSlots: number[];
}

export interface GameConfig {
  rules: RulesConfig;
  airport: AirportConfig;
}

export const DEFAULT_CONFIG: GameConfig = {
  rules: {
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

    axisSpinLimit: 5, // TODO_RULEBOOK: confirm marks-to-X on the physical Axis disc.
  },
  airport: {
    name: 'YUL Montréal-Trudeau',
    approachTrackLength: 7, // TODO_RULEBOOK
    trafficSlots: [3, 4, 6], // TODO_RULEBOOK: real YUL traffic layout.
  },
};
