import type { GameConfig } from './config.ts';
import type { GameState } from './types.ts';

/** Build the initial game state for a fresh game (LOBBY phase, no dice rolled yet). */
export function createInitialState(cfg: GameConfig): GameState {
  return {
    round: 1,
    phase: 'LOBBY',
    turn: 'pilot',
    firstPlayer: 'pilot',
    airportName: cfg.airport.name,
    approachPos: 1,
    axisTilt: 0,
    aeroBlue: cfg.rules.aeroBlueStart,
    aeroOrange: cfg.rules.aeroOrangeStart,
    speed: 0,
    lastAdvance: 0,
    flapsLevel: 0,
    gearDeployed: cfg.rules.gear.map(() => false),
    brakeLevel: 0,
    traffic: [...cfg.airport.trafficSlots],
    placed: [],
    remaining: { pilot: [], copilot: [] },
    coffee: 0,
    reroll: cfg.rules.rerollRounds.includes(1) ? 1 : 0,
    pendingReroll: null,
    status: 'active',
  };
}
