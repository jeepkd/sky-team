import type { GameConfig } from './config.ts';
import type { GameEvent, GameState, PlaceAction, Role, SlotDef } from './types.ts';
import { buildSlots } from './slots.ts';
import { resolvePlacement, endOfRound } from './resolve.ts';

type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validatePlacement(
  state: GameState,
  action: PlaceAction,
  cfg: GameConfig,
): ValidationResult {
  if (state.phase !== 'PLACING') {
    return { ok: false, reason: 'Not in placement phase' };
  }
  if (action.role !== state.turn) {
    return { ok: false, reason: `It is the ${state.turn}'s turn` };
  }

  const originalDie = action.originalDie ?? action.dieValue;
  if (!state.remaining[action.role].includes(originalDie)) {
    return { ok: false, reason: `You don't have a ${originalDie} behind your screen` };
  }

  const coffeeCost = Math.abs(action.dieValue - originalDie);
  if (coffeeCost > 0) {
    if (action.dieValue < 1 || action.dieValue > 6) {
      return { ok: false, reason: 'A die can only be adjusted to a value between 1 and 6' };
    }
    if (coffeeCost > state.coffee) {
      return { ok: false, reason: `Not enough Coffee (need ${coffeeCost}, have ${state.coffee})` };
    }
  }

  const slots = buildSlots(cfg);
  const slot: SlotDef | undefined = slots.find((s) => s.id === action.slotId);
  if (!slot) {
    return { ok: false, reason: `Unknown slot: ${action.slotId}` };
  }
  if (slot.owner !== 'any' && slot.owner !== action.role) {
    return { ok: false, reason: `The ${action.role} cannot use that space` };
  }

  return slot.validate(action.dieValue, state, cfg, action.role);
}

function removeFirst(arr: number[], value: number): number[] {
  const idx = arr.indexOf(value);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

function nextTurn(state: GameState): Role {
  const other: Role = state.turn === 'pilot' ? 'copilot' : 'pilot';
  if (state.remaining[other].length > 0) return other;
  return state.turn;
}

/**
 * Apply a validated placement: spend Coffee, remove the die from hand, place it
 * face-up, resolve its immediate effect, then either pass the turn or, once all
 * dice are placed, run the end-of-round transition.
 */
export function applyPlacement(
  state: GameState,
  action: PlaceAction,
  cfg: GameConfig,
): { state: GameState; events: GameEvent[] } {
  const originalDie = action.originalDie ?? action.dieValue;
  const coffeeCost = Math.abs(action.dieValue - originalDie);

  const remaining: Record<Role, number[]> = {
    pilot: state.remaining.pilot,
    copilot: state.remaining.copilot,
  };
  remaining[action.role] = removeFirst(remaining[action.role], originalDie);

  let s: GameState = {
    ...state,
    remaining,
    coffee: state.coffee - coffeeCost,
    placed: [...state.placed, { slotId: action.slotId, role: action.role, value: action.dieValue }],
  };

  const placedDie = { slotId: action.slotId, role: action.role, value: action.dieValue };
  const res = resolvePlacement(s, placedDie, cfg);
  s = res.state;
  const events = [...res.events];

  if (s.phase === 'ENDED') return { state: s, events };

  const totalDice = cfg.rules.dicePerPlayer * 2;
  if (s.placed.length >= totalDice) {
    const end = endOfRound(s, cfg);
    return { state: end.state, events: [...events, ...end.events] };
  }

  s = { ...s, turn: nextTurn(s) };
  return { state: s, events };
}
