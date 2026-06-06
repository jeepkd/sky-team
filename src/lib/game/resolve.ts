import type { GameConfig } from './config';
import type { GameEvent, GameState, PlacedDie, Role } from './types';

function findPlaced(placed: PlacedDie[], slotId: string): number | undefined {
  return placed.find((p) => p.slotId === slotId)?.value;
}

/** Engine sum → spaces advanced, given the current aerodynamics markers. */
export function engineAdvance(sum: number, aeroBlue: number, aeroOrange: number): 0 | 1 | 2 {
  if (sum <= aeroBlue) return 0;
  if (sum <= aeroOrange) return 1;
  return 2;
}

function isFinalRound(state: GameState, cfg: GameConfig): boolean {
  return state.round >= cfg.rules.totalRounds;
}

/**
 * Resolve the immediate effect of a single die that was just placed (the real game
 * resolves each die as it lands). Returns the updated state and any events. May set
 * status to 'crashed' (spin, collision, overshoot).
 */
export function resolvePlacement(
  state: GameState,
  placed: PlacedDie,
  cfg: GameConfig,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = state;
  const group = slotGroup(placed.slotId);

  switch (group) {
    case 'axis': {
      const pilot = findPlaced(s.placed, 'axis_pilot');
      const copilot = findPlaced(s.placed, 'axis_copilot');
      if (pilot !== undefined && copilot !== undefined) {
        const tilt = s.axisTilt + (pilot - copilot);
        s = { ...s, axisTilt: tilt };
        events.push({ type: 'axis_resolved', payload: { tilt } });
        if (Math.abs(tilt) >= cfg.rules.axisSpinLimit) {
          s = { ...s, status: 'crashed', phase: 'ENDED' };
          events.push({ type: 'game_ended', payload: { result: 'crashed', reason: 'spin' } });
        }
      }
      break;
    }

    case 'engine': {
      const pilot = findPlaced(s.placed, 'engine_pilot');
      const copilot = findPlaced(s.placed, 'engine_copilot');
      if (pilot !== undefined && copilot !== undefined) {
        const sum = pilot + copilot;
        s = { ...s, speed: sum };
        if (isFinalRound(s, cfg)) {
          // Landing round: no advance; speed is compared with brakes at game end.
          s = { ...s, lastAdvance: 0 };
          events.push({ type: 'engines_resolved', payload: { speed: sum, advance: 0, final: true } });
        } else {
          const adv = engineAdvance(sum, s.aeroBlue, s.aeroOrange);
          s = { ...s, lastAdvance: adv };
          events.push({ type: 'engines_resolved', payload: { speed: sum, advance: adv } });
          if (adv > 0) {
            const airport = cfg.airport.approachTrackLength;
            if (s.traffic.includes(s.approachPos)) {
              s = { ...s, status: 'crashed', phase: 'ENDED' };
              events.push({ type: 'game_ended', payload: { result: 'crashed', reason: 'collision', position: s.approachPos } });
            } else if (s.approachPos + adv > airport) {
              s = { ...s, status: 'crashed', phase: 'ENDED' };
              events.push({ type: 'game_ended', payload: { result: 'crashed', reason: 'overshoot' } });
            } else {
              s = { ...s, approachPos: s.approachPos + adv };
              events.push({ type: 'approach_advanced', payload: { position: s.approachPos, advance: adv } });
            }
          }
        }
      }
      break;
    }

    case 'radio': {
      // Remove one Airplane token at (currentPos + value − 1); value 1 = current position.
      const target = s.approachPos + (placed.value - 1);
      const idx = s.traffic.indexOf(target);
      if (idx !== -1) {
        const traffic = [...s.traffic];
        traffic.splice(idx, 1);
        s = { ...s, traffic };
        events.push({ type: 'traffic_cleared', payload: { position: target } });
      }
      break;
    }

    case 'flaps': {
      // Flaps are placed in order; deploying advances the flaps level and orange marker.
      const level = Math.max(s.flapsLevel, flapIndex(placed.slotId) + 1);
      s = { ...s, flapsLevel: level, aeroOrange: s.aeroOrange + 1 };
      events.push({ type: 'flaps_deployed', payload: { level, aeroOrange: s.aeroOrange } });
      break;
    }

    case 'gear': {
      const i = gearIndex(placed.slotId);
      const gearDeployed = [...s.gearDeployed];
      gearDeployed[i] = true;
      s = { ...s, gearDeployed, aeroBlue: s.aeroBlue + 1 };
      events.push({ type: 'gear_deployed', payload: { index: i, aeroBlue: s.aeroBlue } });
      break;
    }

    case 'brakes': {
      const level = Math.max(s.brakeLevel, brakeIndex(placed.slotId) + 1);
      s = { ...s, brakeLevel: level };
      events.push({ type: 'brakes_deployed', payload: { level } });
      break;
    }

    case 'concentration': {
      const coffee = Math.min(cfg.rules.coffeeMax, s.coffee + 1);
      s = { ...s, coffee };
      events.push({ type: 'coffee_gained', payload: { coffee } });
      break;
    }
  }

  return { state: s, events };
}

