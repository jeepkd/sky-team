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
}

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
}) {
  const placed = gameState.placed.find((p) => p.slotId === slot.id);
  const isRevealing = gameState.phase === 'REVEALING';
  const isRevealed = !isRevealing || placementIndex < revealStep;

  // Concentration take-back mode: highlight your own placed dice
  const isConcentrationTarget =
    concentrationMode &&
    placed !== undefined &&
    placed.role === myRole &&
    slot.id !== `concentration_${myRole}`;

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

  // Revealing animation: flash when just revealed
  const justRevealed = isRevealing && placementIndex === revealStep - 1 && placed;

  if (placed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">{ownerLabel}</span>
        <div
          className={[
            'rounded-lg transition-all duration-300',
            justRevealed ? 'scale-110 shadow-[0_0_16px_rgba(245,158,11,0.9)]' : '',
            isConcentrationTarget ? 'ring-2 ring-amber-400 cursor-pointer scale-105' : '',
            !isRevealed ? 'opacity-0 scale-75' : 'opacity-100 scale-100',
          ].join(' ')}
          onClick={isConcentrationTarget ? () => onSlotClick(slot.id) : undefined}
        >
          <DieToken value={placed.value} size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={[
          'text-[9px] font-mono uppercase tracking-wider',
          isOwnerMatch ? 'text-gray-500' : 'text-gray-700',
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
            ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.4)] cursor-pointer hover:bg-amber-500/25'
            : selectedDie !== null
              ? 'border-gray-800 bg-gray-900/30 opacity-25 cursor-not-allowed'
              : isOwnerMatch
                ? 'border-gray-700 bg-cockpit-surface/50 cursor-default'
                : 'border-gray-800 bg-gray-900/20 opacity-30 cursor-default',
        ].join(' ')}
        aria-label={`Slot ${slot.id}`}
      />
    </div>
  );
}

export const SlotGroup = memo(function SlotGroup({
  label, slots, gameState, myRole, selectedDie, onSlotClick, cfg,
  concentrationMode = false, revealStep = 0,
}: Props) {
  return (
    <div className="rounded-lg border border-cockpit-border bg-cockpit-surface/40 p-3">
      <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500">{label}</div>
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
            />
          );
        })}
      </div>
    </div>
  );
});
