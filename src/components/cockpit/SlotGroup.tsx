import { memo } from 'react';
import type { GameConfig } from '@/lib/game/config';
import type { GameState, Role, SlotDef } from '@/lib/game/types';
import { validatePlacement } from '@/lib/game/validate';
import { DieToken } from '@/components/dice/DieToken';

interface Props {
  label: string;
  slots: SlotDef[];
  gameState: GameState;
  myRole: Role;
  /** The value that would be placed (after any coffee adjustment), or null. */
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: GameConfig;
  ownerHint?: Role | 'any';
  /** 'dice' = plain spaces; 'switch' = gear/flap-style switch with a green light. */
  variant?: 'dice' | 'switch';
  /** Lay the slots out vertically (used for the wing columns). */
  vertical?: boolean;
}

const OWNER_COLORS: Record<Role | 'any', { border: string; label: string; glow: string; emptyBorder: string }> = {
  pilot: {
    border: 'border-blue-900/60',
    label: 'text-blue-400/80',
    glow: 'border-blue-400 bg-blue-500/15 shadow-[0_0_10px_rgba(59,130,246,0.6)]',
    emptyBorder: 'border-blue-800/50 bg-blue-950/40',
  },
  copilot: {
    border: 'border-orange-900/60',
    label: 'text-orange-400/80',
    glow: 'border-orange-400 bg-orange-500/15 shadow-[0_0_10px_rgba(249,115,22,0.6)]',
    emptyBorder: 'border-orange-800/50 bg-orange-950/40',
  },
  any: {
    border: 'border-zinc-600/60',
    label: 'text-gray-500',
    glow: 'border-amber-400 bg-amber-500/15 shadow-[0_0_10px_rgba(245,158,11,0.5)]',
    emptyBorder: 'border-zinc-700 bg-zinc-800/50',
  },
};

const LABEL_COLOR: Record<Role | 'any', string> = {
  pilot: 'text-blue-400/90',
  copilot: 'text-orange-400/90',
  any: 'text-gray-400',
};

function valueHint(slotId: string, cfg: GameConfig): string | null {
  const [group, nStr] = slotId.split('_');
  const i = Number(nStr) - 1;
  if (group === 'flaps' && cfg.rules.flaps[i]) return cfg.rules.flaps[i].join('/');
  if (group === 'gear' && cfg.rules.gear[i]) return cfg.rules.gear[i].join('/');
  if (group === 'brakes' && cfg.rules.brakes[i] !== undefined) return String(cfg.rules.brakes[i]);
  return null;
}

function useSlotState(slot: SlotDef, gameState: GameState, myRole: Role, selectedDie: number | null, cfg: GameConfig) {
  const placed = gameState.placed.find((p) => p.slotId === slot.id);
  const isValid =
    selectedDie !== null &&
    !placed &&
    gameState.phase === 'PLACING' &&
    validatePlacement(gameState, { role: myRole, slotId: slot.id, dieValue: selectedDie }, cfg).ok;
  const isOwnerMatch = slot.owner === 'any' || slot.owner === myRole;
  return { placed, isValid, isOwnerMatch };
}

/** A gear/flap deployment switch with a status light that turns green when deployed. */
function SwitchCell({ slot, gameState, myRole, selectedDie, onSlotClick, cfg }: CellProps) {
  const { placed, isValid, isOwnerMatch } = useSlotState(slot, gameState, myRole, selectedDie, cfg);
  const colors = OWNER_COLORS[slot.owner];
  const hint = valueHint(slot.id, cfg);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* status light */}
      <span
        className={[
          'w-2.5 h-2.5 rounded-full border',
          placed
            ? 'bg-green-400 border-green-300 shadow-[0_0_8px_rgba(74,222,128,0.9)]'
            : 'bg-zinc-800 border-zinc-600',
        ].join(' ')}
      />
      {/* hint */}
      {hint && <span className={['text-[8px] font-mono', isOwnerMatch ? colors.label : 'text-gray-700'].join(' ')}>{hint}</span>}
      {/* lever / die */}
      {placed ? (
        <DieToken value={placed.value} role={placed.role} size="sm" />
      ) : (
        <button
          onClick={isValid ? () => onSlotClick(slot.id) : undefined}
          disabled={!isValid}
          className={[
            'w-9 h-9 rounded-md border-2 flex items-center justify-center transition-all duration-150',
            isValid
              ? colors.glow + ' cursor-pointer hover:scale-105'
              : selectedDie !== null ? 'border-zinc-800 bg-zinc-900/40 opacity-30'
              : isOwnerMatch ? colors.emptyBorder : 'border-zinc-800 bg-zinc-900/30 opacity-25',
          ].join(' ')}
          aria-label={`Deploy ${slot.id}`}
        >
          <span className="w-1 h-4 rounded-full bg-zinc-600" />
        </button>
      )}
    </div>
  );
}

/** A plain dice space. */
function DiceCell({ slot, gameState, myRole, selectedDie, onSlotClick, cfg }: CellProps) {
  const { placed, isValid, isOwnerMatch } = useSlotState(slot, gameState, myRole, selectedDie, cfg);
  const colors = OWNER_COLORS[slot.owner];
  const hint = valueHint(slot.id, cfg);

  if (placed) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {hint && <span className="text-[8px] font-mono text-gray-600">{hint}</span>}
        <DieToken value={placed.value} role={placed.role} size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {hint && <span className={['text-[8px] font-mono', isOwnerMatch ? colors.label : 'text-gray-700'].join(' ')}>{hint}</span>}
      <button
        onClick={isValid ? () => onSlotClick(slot.id) : undefined}
        disabled={!isValid}
        className={[
          'w-10 h-10 rounded border-2 transition-all duration-150',
          isValid
            ? colors.glow + ' cursor-pointer hover:scale-105'
            : selectedDie !== null ? 'border-zinc-800 bg-zinc-900/40 opacity-25 cursor-not-allowed'
            : isOwnerMatch ? colors.emptyBorder + ' cursor-default' : 'border-zinc-800 bg-zinc-900/20 opacity-20 cursor-default',
        ].join(' ')}
        aria-label={`Slot ${slot.id}`}
      />
    </div>
  );
}

interface CellProps {
  slot: SlotDef;
  gameState: GameState;
  myRole: Role;
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: GameConfig;
}

export const SlotGroup = memo(function SlotGroup({
  label, slots, gameState, myRole, selectedDie, onSlotClick, cfg, ownerHint, variant = 'dice', vertical = false,
}: Props) {
  const dominantOwner: Role | 'any' = ownerHint ??
    (slots.length > 0 && slots.every((s) => s.owner === 'pilot') ? 'pilot' :
     slots.length > 0 && slots.every((s) => s.owner === 'copilot') ? 'copilot' : 'any');
  const Cell = variant === 'switch' ? SwitchCell : DiceCell;

  return (
    <div className={['rounded-lg border bg-zinc-900/40 p-2.5', OWNER_COLORS[dominantOwner].border].join(' ')}>
      <div className={['mb-1.5 text-[9px] font-mono uppercase tracking-[0.15em]', LABEL_COLOR[dominantOwner]].join(' ')}>
        {label}
      </div>
      <div className={['flex flex-wrap gap-2', vertical ? 'flex-col items-start' : 'items-end'].join(' ')}>
        {slots.map((slot) => (
          <Cell
            key={slot.id}
            slot={slot}
            gameState={gameState}
            myRole={myRole}
            selectedDie={selectedDie}
            onSlotClick={onSlotClick}
            cfg={cfg}
          />
        ))}
      </div>
    </div>
  );
});
