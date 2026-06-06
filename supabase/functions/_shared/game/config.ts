export interface RulesConfig {
  dicePerPlayer: number;
  axisTiltLimitPerRound: number[];
  speedBands: Array<{ altitude: number; minSpeed: number; maxSpeed: number }>;
  flapsRequirements: number[];
  gearMinValue: number;
  brakeMaxForce: number;
  approachTrackLength: number;
  startingConcentration: number;
}

export interface AirportConfig {
  name: string;
  trafficSlots: number[];
}

export interface GameConfig {
  rules: RulesConfig;
  airport: AirportConfig;
}

// TODO_RULEBOOK: placeholders — verify against physical rulebook.
export const DEFAULT_CONFIG: GameConfig = {
  rules: {
    dicePerPlayer: 4,
    axisTiltLimitPerRound: [5, 5, 4, 4, 3, 3, 2],
    speedBands: [
      { altitude: 5, minSpeed: 2, maxSpeed: 5 },
      { altitude: 4, minSpeed: 2, maxSpeed: 5 },
      { altitude: 3, minSpeed: 2, maxSpeed: 4 },
      { altitude: 2, minSpeed: 1, maxSpeed: 4 },
      { altitude: 1, minSpeed: 1, maxSpeed: 3 },
    ],
    flapsRequirements: [2, 3, 4, 5],
    gearMinValue: 3,
    brakeMaxForce: 9,
    approachTrackLength: 7,
    startingConcentration: 3,
  },
  airport: {
    name: 'Zürich (Base)',
    trafficSlots: [3, 5],
  },
};
