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

  // --- Axis (mandatory): pilot + copilot, any value ---
  slots.push({
    id: 'axis_pilot',
    group: 'axis',
    owner: 'pilot',
    validate(_die, state): ValidResult {
      return slotOccupied('axis_pilot', state) ? fail('Axis (pilot) already filled') : ok();
    },
  });
  slots.push({
    id: 'axis_copilot',
    group: 'axis',
    owner: 'copilot',
    validate(_die, state): ValidResult {
      return slotOccupied('axis_copilot', state) ? fail('Axis (co-pilot) already filled') : ok();
    },
  });

  // --- Engines (mandatory): pilot + copilot, ANY value ---
  slots.push({
    id: 'engine_pilot',
    group: 'engine',
    owner: 'pilot',
    validate(_die, state): ValidResult {
      return slotOccupied('engine_pilot', state) ? fail('Engine (pilot) already filled') : ok();
    },
  });
  slots.push({
    id: 'engine_copilot',
    group: 'engine',
    owner: 'copilot',
    validate(_die, state): ValidResult {
      return slotOccupied('engine_copilot', state) ? fail('Engine (co-pilot) already filled') : ok();
    },
  });

  // --- Radio: pilot 1 slot, copilot N slots, any value ---
  for (let i = 1; i <= cfg.rules.radioPilotSlots; i++) {
    const id = cfg.rules.radioPilotSlots === 1 ? 'radio_pilot' : `radio_pilot_${i}`;
    slots.push({
      id,
      group: 'radio',
      owner: 'pilot',
      validate(_die, state): ValidResult {
        return slotOccupied(id, state) ? fail('Radio slot already filled') : ok();
      },
    });
  }
  for (let i = 1; i <= cfg.rules.radioCopilotSlots; i++) {
    const id = `radio_copilot_${i}`;
    slots.push({
      id,
      group: 'radio',
      owner: 'copilot',
      validate(_die, state): ValidResult {
        return slotOccupied(id, state) ? fail('Radio slot already filled') : ok();
      },
    });
  }

  // --- Flaps (copilot only): ordered, each space accepts one of two values ---
  cfg.rules.flaps.forEach(([a, b], i) => {
    const id = `flaps_${i + 1}`;
    slots.push({
      id,
      group: 'flaps',
      owner: 'copilot',
      validate(die, state): ValidResult {
        if (slotOccupied(id, state)) return fail(`Flap ${i + 1} already deployed`);
        // Must be deployed in order; the previous flap counts whether deployed in a
        // past round (flapsLevel) or already placed earlier this round.
        if (i > 0 && state.flapsLevel < i && !slotOccupied(`flaps_${i}`, state)) {
          return fail(`Deploy flap ${i} before flap ${i + 1}`);
        }
        if (die !== a && die !== b) return fail(`Flap ${i + 1} requires a ${a} or ${b}`);
        return ok();
      },
    });
  });

  // --- Landing gear (pilot only): order-free, each space accepts one of two values ---
  cfg.rules.gear.forEach(([a, b], i) => {
    const id = `gear_${i + 1}`;
    slots.push({
      id,
      group: 'gear',
      owner: 'pilot',
      validate(die, state): ValidResult {
        if (slotOccupied(id, state)) return fail(`Landing gear ${i + 1} already deployed`);
        if (die !== a && die !== b) return fail(`This gear requires a ${a} or ${b}`);
        return ok();
      },
    });
  });

  // --- Brakes (pilot only): ordered, exact values, landing approach ---
  cfg.rules.brakes.forEach((value, i) => {
    const id = `brakes_${i + 1}`;
    slots.push({
      id,
      group: 'brakes',
      owner: 'pilot',
      validate(die, state): ValidResult {
        if (slotOccupied(id, state)) return fail(`Brake ${value} already deployed`);
        // Brakes deployed in order; previous may be from a past round or this round.
        if (i > 0 && state.brakeLevel < i && !slotOccupied(`brakes_${i}`, state)) {
          return fail(`Deploy the ${cfg.rules.brakes[i - 1]} brake first`);
        }
        if (die !== value) return fail(`This brake requires a ${value}`);
        return ok();
      },
    });
  });

  // --- Concentration (any player, any value); placing grants a Coffee token ---
  for (let i = 1; i <= cfg.rules.concentrationSlots; i++) {
    const id = `concentration_${i}`;
    slots.push({
      id,
      group: 'concentration',
      owner: 'any',
      validate(_die, state): ValidResult {
        if (slotOccupied(id, state)) return fail('Concentration slot already filled');
        if (state.coffee >= cfg.rules.coffeeMax) return fail('Coffee tokens already at maximum');
        return ok();
      },
    });
  }

  return slots;
}
