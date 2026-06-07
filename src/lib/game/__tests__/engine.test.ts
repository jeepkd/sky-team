import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { createInitialState } from '../state';
import { buildSlots } from '../slots';
import { validatePlacement, applyPlacement } from '../validate';
import { engineAdvance, checkVictory } from '../resolve';
import type { GameState } from '../types';

const cfg = DEFAULT_CONFIG;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState(cfg),
    phase: 'PLACING',
    turn: 'pilot',
    remaining: { pilot: [1, 2, 3, 4], copilot: [4, 5, 6, 3] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// slots
// ---------------------------------------------------------------------------
describe('buildSlots', () => {
  const slots = buildSlots(cfg);
  const ids = slots.map((s) => s.id);

  it('builds the expected slot ids', () => {
    for (const id of [
      'axis_pilot', 'axis_copilot', 'engine_pilot', 'engine_copilot',
      'radio_pilot', 'radio_copilot_1', 'radio_copilot_2',
      'flaps_1', 'flaps_2', 'flaps_3', 'flaps_4',
      'gear_1', 'gear_2', 'gear_3',
      'brakes_1', 'brakes_2', 'brakes_3',
      'concentration_1', 'concentration_2', 'concentration_3',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('engines accept any value', () => {
    const ep = slots.find((s) => s.id === 'engine_pilot')!;
    const state = makeState();
    expect(ep.validate(1, state, cfg).ok).toBe(true);
    expect(ep.validate(6, state, cfg).ok).toBe(true);
  });

  it('flaps require the right value pair', () => {
    const f1 = slots.find((s) => s.id === 'flaps_1')!;
    const state = makeState();
    expect(f1.validate(1, state, cfg).ok).toBe(true);
    expect(f1.validate(2, state, cfg).ok).toBe(true);
    expect(f1.validate(3, state, cfg).ok).toBe(false);
  });

  it('flaps must be deployed in order', () => {
    const f2 = slots.find((s) => s.id === 'flaps_2')!;
    expect(f2.validate(2, makeState({ flapsLevel: 0 }), cfg).ok).toBe(false);
    expect(f2.validate(2, makeState({ flapsLevel: 1 }), cfg).ok).toBe(true);
  });

  it('flaps_2 is placeable if flaps_1 was placed earlier this round', () => {
    const f2 = slots.find((s) => s.id === 'flaps_2')!;
    const state = makeState({ flapsLevel: 0, placed: [{ slotId: 'flaps_1', role: 'copilot', value: 1 }] });
    expect(f2.validate(3, state, cfg).ok).toBe(true);
  });

  it('landing gear requires the right value pair and is order-free', () => {
    const g2 = slots.find((s) => s.id === 'gear_2')!; // 3/4
    const state = makeState();
    expect(g2.validate(3, state, cfg).ok).toBe(true);
    expect(g2.validate(4, state, cfg).ok).toBe(true);
    expect(g2.validate(5, state, cfg).ok).toBe(false);
  });

  it('brakes require exact values in order', () => {
    const b1 = slots.find((s) => s.id === 'brakes_1')!; // 2
    const b2 = slots.find((s) => s.id === 'brakes_2')!; // 4
    expect(b1.validate(2, makeState(), cfg).ok).toBe(true);
    expect(b1.validate(4, makeState(), cfg).ok).toBe(false);
    expect(b2.validate(4, makeState({ brakeLevel: 0 }), cfg).ok).toBe(false);
    expect(b2.validate(4, makeState({ brakeLevel: 1 }), cfg).ok).toBe(true);
  });

  it('concentration accepts any value until coffee is maxed', () => {
    const c1 = slots.find((s) => s.id === 'concentration_1')!;
    expect(c1.validate(5, makeState({ coffee: 0 }), cfg).ok).toBe(true);
    expect(c1.validate(5, makeState({ coffee: cfg.rules.coffeeMax }), cfg).ok).toBe(false);
  });

  it('keeps deployment across rounds: gear/flaps/brakes are not re-placeable', () => {
    const gear1 = slots.find((s) => s.id === 'gear_1')!; // 1/2
    expect(gear1.validate(1, makeState({ gearDeployed: [true, false, false] }), cfg).ok).toBe(false);

    const flap1 = slots.find((s) => s.id === 'flaps_1')!;
    expect(flap1.validate(1, makeState({ flapsLevel: 1 }), cfg).ok).toBe(false);

    const brake1 = slots.find((s) => s.id === 'brakes_1')!;
    expect(brake1.validate(2, makeState({ brakeLevel: 1 }), cfg).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePlacement
// ---------------------------------------------------------------------------
describe('validatePlacement', () => {
  it('rejects wrong phase / turn / ownership', () => {
    expect(validatePlacement(makeState({ phase: 'ENDED' }), { role: 'pilot', slotId: 'axis_pilot', dieValue: 1 }, cfg).ok).toBe(false);
    expect(validatePlacement(makeState({ turn: 'copilot' }), { role: 'pilot', slotId: 'axis_pilot', dieValue: 1 }, cfg).ok).toBe(false);
    expect(validatePlacement(makeState(), { role: 'pilot', slotId: 'axis_copilot', dieValue: 1 }, cfg).ok).toBe(false);
  });

  it('rejects a die the player does not have', () => {
    expect(validatePlacement(makeState({ remaining: { pilot: [1, 2], copilot: [] } }), { role: 'pilot', slotId: 'axis_pilot', dieValue: 5 }, cfg).ok).toBe(false);
  });

  it('accepts a valid placement', () => {
    expect(validatePlacement(makeState(), { role: 'pilot', slotId: 'axis_pilot', dieValue: 1 }, cfg).ok).toBe(true);
  });

  it('allows a coffee-adjusted die when tokens are available', () => {
    // hand has a 3; want to place a 1 (cost 2 coffee)
    const state = makeState({ coffee: 2, remaining: { pilot: [3], copilot: [] } });
    expect(validatePlacement(state, { role: 'pilot', slotId: 'radio_pilot', dieValue: 1, originalDie: 3 }, cfg).ok).toBe(true);
  });

  it('rejects a coffee adjustment beyond available tokens', () => {
    const state = makeState({ coffee: 1, remaining: { pilot: [3], copilot: [] } });
    expect(validatePlacement(state, { role: 'pilot', slotId: 'radio_pilot', dieValue: 1, originalDie: 3 }, cfg).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyPlacement — immediate resolution
// ---------------------------------------------------------------------------
describe('applyPlacement', () => {
  it('removes the die, places it, and passes the turn', () => {
    const { state } = applyPlacement(makeState(), { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(state.remaining.pilot).not.toContain(3);
    expect(state.placed).toContainEqual({ slotId: 'axis_pilot', role: 'pilot', value: 3 });
    expect(state.turn).toBe('copilot');
  });

  it('spends coffee and removes the original die from hand', () => {
    const state0 = makeState({ coffee: 2, turn: 'pilot', remaining: { pilot: [3, 1], copilot: [2] } });
    const { state } = applyPlacement(state0, { role: 'pilot', slotId: 'radio_pilot', dieValue: 1, originalDie: 3 }, cfg);
    expect(state.coffee).toBe(0);
    expect(state.remaining.pilot).toEqual([1]);
    expect(state.placed[0].value).toBe(1);
  });

  it('accumulates axis tilt when both axis dice are placed', () => {
    let s = makeState({ axisTilt: 0 });
    s = applyPlacement(s, { role: 'pilot', slotId: 'axis_pilot', dieValue: 5 }, cfg).state;
    s = applyPlacement(s, { role: 'copilot', slotId: 'axis_copilot', dieValue: 3 }, cfg).state;
    expect(s.axisTilt).toBe(2); // 5 - 3
  });

  it('axis tilt is cumulative and can crash on a spin', () => {
    let s = makeState({ axisTilt: cfg.rules.axisSpinLimit - 1, remaining: { pilot: [6], copilot: [1] } });
    s = applyPlacement(s, { role: 'pilot', slotId: 'axis_pilot', dieValue: 6 }, cfg).state;
    s = applyPlacement(s, { role: 'copilot', slotId: 'axis_copilot', dieValue: 1 }, cfg).state;
    expect(s.status).toBe('crashed');
  });

  it('advances the approach track when engines resolve', () => {
    let s = makeState({ approachPos: 1, remaining: { pilot: [4], copilot: [5] } });
    s = applyPlacement(s, { role: 'pilot', slotId: 'engine_pilot', dieValue: 4 }, cfg).state;
    s = applyPlacement(s, { role: 'copilot', slotId: 'engine_copilot', dieValue: 5 }, cfg).state;
    // sum 9 > orange(8) → advance 2
    expect(s.approachPos).toBe(3);
    expect(s.lastAdvance).toBe(2);
  });

  it('gains coffee from a concentration placement', () => {
    const { state } = applyPlacement(makeState({ coffee: 0 }), { role: 'pilot', slotId: 'concentration_1', dieValue: 4 }, cfg);
    expect(state.coffee).toBe(1);
  });

  it('deploys flaps and moves the orange marker', () => {
    const s = makeState({ turn: 'copilot', remaining: { copilot: [1], pilot: [] } });
    const { state } = applyPlacement(s, { role: 'copilot', slotId: 'flaps_1', dieValue: 1 }, cfg);
    expect(state.flapsLevel).toBe(1);
    expect(state.aeroOrange).toBe(cfg.rules.aeroOrangeStart + 1);
  });
});

// ---------------------------------------------------------------------------
// engineAdvance
// ---------------------------------------------------------------------------
describe('engineAdvance', () => {
  it('maps sums to 0/1/2 around the markers (4, 8)', () => {
    expect(engineAdvance(4, 4, 8)).toBe(0);
    expect(engineAdvance(5, 4, 8)).toBe(1);
    expect(engineAdvance(8, 4, 8)).toBe(1);
    expect(engineAdvance(9, 4, 8)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// checkVictory
// ---------------------------------------------------------------------------
describe('checkVictory', () => {
  const airport = cfg.airport.approachTrackLength;

  it('wins when every condition is met', () => {
    const s = makeState({
      approachPos: airport,
      traffic: [],
      gearDeployed: [true, true, true],
      flapsLevel: cfg.rules.flaps.length,
      axisTilt: 0,
      brakeLevel: 2, // threshold 5
      speed: 3,
    });
    expect(checkVictory(s, cfg)).toBe('victory');
  });

  it('fails when axis is not level', () => {
    const s = makeState({
      approachPos: airport, traffic: [], gearDeployed: [true, true, true],
      flapsLevel: cfg.rules.flaps.length, axisTilt: 1, brakeLevel: 2, speed: 3,
    });
    expect(checkVictory(s, cfg)).toBe('failed');
  });

  it('fails when speed is not less than the brake marker', () => {
    const s = makeState({
      approachPos: airport, traffic: [], gearDeployed: [true, true, true],
      flapsLevel: cfg.rules.flaps.length, axisTilt: 0, brakeLevel: 1, speed: 5, // threshold 3
    });
    expect(checkVictory(s, cfg)).toBe('failed');
  });
});
