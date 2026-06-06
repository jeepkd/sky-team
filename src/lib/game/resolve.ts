import type { GameConfig } from './config';
import type { GameEvent, GameState, PlacedDie } from './types';

function findPlaced(placed: PlacedDie[], slotId: string): number | undefined {
  return placed.find((p) => p.slotId === slotId)?.value;
}

export function checkEndConditions(
  state: GameState,
  cfg: GameConfig,
): 'victory' | 'crashed' | 'failed' | null {
  // Already ended
  if (state.status !== 'active') return state.status === 'victory' ? 'victory' :
    state.status === 'crashed' ? 'crashed' : 'failed';

  const limit = cfg.rules.axisTiltLimitPerRound[state.round - 1] ?? 2;
  if (Math.abs(state.axisTilt) > limit) return 'crashed';

  // Speed out of corridor
  const band = cfg.rules.speedBands.find((b) => b.altitude === state.altitude);
  if (band) {
    if (state.speed < band.minSpeed || state.speed > band.maxSpeed) return 'crashed';
  }

  // Brakes over max during landing
  if (state.approachPos >= cfg.rules.approachTrackLength - 1 && state.brakeForce > cfg.rules.brakeMaxForce) {
    return 'crashed';
  }

  // Traffic collision: plane is on a position that still has a traffic token
  if (state.traffic.includes(state.approachPos)) return 'crashed';

  // Victory: completed all rounds successfully (checked after final round resolve)
  if (state.approachPos >= cfg.rules.approachTrackLength && state.round >= cfg.rules.approachTrackLength) {
    const bothGear = state.gearDeployed.every(Boolean);
    const fullFlaps = state.flapsLevel >= cfg.rules.flapsRequirements.length;
    if (bothGear && fullFlaps) return 'victory';
    return 'failed';
  }

  return null;
}

export function resolveRound(
  state: GameState,
  cfg: GameConfig,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s: GameState = { ...state, phase: 'RESOLVING' };

  // 1. Axis
  const pilotAxis = findPlaced(s.placed, 'axis_pilot');
  const copilotAxis = findPlaced(s.placed, 'axis_copilot');
  if (pilotAxis !== undefined && copilotAxis !== undefined) {
    s = { ...s, axisTilt: pilotAxis - copilotAxis };
    events.push({ type: 'axis_resolved', payload: { tilt: s.axisTilt } });
  }

  // 2. Engines → speed (left engine + right engine combined)
  const leftEngine = findPlaced(s.placed, 'engine_left');
  const rightEngine = findPlaced(s.placed, 'engine_right');
  if (leftEngine !== undefined && rightEngine !== undefined) {
    s = { ...s, speed: leftEngine + rightEngine };
    events.push({ type: 'engines_resolved', payload: { speed: s.speed } });
  }

  // 3. Radio → clear traffic tokens
  const radio = findPlaced(s.placed, 'radio');
  if (radio !== undefined) {
    const clearedPos = s.approachPos + radio;
    const newTraffic = s.traffic.filter((t) => t !== clearedPos);
    if (newTraffic.length < s.traffic.length) {
      events.push({ type: 'traffic_cleared', payload: { position: clearedPos } });
    }
    s = { ...s, traffic: newTraffic };
  }

  // 4. Flaps
  for (let i = 0; i < cfg.rules.flapsRequirements.length; i++) {
    const slotId = `flaps_${i + 1}`;
    const val = findPlaced(s.placed, slotId);
    if (val !== undefined && val >= cfg.rules.flapsRequirements[i]) {
      if (s.flapsLevel < i + 1) {
        s = { ...s, flapsLevel: i + 1 };
        events.push({ type: 'flaps_deployed', payload: { level: s.flapsLevel } });
      }
    }
  }

  // 5. Landing gear
  const gearLeft = findPlaced(s.placed, 'gear_left');
  const gearRight = findPlaced(s.placed, 'gear_right');
  const newGear = [...s.gearDeployed];
  if (gearLeft !== undefined && gearLeft >= cfg.rules.gearMinValue) {
    newGear[0] = true;
    events.push({ type: 'gear_deployed', payload: { side: 'left' } });
  }
  if (gearRight !== undefined && gearRight >= cfg.rules.gearMinValue) {
    newGear[1] = true;
    events.push({ type: 'gear_deployed', payload: { side: 'right' } });
  }
  s = { ...s, gearDeployed: newGear };

  // 6. Brakes (landing round)
  const brake1 = findPlaced(s.placed, 'brakes_1');
  const brake2 = findPlaced(s.placed, 'brakes_2');
  const brakeSum = (brake1 ?? 0) + (brake2 ?? 0);
  if (brakeSum > 0) {
    s = { ...s, brakeForce: s.brakeForce + brakeSum };
    events.push({ type: 'brakes_applied', payload: { force: brakeSum } });
  }

  // 7. Concentration tokens applied during placement; no extra resolution step needed.

  // Advance approach position based on speed
  const newPos = s.approachPos + Math.max(1, s.speed);
  s = { ...s, approachPos: newPos };
  events.push({ type: 'approach_advanced', payload: { position: newPos, speed: s.speed } });

  // Check end conditions
  const end = checkEndConditions(s, cfg);
  if (end) {
    s = { ...s, status: end, phase: 'ENDED' };
    events.push({ type: 'game_ended', payload: { result: end } });
  } else {
    // Advance to next round
    s = {
      ...s,
      round: s.round + 1,
      phase: 'PLACING',
      turn: 'pilot',
      placed: [],
      remaining: {
        pilot: Array.from({ length: cfg.rules.dicePerPlayer }, () => 0),
        copilot: Array.from({ length: cfg.rules.dicePerPlayer }, () => 0),
      },
    };
    events.push({ type: 'round_started', payload: { round: s.round } });
  }

  return { state: s, events };
}
