import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { buildSlots } from '../slots';
import { validatePlacement, applyPlacement } from '../validate';
import { resolveRound, checkEndConditions } from '../resolve';
import type { GameState } from '../types';

const cfg = DEFAULT_CONFIG;

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    phase: 'PLACING',
    turn: 'pilot',
    approachPos: 0,
    altitude: 3,
    speed: 3,
    axisTilt: 0,
    flapsLevel: 0,
    gearDeployed: [false, false],
    brakeForce: 0,
    traffic: [],
    placed: [],
    remaining: { pilot: [1, 2, 3, 4], copilot: [4, 5, 6, 3] },
    concentrationTokens: { pilot: cfg.rules.startingConcentration, copilot: cfg.rules.startingConcentration },
    coffeeUsed: { pilot: false, copilot: false },
    status: 'active',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// slots
// ---------------------------------------------------------------------------
describe('buildSlots', () => {
  const slots = buildSlots(cfg);

  it('builds expected slot ids', () => {
    const ids = slots.map((s) => s.id);
    expect(ids).toContain('axis_pilot');
    expect(ids).toContain('axis_copilot');
    expect(ids).toContain('engine_left');
    expect(ids).toContain('engine_right');
    expect(ids).toContain('radio');
    expect(ids).toContain('gear_left');
    expect(ids).toContain('gear_right');
    expect(ids).toContain('flaps_1');
    expect(ids).toContain('brakes_1');
  });

  it('axis_pilot owner is pilot', () => {
    const slot = slots.find((s) => s.id === 'axis_pilot')!;
    expect(slot.owner).toBe('pilot');
  });

  it('engine_left rejects die > 3', () => {
    const slot = slots.find((s) => s.id === 'engine_left')!;
    const state = makeState();
    const result = slot.validate(4, state, cfg);
    expect(result.ok).toBe(false);
  });

  it('engine_left accepts die <= 3', () => {
    const slot = slots.find((s) => s.id === 'engine_left')!;
    const state = makeState();
    expect(slot.validate(1, state, cfg).ok).toBe(true);
    expect(slot.validate(3, state, cfg).ok).toBe(true);
  });

  it('engine_right rejects die < 4', () => {
    const slot = slots.find((s) => s.id === 'engine_right')!;
    const state = makeState();
    expect(slot.validate(3, state, cfg).ok).toBe(false);
  });

  it('engine_right accepts die >= 4', () => {
    const slot = slots.find((s) => s.id === 'engine_right')!;
    const state = makeState();
    expect(slot.validate(4, state, cfg).ok).toBe(true);
    expect(slot.validate(6, state, cfg).ok).toBe(true);
  });

  it('flaps_1 rejects die below minimum', () => {
    const slot = slots.find((s) => s.id === 'flaps_1')!;
    const state = makeState();
    expect(slot.validate(cfg.rules.flapsRequirements[0] - 1, state, cfg).ok).toBe(false);
  });

  it('flaps_2 requires flaps_1 to be deployed first', () => {
    const slot = slots.find((s) => s.id === 'flaps_2')!;
    const state = makeState({ flapsLevel: 0 });
    expect(slot.validate(5, state, cfg).ok).toBe(false);
  });

  it('flaps_2 accepts valid die when flap 1 already deployed', () => {
    const slot = slots.find((s) => s.id === 'flaps_2')!;
    const state = makeState({ flapsLevel: 1 });
    expect(slot.validate(cfg.rules.flapsRequirements[1], state, cfg).ok).toBe(true);
  });

  it('gear_left rejects die below gearMinValue', () => {
    const slot = slots.find((s) => s.id === 'gear_left')!;
    const state = makeState();
    expect(slot.validate(cfg.rules.gearMinValue - 1, state, cfg).ok).toBe(false);
  });

  it('gear_left accepts die >= gearMinValue', () => {
    const slot = slots.find((s) => s.id === 'gear_left')!;
    const state = makeState();
    expect(slot.validate(cfg.rules.gearMinValue, state, cfg).ok).toBe(true);
  });

  it('slot is rejected if already occupied', () => {
    const slot = slots.find((s) => s.id === 'axis_pilot')!;
    const state = makeState({ placed: [{ slotId: 'axis_pilot', role: 'pilot', value: 3 }] });
    expect(slot.validate(4, state, cfg).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePlacement
// ---------------------------------------------------------------------------
describe('validatePlacement', () => {
  it('rejects if not PLACING phase', () => {
    const state = makeState({ phase: 'REVEALING' });
    const result = validatePlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(result.ok).toBe(false);
  });

  it('rejects if wrong turn', () => {
    const state = makeState({ turn: 'copilot' });
    const result = validatePlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(result.ok).toBe(false);
  });

  it('rejects if die not in remaining', () => {
    const state = makeState({ remaining: { pilot: [1, 2], copilot: [4, 5, 6, 3] } });
    const result = validatePlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 5 }, cfg);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown slot', () => {
    const state = makeState();
    const result = validatePlacement(state, { role: 'pilot', slotId: 'fake_slot', dieValue: 3 }, cfg);
    expect(result.ok).toBe(false);
  });

  it('rejects if role does not own slot', () => {
    const state = makeState();
    // pilot cannot place in axis_copilot
    const result = validatePlacement(state, { role: 'pilot', slotId: 'axis_copilot', dieValue: 3 }, cfg);
    expect(result.ok).toBe(false);
  });

  it('accepts valid placement', () => {
    const state = makeState();
    const result = validatePlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyPlacement
// ---------------------------------------------------------------------------
describe('applyPlacement', () => {
  it('removes die from remaining', () => {
    const state = makeState({ remaining: { pilot: [1, 2, 3, 4], copilot: [4, 5, 6, 3] } });
    const next = applyPlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(next.remaining.pilot).not.toContain(3);
    expect(next.remaining.pilot).toHaveLength(3);
  });

  it('appends to placed', () => {
    const state = makeState();
    const next = applyPlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(next.placed).toHaveLength(1);
    expect(next.placed[0]).toEqual({ slotId: 'axis_pilot', role: 'pilot', value: 3 });
  });

  it('flips turn from pilot to copilot', () => {
    const state = makeState({ turn: 'pilot' });
    const next = applyPlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 3 }, cfg);
    expect(next.turn).toBe('copilot');
  });

  it('sets phase to REVEALING when all dice placed', () => {
    // Start with only 1 die left between both players
    const state = makeState({
      turn: 'pilot',
      placed: Array.from({ length: cfg.rules.dicePerPlayer * 2 - 1 }, (_, i) => ({
        slotId: `flaps_${i + 1}`,
        role: 'pilot' as const,
        value: 3,
      })),
      remaining: { pilot: [2], copilot: [] },
    });
    const next = applyPlacement(state, { role: 'pilot', slotId: 'axis_pilot', dieValue: 2 }, cfg);
    expect(next.phase).toBe('REVEALING');
  });
});

// ---------------------------------------------------------------------------
// resolveRound — known scenario: normal round advances approach position
// ---------------------------------------------------------------------------
describe('resolveRound', () => {
  it('computes axis tilt from placed dice', () => {
    const state = makeState({
      placed: [
        { slotId: 'axis_pilot', role: 'pilot', value: 4 },
        { slotId: 'axis_copilot', role: 'copilot', value: 2 },
      ],
    });
    const { state: next } = resolveRound(state, cfg);
    // axisTilt = 4 - 2 = 2
    expect(next.axisTilt).toBe(2);
  });

  it('computes speed from engines', () => {
    const state = makeState({
      placed: [
        { slotId: 'engine_left', role: 'pilot', value: 2 },
        { slotId: 'engine_right', role: 'copilot', value: 5 },
      ],
    });
    const { state: next } = resolveRound(state, cfg);
    expect(next.speed).toBe(7);
  });

  it('advances approach position', () => {
    const state = makeState({ approachPos: 0, speed: 3 });
    const { state: next } = resolveRound(state, cfg);
    expect(next.approachPos).toBeGreaterThan(0);
  });

  it('emits approach_advanced event', () => {
    const state = makeState();
    const { events } = resolveRound(state, cfg);
    expect(events.some((e) => e.type === 'approach_advanced')).toBe(true);
  });

  it('advances round counter', () => {
    const state = makeState({ round: 1 });
    const { state: next } = resolveRound(state, cfg);
    expect(next.round).toBe(2);
  });

  it('clears placed dice for next round', () => {
    const state = makeState({ placed: [{ slotId: 'axis_pilot', role: 'pilot', value: 3 }] });
    const { state: next } = resolveRound(state, cfg);
    if (next.phase !== 'ENDED') {
      expect(next.placed).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// checkEndConditions
// ---------------------------------------------------------------------------
describe('checkEndConditions', () => {
  it('returns crashed when axis tilt exceeds limit', () => {
    const limit = cfg.rules.axisTiltLimitPerRound[0];
    const state = makeState({ axisTilt: limit + 1 });
    expect(checkEndConditions(state, cfg)).toBe('crashed');
  });

  it('returns null when tilt is within limit', () => {
    const limit = cfg.rules.axisTiltLimitPerRound[0];
    const state = makeState({ axisTilt: limit });
    expect(checkEndConditions(state, cfg)).toBeNull();
  });

  it('returns crashed when traffic token on approach pos', () => {
    const state = makeState({ approachPos: 3, traffic: [3] });
    expect(checkEndConditions(state, cfg)).toBe('crashed');
  });

  it('returns null when no traffic at current pos', () => {
    const state = makeState({ approachPos: 3, traffic: [5] });
    expect(checkEndConditions(state, cfg)).toBeNull();
  });
});