function slotGroup(slotId: string): string {
  if (slotId.startsWith('axis')) return 'axis';
  if (slotId.startsWith('engine')) return 'engine';
  if (slotId.startsWith('radio')) return 'radio';
  if (slotId.startsWith('flaps')) return 'flaps';
  if (slotId.startsWith('gear')) return 'gear';
  if (slotId.startsWith('brakes')) return 'brakes';
  if (slotId.startsWith('concentration')) return 'concentration';
  return 'unknown';
}

function flapIndex(slotId: string): number { return Number(slotId.split('_')[1]) - 1; }
function gearIndex(slotId: string): number { return Number(slotId.split('_')[1]) - 1; }
function brakeIndex(slotId: string): number { return Number(slotId.split('_')[1]) - 1; }

/**
 * Brake-marker threshold for the current brake level: final speed must be strictly less.
 */
export function brakeThreshold(state: GameState, cfg: GameConfig): number {
  return cfg.rules.brakeThresholds[Math.min(state.brakeLevel, cfg.rules.brakeThresholds.length - 1)];
}

/**
 * Evaluate the end-of-game victory/failure conditions (called after the final round).
 */
export function checkVictory(state: GameState, cfg: GameConfig): 'victory' | 'failed' {
  const atAirport = state.approachPos >= cfg.airport.approachTrackLength;
  const noTraffic = state.traffic.length === 0;
  const allGear = state.gearDeployed.every(Boolean);
  const allFlaps = state.flapsLevel >= cfg.rules.flaps.length;
  const level = state.axisTilt === 0;
  const speedOk = state.speed < brakeThreshold(state, cfg);
  return atAirport && noTraffic && allGear && allFlaps && level && speedOk ? 'victory' : 'failed';
}

/**
 * Run the end-of-round transition once all 8 dice are placed: enforce mandatory
 * spaces, advance the round, take back dice, and check for game end.
 */
export function endOfRound(state: GameState, cfg: GameConfig): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = state;

  // Mandatory: 1 die of each colour on Axis and on Engines.
  const mandatory = ['axis_pilot', 'axis_copilot', 'engine_pilot', 'engine_copilot'];
  const missing = mandatory.filter((id) => !s.placed.some((p) => p.slotId === id));
  if (missing.length > 0) {
    s = { ...s, status: 'crashed', phase: 'ENDED' };
    events.push({ type: 'game_ended', payload: { result: 'crashed', reason: 'mandatory', missing } });
    return { state: s, events };
  }

  // Final round just completed → evaluate landing.
  if (isFinalRound(s, cfg)) {
    const result = checkVictory(s, cfg);
    s = { ...s, status: result, phase: 'ENDED' };
    events.push({ type: 'game_ended', payload: { result } });
    return { state: s, events };
  }

  // Reached the airport but it isn't the final round yet → holding pattern (continue).
  // Advance the round / altitude and take back dice for the next round.
  const nextRound = s.round + 1;
  const firstPlayer: Role = nextRound % 2 === 1 ? 'pilot' : 'copilot';
  const rerollGain = cfg.rules.rerollRounds.includes(nextRound) ? 1 : 0;

  s = {
    ...s,
    round: nextRound,
    phase: 'PLACING',
    firstPlayer,
    turn: firstPlayer,
    placed: [],
    remaining: { pilot: [], copilot: [] },
    reroll: Math.min(cfg.rules.rerollTokens, s.reroll + rerollGain),
    lastAdvance: 0,
  };
  events.push({ type: 'round_started', payload: { round: nextRound, firstPlayer } });

  return { state: s, events };
}
