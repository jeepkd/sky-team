import type { GameConfig } from './config.ts';
import type { GameEvent, GameState, PlacedDie } from './types.ts';

function findPlaced(placed: PlacedDie[], slotId: string): number | undefined {
  return placed.find((p) => p.slotId === slotId)?.value;
}

export function checkEndConditions(
  state: GameState,
  cfg: GameConfig,
): 'victory' | 'crashed' | 'failed' | null {
  if (state.status !== 'active') {
    return state.status === 'victory' ? 'victory' : state.status === 'crashed' ? 'crashed' : 'failed';
  }

  const limit = cfg.rules.axisTiltLimitPerRound[state.round - 1] ?? 2;
  if (Math.abs(state.axisTilt) > limit) return 'crashed';

  const band = cfg.rules.speedBands.find((b) => b.altitude === state.altitude);
  if (band && (state.speed < band.minSpeed || state.speed > band.maxSpeed)) return 'crashed';

  if (state.approachPos >= cfg.rules.approachTrackLength - 1 && state.brakeForce > cfg.rules.brakeMaxForce) {
    return 'crashed';
  }

  if (state.traffic.includes(state.approachPos)) return 'crashed';

  if (state.approachPos >= cfg.rules.approachTrackLength && state.round >= cfg.rules.approachTrackLength) {
    const bothGear = state.gearDeployed.every(Boolean);
    const fullFlaps = state.flapsLevel >= cfg.rules.flapsRequirements.length;
    return bothGear && fullFlaps ? 'victory' : 'failed';
  }

  return null;
}

export function resolveRound(
  state: GameState,
  cfg: GameConfig,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = { ...state, phase: 'RESOLVING' as const };

  const pilotAxis = findPlaced(s.placed, 'axis_pilot');
  const copilotAxis = findPlaced(s.placed, 'axis_copilot');
  if (pilotAxis !== undefined && copilotAxis !== undefined) {
    s = { ...s, axisTilt: pilotAxis - copilotAxis };
    events.push({ type: 'axis_resolved', payload: { tilt: s.axisTilt } });
  }

  const leftEngine = findPlaced(s.placed, 'engine_left');
  const rightEngine = findPlaced(s.placed, 'engine_right');
  if (leftEngine !== undefined && rightEngine !== undefined) {
    s = { ...s, speed: leftEngine + rightEngine };
    events.push({ type: 'engines_resolved', payload: { speed: s.speed } });
  }

  // Radio: pilot 1 slot, copilot 2 slots — each removes one traffic token at (approachPos + dieValue)
  for (const radioSlotId of ['radio_pilot', 'radio_copilot_1', 'radio_copilot_2']) {
    const radioVal = findPlaced(s.placed, radioSlotId);
    if (radioVal !== undefined) {
      const clearedPos = s.approachPos + radioVal;
      const idx = s.traffic.indexOf(clearedPos);
      if (idx !== -1) {
        const newTraffic = [...s.traffic];
        newTraffic.splice(idx, 1);
        events.push({ type: 'traffic_cleared', payload: { position: clearedPos, slot: radioSlotId } });
        s = { ...s, traffic: newTraffic };
      }
    }
  }

  for (let i = 0; i < cfg.rules.flapsRequirements.length; i++) {
    const val = findPlaced(s.placed, `flaps_${i + 1}`);
    if (val !== undefined && val >= cfg.rules.flapsRequirements[i] && s.flapsLevel < i + 1) {
      s = { ...s, flapsLevel: i + 1 };
      events.push({ type: 'flaps_deployed', payload: { level: s.flapsLevel } });
    }
  }

  const newGear = [...s.gearDeployed];
  const gearLeft = findPlaced(s.placed, 'gear_left');
  const gearRight = findPlaced(s.placed, 'gear_right');
  if (gearLeft !== undefined && gearLeft >= cfg.rules.gearMinValue) {
    newGear[0] = true;
    events.push({ type: 'gear_deployed', payload: { side: 'left' } });
  }
  if (gearRight !== undefined && gearRight >= cfg.rules.gearMinValue) {
    newGear[1] = true;
    events.push({ type: 'gear_deployed', payload: { side: 'right' } });
  }
  s = { ...s, gearDeployed: newGear };

  const brake1 = findPlaced(s.placed, 'brakes_1');
  const brake2 = findPlaced(s.placed, 'brakes_2');
  const brakeSum = (brake1 ?? 0) + (brake2 ?? 0);
  if (brakeSum > 0) {
    s = { ...s, brakeForce: s.brakeForce + brakeSum };
    events.push({ type: 'brakes_applied', payload: { force: brakeSum } });
  }

  const newPos = s.approachPos + Math.max(1, s.speed);
  s = { ...s, approachPos: newPos };
  events.push({ type: 'approach_advanced', payload: { position: newPos, speed: s.speed } });

  const end = checkEndConditions(s, cfg);
  if (end) {
    s = { ...s, status: end, phase: 'ENDED' };
    events.push({ type: 'game_ended', payload: { result: end } });
  } else {
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
