import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../config';

describe('DEFAULT_CONFIG — shape & rulebook values', () => {
  const { rules, airport } = DEFAULT_CONFIG;

  it('dicePerPlayer is 4 and 7 rounds', () => {
    expect(rules.dicePerPlayer).toBe(4);
    expect(rules.totalRounds).toBe(7);
  });

  it('aerodynamics markers start at 4 and 8', () => {
    expect(rules.aeroBlueStart).toBe(4);
    expect(rules.aeroOrangeStart).toBe(8);
  });

  it('has 4 flaps (1/2, 2/3, 3/4, 4/5)', () => {
    expect(rules.flaps).toEqual([[1, 2], [2, 3], [3, 4], [4, 5]]);
  });

  it('has 3 landing-gear spaces (1/2, 3/4, 5/6)', () => {
    expect(rules.gear).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it('brakes are 2, 4, 6 with ascending thresholds', () => {
    expect(rules.brakes).toEqual([2, 4, 6]);
    expect(rules.brakeThresholds).toEqual([2, 3, 5, 7]);
  });

  it('radio: pilot 1, copilot 2', () => {
    expect(rules.radioPilotSlots).toBe(1);
    expect(rules.radioCopilotSlots).toBe(2);
  });

  it('3 concentration slots, coffee cap 3', () => {
    expect(rules.concentrationSlots).toBe(3);
    expect(rules.coffeeMax).toBe(3);
  });

  it('airport has a name and a positive track length', () => {
    expect(airport.name.length).toBeGreaterThan(0);
    expect(airport.approachTrackLength).toBeGreaterThan(0);
  });
});
