import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../config';

describe('DEFAULT_CONFIG — shape & rulebook values', () => {
  const { rules, airport } = DEFAULT_CONFIG;

  it('dicePerPlayer is 4', () => {
    expect(rules.dicePerPlayer).toBe(4);
  });

  it('axisTiltLimitPerRound is non-empty and all values >= 0', () => {
    expect(rules.axisTiltLimitPerRound.length).toBeGreaterThan(0);
    rules.axisTiltLimitPerRound.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('speedBands is non-empty', () => {
    expect(rules.speedBands.length).toBeGreaterThan(0);
  });

  it('each speedBand has minSpeed <= maxSpeed', () => {
    rules.speedBands.forEach(({ minSpeed, maxSpeed }) => {
      expect(minSpeed).toBeLessThanOrEqual(maxSpeed);
    });
  });

  it('flapsRequirements is non-empty and ascending', () => {
    expect(rules.flapsRequirements.length).toBeGreaterThan(0);
    for (let i = 1; i < rules.flapsRequirements.length; i++) {
      expect(rules.flapsRequirements[i]).toBeGreaterThanOrEqual(rules.flapsRequirements[i - 1]);
    }
  });

  it('gearMinValue is between 1 and 6', () => {
    expect(rules.gearMinValue).toBeGreaterThanOrEqual(1);
    expect(rules.gearMinValue).toBeLessThanOrEqual(6);
  });

  it('brakeMaxForce is positive', () => {
    expect(rules.brakeMaxForce).toBeGreaterThan(0);
  });

  it('approachTrackLength is positive', () => {
    expect(rules.approachTrackLength).toBeGreaterThan(0);
  });

  it('startingConcentration is positive', () => {
    expect(rules.startingConcentration).toBeGreaterThan(0);
  });

  it('airport has a name', () => {
    expect(airport.name.length).toBeGreaterThan(0);
  });
});
