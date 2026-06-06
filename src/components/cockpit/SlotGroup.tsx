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
}

const OWNER_COLORS: Record<Role | 'any', { border: string; label: string; glow: string; emptyBorder: string }> = {
  pilot: {
    border: 'border-blue-900/60',
    label: 'text-blue-500/70',
    glow: 'border-blue-400 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    emptyBorder: 'border-blue-900/40 bg-blue-950/30',
  },
  copilot: {
    border: 'border-orange-900/60',
    label: 'text-orange-500/70',
    glow: 'border-orange-400 bg-orange-500/10 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
    emptyBorder: 'border-orange-900/40 bg-orange-950/30',
  },
  any: {
    border: 'border-cockpit-border',
    label: 'text-gray-600',
    glow: 'border-amber-500 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    emptyBorder: 'border-gray-800 bg-cockpit-surface/50',
  },
};

const LABEL_COLOR: Record<Role | 'any', string> = {
  pilot: 'text-blue-500/80',
  copilot: 'text-orange-500/80',
  any: 'text-gray-500',
};

/** The value requirement printed on a space (e.g. "3/4" for a flap or gear, "2" for a brake). */
function valueHint(slotId: string, cfg: GameConfig): string | null {
  const [group, nStr] = slotId.split('_');
  const i = Number(nStr) - 1;
  if (group === 'flaps' && cfg.rules.flaps[i]) return cfg.rules.flaps[i].join('/');
  if (group === 'gear' && cfg.rules.gear[i]) return cfg.rules.gear[i].join('/');
  if (group === 'brakes' && cfg.rules.brakes[i] !== undefined) return String(cfg.rules.brakes[i]);
  return null;
}

function SlotCell({ slot, gameState, myRole, selectedDie, onSlotClick, cfg }: {
  slot: SlotDef;
  gameState: GameState;
  myRole: Role;
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: GameConfig;
}) {
  const placed = gameState.placed.find((p) => p.slotId === slot.id);
  const owner: Role | 'any' = slot.owner;
  const colors = OWNER_COLORS[owner];
  const hint = valueHint(slot.id, cfg);

  const isValid =
    selectedDie !== null &&
    !placed &&
    gameState.phase === 'PLACING' &&
    validatePlacement(gameState, { role: myRole, slotId: slot.id, dieValue: selectedDie }, cfg).ok;

  const isOwnerMatch = slot.owner === 'any' || slot.owner === myRole;

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
      {hint && (
        <span className={['text-[8px] font-mono', isOwnerMatch ? colors.label : 'text-gray-700'].join(' ')}>
          {hint}
        </span>
      )}
      <button
        onClick={isValid ? () => onSlotClick(slot.id) : undefined}
        disabled={!isValid}
        className={[
          'w-10 h-10 rounded border-2 transition-all duration-150',
          isValid
            ? colors.glow + ' cursor-pointer hover:scale-105'
            : selectedDie !== null
              ? 'border-gray-800 bg-gray-900/30 opacity-25 cursor-not-allowed'
              : isOwnerMatch
                ? colors.emptyBorder + ' cursor-default'
                : 'border-gray-800 bg-gray-900/20 opacity-20 cursor-default',
        ].join(' ')}
        aria-label={`Slot ${slot.id}`}
      />
    </div>
  );
}

export const SlotGroup = memo(function SlotGroup({
  label, slots, gameState, myRole, selectedDie, onSlotClick, cfg, ownerHint,
}: Props) {
  const dominantOwner: Role | 'any' = ownerHint ??
    (slots.length > 0 && slots.every((s) => s.owner === 'pilot') ? 'pilot' :
     slots.length > 0 && slots.every((s) => s.owner === 'copilot') ? 'copilot' : 'any');

  return (
    <div className={['rounded-lg border bg-cockpit-surface/40 p-3', OWNER_COLORS[dominantOwner].border].join(' ')}>
      <div className={['mb-2 text-[10px] font-mono uppercase tracking-[0.15em]', LABEL_COLOR[dominantOwner]].join(' ')}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <SlotCell
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
