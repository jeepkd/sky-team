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
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: GameConfig;
  concentrationMode?: boolean;
  revealStep?: number;
  /** Override the group-level owner for color/border purposes */
  ownerHint?: Role | 'any';
}

// Slot's effective owner for display: if slot is 'any', use the ownerHint if provided
function resolveOwner(slot: SlotDef, hint?: Role | 'any'): Role | 'any' {
  if (slot.owner !== 'any') return slot.owner;
  return hint ?? 'any';
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

const GROUP_ACCENT: Record<Role | 'any', string> = {
  pilot: 'border-l-2 border-l-blue-700/50',
  copilot: 'border-l-2 border-l-orange-600/50',
  any: '',
};

const LABEL_COLOR: Record<Role | 'any', string> = {
  pilot: 'text-blue-500/80',
  copilot: 'text-orange-500/80',
  any: 'text-gray-500',
};

function SlotCell({
  slot,
  gameState,
  myRole,
  selectedDie,
  onSlotClick,
  cfg,
  concentrationMode,
  placementIndex,
  revealStep,
  ownerHint,
}: {
  slot: SlotDef;
  gameState: GameState;
  myRole: Role;
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: GameConfig;
  concentrationMode: boolean;
  placementIndex: number;
  revealStep: number;
  ownerHint?: Role | 'any';
}) {
  const placed = gameState.placed.find((p) => p.slotId === slot.id);
  const isRevealing = gameState.phase === 'REVEALING';
  const isRevealed = !isRevealing || placementIndex < revealStep;

  const effectiveOwner = resolveOwner(slot, ownerHint);
  const colors = OWNER_COLORS[effectiveOwner];

  const isConcentrationTarget =
    concentrationMode &&
    placed !== undefined &&
    placed.role === myRole &&
    !slot.id.startsWith('concentration_');

  const isValid =
    !concentrationMode &&
    selectedDie !== null &&
    !placed &&
    gameState.phase === 'PLACING' &&
    validatePlacement(
      gameState,
      { role: myRole, slotId: slot.id, dieValue: selectedDie },
      cfg,
    ).ok;

  const ownerLabel = slot.owner === 'any' ? 'ANY' : slot.owner === 'pilot' ? 'PLT' : 'CPL';
  const isOwnerMatch = slot.owner === 'any' || slot.owner === myRole;
  const justRevealed = isRevealing && placementIndex === revealStep - 1 && placed;

  if (placed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className={['text-[9px] font-mono uppercase tracking-wider', colors.label].join(' ')}>
          {ownerLabel}
        </span>
        <div
          className={[
            'rounded-lg transition-all duration-300',
            justRevealed ? 'scale-110 shadow-[0_0_16px_rgba(245,158,11,0.9)]' : '',
            isConcentrationTarget ? 'ring-2 ring-amber-400 cursor-pointer scale-105' : '',
            !isRevealed ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
          ].join(' ')}
          onClick={isConcentrationTarget ? () => onSlotClick(slot.id) : undefined}
        >
          <DieToken value={placed.value} role={placed.role} size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={[
          'text-[9px] font-mono uppercase tracking-wider',
          isOwnerMatch ? colors.label : 'text-gray-800',
        ].join(' ')}
      >
        {ownerLabel}
      </span>
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
  label, slots, gameState, myRole, selectedDie, onSlotClick, cfg,
  concentrationMode = false, revealStep = 0, ownerHint,
}: Props) {
  // Determine the dominant owner for group-level styling
  const dominantOwner: Role | 'any' = ownerHint ??
    (slots.length > 0 && slots.every((s) => s.owner === 'pilot') ? 'pilot' :
     slots.every((s) => s.owner === 'copilot') ? 'copilot' : 'any');

  return (
    <div className={[
      'rounded-lg border bg-cockpit-surface/40 p-3',
      OWNER_COLORS[dominantOwner].border,
      GROUP_ACCENT[dominantOwner],
    ].join(' ')}>
      <div className={['mb-2 text-[10px] font-mono uppercase tracking-[0.15em]', LABEL_COLOR[dominantOwner]].join(' ')}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => {
          const placementIndex = gameState.placed.findIndex((p) => p.slotId === slot.id);
          return (
            <SlotCell
              key={slot.id}
              slot={slot}
              gameState={gameState}
              myRole={myRole}
              selectedDie={selectedDie}
              onSlotClick={onSlotClick}
              cfg={cfg}
              concentrationMode={concentrationMode}
              placementIndex={placementIndex}
              revealStep={revealStep}
              ownerHint={ownerHint}
            />
          );
        })}
      </div>
    </div>
  );
});
