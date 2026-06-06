import type { GameConfig } from './config';
import type { GameState, SlotDef } from './types';

type ValidResult = { ok: true } | { ok: false; reason: string };

function ok(): { ok: true } { return { ok: true }; }
function fail(reason: string): { ok: false; reason: string } { return { ok: false, reason }; }

function slotOccupied(slotId: string, state: GameState): boolean {
  return state.placed.some((p) => p.slotId === slotId);
}

export function buildSlots(cfg: GameConfig): SlotDef[] {
  const slots: SlotDef[] = [];

  // --- Axis ---
  slots.push({
    id: 'axis_pilot',
    group: 'axis',
    owner: 'pilot',
    validate(_die, state): ValidResult {
      if (slotOccupied('axis_pilot', state)) return fail('Axis pilot slot already filled');
      return ok();
    },
  });
  slots.push({
    id: 'axis_copilot',
    group: 'axis',
    owner: 'copilot',
    validate(_die, state): ValidResult {
      if (slotOccupied('axis_copilot', state)) return fail('Axis copilot slot already filled');
      return ok();
    },
  });

  // --- Engines (one left, one right) ---
  // Left engine: pilot places, accepts 1–3. Right engine: copilot places, accepts 4–6.
  slots.push({
    id: 'engine_left',
    group: 'engine',
    owner: 'pilot',
    validate(die, state): ValidResult {
      if (slotOccupied('engine_left', state)) return fail('Left engine already filled');
      if (die < 1 || die > 3) return fail('Left engine requires a value of 1–3');
      return ok();
    },
  });
  slots.push({
    id: 'engine_right',
    group: 'engine',
    owner: 'copilot',
    validate(die, state): ValidResult {
      if (slotOccupied('engine_right', state)) return fail('Right engine already filled');
      if (die < 4 || die > 6) return fail('Right engine requires a value of 4–6');
      return ok();
    },
  });

  // --- Radio ---
  slots.push({
    id: 'radio',
    group: 'radio',
    owner: 'any',
    validate(_die, state): ValidResult {
      if (slotOccupied('radio', state)) return fail('Radio slot already filled');
      return ok();
    },
  });

  // --- Flaps (4 positions, sequential deployment) ---
  for (let i = 0; i < cfg.rules.flapsRequirements.length; i++) {
    const minVal = cfg.rules.flapsRequirements[i];
    const flap = i; // captured
    slots.push({
      id: `flaps_${i + 1}`,
      group: 'flaps',
      owner: 'any',
      validate(die, state): ValidResult {
        if (slotOccupied(`flaps_${flap + 1}`, state)) return fail(`Flap ${flap + 1} already filled`);
        // Flaps must be deployed in order
        if (flap > 0 && state.flapsLevel < flap) return fail(`Must deploy flap ${flap} before flap ${flap + 1}`);
        if (die < minVal) return fail(`Flap ${flap + 1} requires at least ${minVal}`);
        return ok();
      },
    });
  }

  // --- Landing Gear (2 slots, pilot + copilot) ---
  const gearMin = cfg.rules.gearMinValue;
  slots.push({
    id: 'gear_left',
    group: 'gear',
    owner: 'pilot',
    validate(die, state): ValidResult {
      if (slotOccupied('gear_left', state)) return fail('Left gear already deployed');
      if (die < gearMin) return fail(`Landing gear requires at least ${gearMin}`);
      return ok();
    },
  });
  slots.push({
    id: 'gear_right',
    group: 'gear',
    owner: 'copilot',
    validate(die, state): ValidResult {
      if (slotOccupied('gear_right', state)) return fail('Right gear already deployed');
      if (die < gearMin) return fail(`Landing gear requires at least ${gearMin}`);
      return ok();
    },
  });

  // --- Brakes (2 slots, landing round only, any player) ---
  for (let i = 1; i <= 2; i++) {
    const brake = i;
    slots.push({
      id: `brakes_${i}`,
      group: 'brakes',
      owner: 'any',
      validate(_die, state, c): ValidResult {
        if (slotOccupied(`brakes_${brake}`, state)) return fail(`Brake slot ${brake} already filled`);
        // Brakes only usable in landing round (final approach position)
        if (state.approachPos < c.rules.approachTrackLength - 1) {
          return fail('Brakes can only be used during the landing round');
        }
        return ok();
      },
    });
  }

  // --- Concentration (1 slot per player) ---
  for (const role of ['pilot', 'copilot'] as const) {
    slots.push({
      id: `concentration_${role}`,
      group: 'concentration',
      owner: role,
      validate(_die, state): ValidResult {
        if (slotOccupied(`concentration_${role}`, state)) {
          return fail(`${role} concentration slot already filled`);
        }
        if (state.concentrationTokens[role] <= 0) {
          return fail(`${role} has no concentration tokens left`);
        }
        return ok();
      },
    });
  }

  return slots;
}
