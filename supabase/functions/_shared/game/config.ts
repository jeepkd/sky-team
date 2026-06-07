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
  rerollRounds: number[];
  axisSpinLimit: number;
}

export interface Destination {
  id: string;
  name: string;
  difficulty: 'Intro' | 'Easy' | 'Medium' | 'Hard';
  approachTrackLength: number;
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
  aeroBlueStart: 4,
  aeroOrangeStart: 8,
  flaps: [[1, 2], [2, 3], [3, 4], [4, 5]],
  gear: [[1, 2], [3, 4], [5, 6]],
  brakes: [2, 4, 6],
  brakeThresholds: [2, 3, 5, 7],
  radioPilotSlots: 1,
  radioCopilotSlots: 2,
  concentrationSlots: 3,
  coffeeMax: 3,
  rerollTokens: 2,
  rerollRounds: [1, 4],
  axisSpinLimit: 3, // Valid axis is -2..+2; |tilt| >= 3 is a loss.
};

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
