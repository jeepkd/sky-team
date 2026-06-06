import type { GameConfig } from './config';
import type { GameState, Role } from './types';

type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Validates that a player can take back (un-place) a die they placed this round
 * as a result of spending a concentration token.
 * TODO_RULEBOOK: Confirm the exact concentration mechanic (take-back vs. re-roll vs. value change).
 */
export function validateTakeback(
  state: GameState,
  slotId: string,
  role: Role,
  _cfg: GameConfig,
): ValidationResult {
  if (state.phase !== 'PLACING') {
    return { ok: false, reason: 'Take-back only allowed during PLACING phase' };
  }
  const concSlot = `concentration_${role}`;
  const concFilled = state.placed.some((p) => p.slotId === concSlot);
  if (!concFilled) {
    return { ok: false, reason: `Must first place a die in your concentration slot` };
  }
  const target = state.placed.find((p) => p.slotId === slotId && p.role === role);
  if (!target) {
    return { ok: false, reason: `No die placed by ${role} in slot ${slotId}` };
  }
  if (slotId === concSlot) {
    return { ok: false, reason: 'Cannot take back the concentration die itself' };
  }
  return { ok: true };
}

/**
 * Takes back a placed die, returning it to the player's remaining pool.
 * Decrements the concentration token for that player.
 */
export function applyTakeback(
  state: GameState,
  slotId: string,
  role: Role,
): GameState {
  const target = state.placed.find((p) => p.slotId === slotId && p.role === role)!;
  const newPlaced = state.placed.filter((p) => p.slotId !== slotId || p.role !== role);
  const newRemaining: Record<Role, number[]> = {
    pilot: state.remaining.pilot,
    copilot: state.remaining.copilot,
  };
  newRemaining[role] = [...newRemaining[role], target.value];
  return {
    ...state,
    placed: newPlaced,
    remaining: newRemaining,
    concentrationTokens: {
      ...state.concentrationTokens,
      [role]: state.concentrationTokens[role] - 1,
    },
    // Revert turn to the player who took back so they can re-place
    turn: role,
  };
}
