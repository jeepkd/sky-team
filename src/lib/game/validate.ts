import type { GameConfig } from './config';
import type { GameState, PlaceAction, SlotDef } from './types';
import { buildSlots } from './slots';

type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validatePlacement(
  state: GameState,
  action: PlaceAction,
  cfg: GameConfig,
): ValidationResult {
  if (state.phase !== 'PLACING') {
    return { ok: false, reason: 'Not in PLACING phase' };
  }
  if (action.role !== state.turn) {
    return { ok: false, reason: `It is ${state.turn}'s turn` };
  }
  const remaining = state.remaining[action.role];
  if (!remaining.includes(action.dieValue)) {
    return { ok: false, reason: `Die value ${action.dieValue} not in ${action.role}'s remaining dice` };
  }

  const slots = buildSlots(cfg);
  const slot: SlotDef | undefined = slots.find((s) => s.id === action.slotId);
  if (!slot) {
    return { ok: false, reason: `Unknown slot: ${action.slotId}` };
  }
  if (slot.owner !== 'any' && slot.owner !== action.role) {
    return { ok: false, reason: `${action.role} cannot place in slot ${action.slotId}` };
  }

  return slot.validate(action.dieValue, state, cfg, action.role);
}

function removeFirst(arr: number[], value: number): number[] {
  const idx = arr.indexOf(value);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

export function applyPlacement(
  state: GameState,
  action: PlaceAction,
  cfg: GameConfig,
): GameState {
  const newRemaining: Record<'pilot' | 'copilot', number[]> = {
    pilot: state.remaining.pilot,
    copilot: state.remaining.copilot,
  };
  newRemaining[action.role] = removeFirst(newRemaining[action.role], action.dieValue);

  const placed = [...state.placed, { slotId: action.slotId, role: action.role, value: action.dieValue }];

  const totalDice = cfg.rules.dicePerPlayer * 2;
  const allPlaced = placed.length >= totalDice;

  const nextTurn: 'pilot' | 'copilot' = state.turn === 'pilot' ? 'copilot' : 'pilot';

  return {
    ...state,
    placed,
    remaining: newRemaining,
    turn: nextTurn,
    phase: allPlaced ? 'REVEALING' : 'PLACING',
  };
}
