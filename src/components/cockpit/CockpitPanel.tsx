import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@/types';
import type { GameState } from '@/lib/game/types';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { buildSlots } from '@/lib/game/slots';
import { placeDie, rollDice, revealRound, resolveRound } from '@/lib/api';
import { ApproachTrack } from '@/components/approach/ApproachTrack';
import { DiceHand } from '@/components/dice/DiceHand';
import { SlotGroup } from './SlotGroup';

interface Props {
  session: Session;
  gameState: GameState;
  myDice: number[];
  onLeave: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  LOBBY: 'LOBBY',
  PLACING: 'PLACING DICE',
  REVEALING: 'REVEALING',
  RESOLVING: 'RESOLVING',
  ENDED: 'GAME OVER',
};

export function CockpitPanel({ session, gameState, myDice, onLeave }: Props) {
  const { gameId, role } = session;
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = DEFAULT_CONFIG;
  const slots = buildSlots(cfg);

  const isMyTurn = gameState.phase === 'PLACING' && gameState.turn === role;

  // Auto-roll at start of each round (or on mount if dice empty)
  useEffect(() => {
    if (gameState.phase === 'LOBBY' || gameState.phase === 'ENDED') return;
    rollDice(gameId).catch(() => {});
  }, [gameId, gameState.round]);

  // Pilot auto-triggers reveal → resolve
  useEffect(() => {
    if (role !== 'pilot') return;
    if (gameState.phase === 'REVEALING') {
      revealRound(gameId).catch(console.error);
    }
    if (gameState.phase === 'RESOLVING') {
      resolveRound(gameId).catch(console.error);
    }
  }, [gameId, role, gameState.phase]);

  const handleSlotClick = useCallback(
    async (slotId: string) => {
      if (selectedDie === null) return;
      setError(null);
      try {
        await placeDie(gameId, slotId, selectedDie);
        setSelectedDie(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Placement failed');
      }
    },
    [gameId, selectedDie],
  );

  const handleDieSelect = useCallback((v: number) => {
    setSelectedDie((prev) => (prev === v ? null : v));
  }, []);

  // Group slots by type
  const axisSlots = slots.filter((s) => s.group === 'axis');
  const engineSlots = slots.filter((s) => s.group === 'engine');
  const radioSlots = slots.filter((s) => s.group === 'radio');
  const flapsSlots = slots.filter((s) => s.group === 'flaps');
  const gearSlots = slots.filter((s) => s.group === 'gear');
  const brakeSlots = slots.filter((s) => s.group === 'brakes');
  const concSlots = slots.filter((s) => s.group === 'concentration');

  const statusColors: Record<string, string> = {
    active: 'text-green-400',
    victory: 'text-amber-400',
    crashed: 'text-red-400',
    failed: 'text-orange-400',
  };

  return (
    <div className="min-h-screen bg-cockpit-bg flex flex-col font-mono">
      {/* Header bar */}
      <header className="border-b border-cockpit-border bg-cockpit-surface/60 px-6 py-3 flex items-center gap-6">
        <span className="text-cockpit-accent font-bold tracking-widest text-lg">✈ SKY TEAM</span>
        <div className="flex items-center gap-1">
          <span className="text-gray-600 text-xs uppercase tracking-widest">Round</span>
          <span className="text-amber-400 font-bold text-sm ml-1">
            {gameState.round}/{cfg.rules.approachTrackLength}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-600 text-xs uppercase tracking-widest">Phase</span>
          <span className={[
            'text-xs font-bold ml-1 uppercase tracking-widest',
            gameState.phase === 'PLACING' ? 'text-green-400' :
            gameState.phase === 'ENDED' ? (statusColors[gameState.status] ?? 'text-gray-400') :
            'text-amber-400',
          ].join(' ')}>
            {PHASE_LABELS[gameState.phase] ?? gameState.phase}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-gray-600 text-xs uppercase tracking-widest">Axis</span>
          <span className={[
            'font-bold text-sm',
            Math.abs(gameState.axisTilt) >= (cfg.rules.axisTiltLimitPerRound[gameState.round - 1] ?? 2)
              ? 'text-red-400'
              : 'text-amber-300',
          ].join(' ')}>
            {gameState.axisTilt > 0 ? `+${gameState.axisTilt}` : gameState.axisTilt}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-600 uppercase tracking-widest">
            {role === 'pilot' ? '👨‍✈️ Pilot' : '🧑‍✈️ Copilot'}
          </span>
          <button
            onClick={onLeave}
            className="text-xs text-gray-600 hover:text-gray-400 uppercase tracking-widest border border-gray-700 rounded px-2 py-1"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Approach track strip */}
      <div className="border-b border-cockpit-border bg-cockpit-surface/30 px-6 py-2">
        <ApproachTrack
          length={cfg.rules.approachTrackLength}
          position={gameState.approachPos}
          traffic={gameState.traffic}
        />
      </div>

      {/* End-game overlay */}
      {gameState.phase === 'ENDED' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 p-8 rounded-2xl border border-cockpit-border bg-cockpit-surface/80">
            <p className={['text-4xl font-bold uppercase tracking-widest', statusColors[gameState.status]].join(' ')}>
              {gameState.status === 'victory' ? '✈ LANDED' : gameState.status === 'crashed' ? '💥 CRASHED' : '⚠ FAILED'}
            </p>
            <p className="text-gray-500 text-sm">
              {gameState.status === 'victory'
                ? 'Smooth landing. Well done, crew.'
                : gameState.status === 'crashed'
                  ? 'The aircraft was lost. Review approach data.'
                  : 'Approach incomplete. Try again.'}
            </p>
            <button
              onClick={onLeave}
              className="mt-4 px-6 py-2 border border-amber-500 text-amber-400 rounded hover:bg-amber-500/10 text-sm uppercase tracking-widest"
            >
              Return to lobby
            </button>
          </div>
        </div>
      )}

      {/* Instrument panel */}
      {gameState.phase !== 'ENDED' && (
        <main className="flex-1 overflow-auto p-4">
          {/* Row 1: Axis, Engines, Radio */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <SlotGroup
              label="Axis"
              slots={axisSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
            <SlotGroup
              label="Engines"
              slots={engineSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
            <SlotGroup
              label="Radio"
              slots={radioSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
          </div>

          {/* Row 2: Flaps, Gear */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <SlotGroup
              label="Flaps"
              slots={flapsSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
            <SlotGroup
              label="Landing Gear"
              slots={gearSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
          </div>

          {/* Row 3: Brakes, Concentration */}
          <div className="grid grid-cols-2 gap-3">
            <SlotGroup
              label={`Brakes${gameState.approachPos < cfg.rules.approachTrackLength - 1 ? ' (landing only)' : ''}`}
              slots={brakeSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
            <SlotGroup
              label="Concentration"
              slots={concSlots}
              gameState={gameState}
              myRole={role}
              selectedDie={selectedDie}
              onSlotClick={handleSlotClick}
              cfg={cfg}
            />
          </div>
        </main>
      )}

      {/* Dice tray */}
      {gameState.phase === 'PLACING' && (
        <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-6 py-4">
          {error && (
            <p className="text-red-400 text-xs font-mono mb-3 uppercase tracking-widest">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <DiceHand
              dice={myDice}
              selectedDie={selectedDie}
              onSelect={handleDieSelect}
              isMyTurn={isMyTurn}
            />
            {!isMyTurn && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-gray-500 uppercase tracking-widest">
                  Waiting for{' '}
                  {role === 'pilot' ? 'copilot' : 'pilot'}
                </span>
              </div>
            )}
          </div>
          {selectedDie && (
            <p className="mt-2 text-xs text-amber-500 uppercase tracking-widest animate-pulse">
              Die {selectedDie} selected — click a valid slot to place
            </p>
          )}
        </footer>
      )}

      {gameState.phase === 'REVEALING' && (
        <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-6 py-4 text-center">
          <p className="text-amber-400 text-sm uppercase tracking-widest animate-pulse">
            Revealing all placements…
          </p>
        </footer>
      )}

      {gameState.phase === 'RESOLVING' && (
        <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-6 py-4 text-center">
          <p className="text-amber-400 text-sm uppercase tracking-widest animate-pulse">
            Resolving round {gameState.round}…
          </p>
        </footer>
      )}
    </div>
  );
}
