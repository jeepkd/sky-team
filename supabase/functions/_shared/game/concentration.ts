import type { GameConfig } from './config.ts';
import type { GameState, Role } from './types.ts';

type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateTakeback(
  state: GameState,
  slotId: string,
  role: Role,
  _cfg: GameConfig,
): ValidationResult {
  if (state.phase !== 'PLACING') return { ok: false, reason: 'Take-back only allowed during PLACING phase' };
  const concSlot = `concentration_${role}`;
  if (!state.placed.some((p) => p.slotId === concSlot)) {
    return { ok: false, reason: 'Must first place a die in your concentration slot' };
  }
  if (!state.placed.find((p) => p.slotId === slotId && p.role === role)) {
    return { ok: false, reason: `No die placed by ${role} in slot ${slotId}` };
  }
  if (slotId === concSlot) return { ok: false, reason: 'Cannot take back the concentration die itself' };
  return { ok: true };
}

export function applyTakeback(state: GameState, slotId: string, role: Role): GameState {
  const target = state.placed.find((p) => p.slotId === slotId && p.role === role)!;
  const newPlaced = state.placed.filter((p) => !(p.slotId === slotId && p.role === role));
  const newRemaining: Record<Role, number[]> = {
    pilot: state.remaining.pilot,
    copilot: state.remaining.copilot,
  };
  newRemaining[role] = [...newRemaining[role], target.value];
  return {
    ...state,
    placed: newPlaced,
    remaining: newRemaining,
    concentrationTokens: { ...state.concentrationTokens, [role]: state.concentrationTokens[role] - 1 },
    turn: role,
  };
}
