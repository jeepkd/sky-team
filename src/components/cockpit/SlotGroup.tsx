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
}

function SlotCell({
  slot,
  gameState,
  myRole,
  selectedDie,
  onSlotClick,
  cfg,
}: {
  slot: SlotDef;
  gameState: GameState;
  myRole: Role;
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: GameConfig;
}) {
  const placed = gameState.placed.find((p) => p.slotId === slot.id);

  const isValid =
    selectedDie !== null &&
    !placed &&
    validatePlacement(
      gameState,
      { role: myRole, slotId: slot.id, dieValue: selectedDie },
      cfg,
    ).ok;

  const isOwnerMatch = slot.owner === 'any' || slot.owner === myRole;
  const ownerLabel = slot.owner === 'any' ? 'ANY' : slot.owner === 'pilot' ? 'PLT' : 'CPL';

  if (placed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-600">
          {ownerLabel}
        </span>
        <DieToken value={placed.value} size="md" />
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
          'w-10 h-10 rounded border-2 transition-all duration-150 font-mono text-xs',
          isValid
            ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.5)] cursor-pointer hover:bg-amber-500/20 animate-pulse'
            : selectedDie !== null
              ? 'border-gray-700 bg-gray-900/50 opacity-30 cursor-not-allowed'
              : isOwnerMatch
                ? 'border-gray-700 bg-cockpit-surface/50'
                : 'border-gray-800 bg-gray-900/30 opacity-40',
        ].join(' ')}
        aria-label={`Slot ${slot.id}`}
        title={slot.id}
      />
    </div>
  );
}

export function SlotGroup({ label, slots, gameState, myRole, selectedDie, onSlotClick, cfg }: Props) {
  return (
    <div className="rounded-lg border border-cockpit-border bg-cockpit-surface/40 p-3">
      <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500">
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
}
