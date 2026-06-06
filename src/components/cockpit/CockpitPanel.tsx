import { useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@/types';
import type { GameState, Role } from '@/lib/game/types';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { buildSlots } from '@/lib/game/slots';
import { placeDie, rollDice, revealRound, resolveRound, useConcentration, triggerAiTick, sendMessage } from '@/lib/api';
import { useChat } from '@/hooks/useChat';
import { sounds } from '@/lib/sounds';
import { ApproachTrack } from '@/components/approach/ApproachTrack';
import { DiceHand } from '@/components/dice/DiceHand';
import { DieToken } from '@/components/dice/DieToken';
import { ToastList } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { SlotGroup } from './SlotGroup';

interface Props {
  session: Session;
  gameState: GameState;
  myDice: number[];
  hasAiPlayer?: boolean;
  onLeave: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  LOBBY: 'LOBBY',
  PLACING: 'PLACING',
  REVEALING: 'REVEALING',
  RESOLVING: 'RESOLVING',
  ENDED: 'ENDED',
};

export function CockpitPanel({ session, gameState, myDice, hasAiPlayer = false, onLeave }: Props) {
  const { gameId, role } = session;
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const [concentrationMode, setConcentrationMode] = useState(false);
  const [hiddenInfoDismissed, setHiddenInfoDismissed] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  // P3.1: track number of slots visually revealed during REVEALING phase
  const [revealStep, setRevealStep] = useState(0);
  const messages = useChat(gameId);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toasts, addToast, dismiss } = useToast();
  const cfg = DEFAULT_CONFIG;
  const slots = buildSlots(cfg);

  const isMyTurn = gameState.phase === 'PLACING' && gameState.turn === role;
  const opponentRole: Role = role === 'pilot' ? 'copilot' : 'pilot';
  const opponentDiceCount = gameState.remaining[opponentRole].length;

  // Concentration state
  const hasConcentration = gameState.concentrationTokens[role] > 0;
  const concentrationFilled = gameState.placed.some((p) => p.slotId === `concentration_${role}`);

  const tiltLimit = cfg.rules.axisTiltLimitPerRound[gameState.round - 1] ?? 2;
  const axisDanger = Math.abs(gameState.axisTilt) >= tiltLimit;

  // Auto-roll at start of each round
  useEffect(() => {
    if (gameState.phase === 'LOBBY' || gameState.phase === 'ENDED') return;
    rollDice(gameId).catch(() => {});
    // Also trigger AI roll if there's an AI player
    if (hasAiPlayer) {
      setAiThinking(true);
      triggerAiTick(gameId)
        .then(() => {})
        .catch(() => {})
        .finally(() => setAiThinking(false));
    }
  }, [gameId, gameState.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Axis danger warning
  useEffect(() => {
    if (axisDanger && gameState.phase === 'PLACING') sounds.warning();
  }, [axisDanger, gameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Game-end sound cues
  useEffect(() => {
    if (gameState.phase !== 'ENDED') return;
    if (gameState.status === 'victory') sounds.victory();
    else sounds.crash();
  }, [gameState.phase, gameState.status]);

  // Trigger AI turn when it's the AI's turn during PLACING
  useEffect(() => {
    if (!hasAiPlayer) return;
    if (gameState.phase !== 'PLACING') return;
    if (gameState.turn === role) return; // it's the human's turn
    setAiThinking(true);
    const t = setTimeout(() => {
      triggerAiTick(gameId)
        .then(() => {})
        .catch(() => {})
        .finally(() => setAiThinking(false));
    }, 600); // small delay so UI can render first
    return () => clearTimeout(t);
  }, [gameId, hasAiPlayer, gameState.phase, gameState.turn, role]);

  // P3.1: sequential slot-reveal animation
  useEffect(() => {
    if (gameState.phase !== 'REVEALING') {
      setRevealStep(0);
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      return;
    }
    sounds.reveal();
    setRevealStep(0);
    const total = gameState.placed.length;
    revealTimerRef.current = setInterval(() => {
      setRevealStep((s) => {
        if (s >= total) {
          clearInterval(revealTimerRef.current!);
          return s;
        }
        return s + 1;
      });
    }, 350);
    return () => { if (revealTimerRef.current) clearInterval(revealTimerRef.current); };
  }, [gameState.phase, gameState.placed.length]);

  // Pilot auto-triggers reveal (after animation) then resolve
  useEffect(() => {
    if (role !== 'pilot') return;
    if (gameState.phase === 'REVEALING') {
      const delay = gameState.placed.length * 350 + 400;
      const t = setTimeout(() => revealRound(gameId).catch(console.error), delay);
      return () => clearTimeout(t);
    }
    if (gameState.phase === 'RESOLVING') {
      const t = setTimeout(() => resolveRound(gameId).catch(console.error), 600);
      return () => clearTimeout(t);
    }
  }, [gameId, role, gameState.phase, gameState.placed.length]);

  const handleSlotClick = useCallback(
    async (slotId: string) => {
      // Concentration take-back mode
      if (concentrationMode) {
        setConcentrationMode(false);
        try {
          await useConcentration(gameId, slotId);
          addToast('Concentration used — die returned to hand', 'info');
        } catch (e) {
          addToast(e instanceof Error ? e.message : 'Concentration failed', 'error');
        }
        return;
      }
      if (selectedDie === null) return;
      try {
        await placeDie(gameId, slotId, selectedDie);
        sounds.diePlaced();
        setSelectedDie(null);
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Placement failed', 'error');
      }
    },
    [gameId, selectedDie, concentrationMode, addToast],
  );

  const handleDieSelect = useCallback((v: number) => {
    sounds.dieSelected();
    setSelectedDie((prev) => (prev === v ? null : v));
    setConcentrationMode(false);
  }, []);

  const activateConcentration = useCallback(() => {
    setConcentrationMode(true);
    setSelectedDie(null);
    addToast('Select a die you placed this round to take it back', 'info');
  }, [addToast]);

  const handleSendMessage = useCallback((text: string) => {
    sendMessage(gameId, role, text).catch(() => {});
  }, [gameId, role]);

  // Group slots
  const slotGroups = {
    axis: slots.filter((s) => s.group === 'axis'),
    engine: slots.filter((s) => s.group === 'engine'),
    radio: slots.filter((s) => s.group === 'radio'),
    flaps: slots.filter((s) => s.group === 'flaps'),
    gear: slots.filter((s) => s.group === 'gear'),
    brakes: slots.filter((s) => s.group === 'brakes'),
    concentration: slots.filter((s) => s.group === 'concentration'),
  };

  return (
    <div className="min-h-svh bg-cockpit-bg flex flex-col font-mono select-none">
      {/* ── Header ── */}
      <header className="border-b border-cockpit-border bg-cockpit-surface/60 px-3 py-2 flex items-center gap-2 sm:gap-4 text-xs flex-wrap">
        <span className="text-cockpit-accent font-bold tracking-widest">✈ SKY TEAM</span>
        <span className="text-gray-600">|</span>
        <span className="uppercase tracking-widest text-gray-500">
          Round <span className="text-amber-400 font-bold">{gameState.round}</span>/{cfg.rules.approachTrackLength}
        </span>
        <span className="uppercase tracking-widest text-gray-500">
          Phase <span className={[
            'font-bold',
            gameState.phase === 'PLACING' ? 'text-green-400' :
            gameState.phase === 'ENDED' ? (gameState.status === 'victory' ? 'text-green-400' : 'text-red-400') :
            'text-amber-400',
          ].join(' ')}>{PHASE_LABELS[gameState.phase]}</span>
        </span>
        <span className={['uppercase tracking-widest', axisDanger ? 'text-red-400 font-bold' : 'text-gray-500'].join(' ')}>
          Axis <span className={axisDanger ? 'text-red-400' : 'text-amber-300'}>
            {gameState.axisTilt > 0 ? `+${gameState.axisTilt}` : gameState.axisTilt}
          </span>/{tiltLimit}
        </span>
        <span className="uppercase tracking-widest text-gray-500">
          Spd <span className="text-amber-300">{gameState.speed}</span>
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-gray-600 uppercase">
            {role === 'pilot' ? 'PLT' : 'CPL'}
          </span>
          {/* Concentration token display */}
          <span className="text-gray-600 uppercase tracking-widest">
            Conc <span className={gameState.concentrationTokens[role] > 0 ? 'text-amber-400' : 'text-gray-700'}>
              {gameState.concentrationTokens[role]}
            </span>
          </span>
          <ChatPanel
            messages={messages}
            myRole={role}
            aiThinking={aiThinking}
            hasAi={hasAiPlayer}
            onSend={handleSendMessage}
          />
          <button
            onClick={onLeave}
            className="text-gray-600 hover:text-gray-400 border border-gray-700 rounded px-2 py-0.5 uppercase tracking-widest"
          >
            Leave
          </button>
        </div>
      </header>

      {/* ── Approach track ── */}
      <div className="border-b border-cockpit-border bg-cockpit-surface/20 px-4 py-2">
        <ApproachTrack
          length={cfg.rules.approachTrackLength}
          position={gameState.approachPos}
          traffic={gameState.traffic}
        />
      </div>

      {/* P4.4: Hidden-information banner during PLACING */}
      {gameState.phase === 'PLACING' && !hiddenInfoDismissed && (
        <div className="flex items-center justify-between bg-amber-950/60 border-b border-amber-800/50 px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-600">
          <span>⚠ Placing phase — do not reveal your dice values to your partner (honour system)</span>
          <button
            onClick={() => setHiddenInfoDismissed(true)}
            className="ml-4 text-amber-700 hover:text-amber-500 leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Instrument panel ── */}
      <main className="flex-1 overflow-auto p-2 sm:p-3 space-y-2 sm:space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <SlotGroup
            label="Axis"
            slots={slotGroups.axis}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
          <SlotGroup
            label="Engines"
            slots={slotGroups.engine}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
          <SlotGroup
            label="Radio"
            slots={slotGroups.radio}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <SlotGroup
            label="Flaps"
            slots={slotGroups.flaps}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
          <SlotGroup
            label="Landing Gear"
            slots={slotGroups.gear}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <SlotGroup
            label={`Brakes${gameState.approachPos < cfg.rules.approachTrackLength - 1 ? ' (landing only)' : ''}`}
            slots={slotGroups.brakes}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
          <SlotGroup
            label={`Concentration (${gameState.concentrationTokens[role]} left)`}
            slots={slotGroups.concentration}
            gameState={gameState}
            myRole={role}
            selectedDie={concentrationMode ? null : selectedDie}
            onSlotClick={handleSlotClick}
            cfg={cfg}
            concentrationMode={concentrationMode}
            revealStep={revealStep}
          />
        </div>
      </main>

      {/* ── Footer / dice tray ── */}
      <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-4 py-3 space-y-2">
        {/* Phase overlays */}
        {gameState.phase === 'REVEALING' && (
          <div className="text-center text-xs text-amber-400 uppercase tracking-widest animate-pulse">
            Revealing placements… ({revealStep}/{gameState.placed.length})
          </div>
        )}
        {gameState.phase === 'RESOLVING' && (
          <div className="text-center text-xs text-amber-400 uppercase tracking-widest animate-pulse">
            Resolving round {gameState.round}…
          </div>
        )}

        {/* Dice tray */}
        {gameState.phase === 'PLACING' && (
          <>
            {/* P4.3: Opponent dice — show count + face-down tokens */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                {opponentRole === 'pilot' ? 'PLT' : 'CPL'}
              </span>
              {Array.from({ length: opponentDiceCount }).map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-lg border-2 border-gray-700 bg-gray-800/60 flex items-center justify-center"
                  title="Opponent die (hidden)"
                >
                  <span className="text-gray-700 text-lg">?</span>
                </div>
              ))}
              {opponentDiceCount === 0 && (
                <span className="text-xs text-gray-700">All placed</span>
              )}
            </div>

            {/* My dice */}
            <div className="flex items-center justify-between">
              <DiceHand
                dice={myDice}
                selectedDie={selectedDie}
                onSelect={handleDieSelect}
                isMyTurn={isMyTurn}
              />

              {/* Concentration take-back button */}
              {isMyTurn && concentrationFilled && hasConcentration && !concentrationMode && (
                <button
                  onClick={activateConcentration}
                  className="ml-4 text-[10px] uppercase tracking-widest border border-amber-700 text-amber-600 hover:bg-amber-700/20 rounded px-2 py-1"
                >
                  Take back
                </button>
              )}
              {concentrationMode && (
                <div className="ml-4 flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 uppercase tracking-widest animate-pulse">
                    Click a slot to take back that die
                  </span>
                  <button
                    onClick={() => setConcentrationMode(false)}
                    className="text-[10px] text-gray-600 hover:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Turn indicator / selection hint */}
            <div className="text-[10px] uppercase tracking-widest text-gray-600 h-3">
              {!isMyTurn && `Waiting for ${opponentRole}…`}
              {isMyTurn && selectedDie && !concentrationMode && 'Click a glowing slot to place'}
              {isMyTurn && !selectedDie && !concentrationMode && 'Select a die to place'}
              {concentrationMode && 'Select a placed slot to retrieve that die'}
            </div>
          </>
        )}

        {/* Concentration token row - always visible during game */}
        {gameState.phase === 'PLACING' && (
          <div className="flex items-center gap-3 pt-1 border-t border-cockpit-border/50">
            {(['pilot', 'copilot'] as Role[]).map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span className="text-[9px] text-gray-700 uppercase">{r === 'pilot' ? 'PLT' : 'CPL'}</span>
                {Array.from({ length: Math.max(0, gameState.concentrationTokens[r]) }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-600/70" title="Concentration token" />
                ))}
                {gameState.concentrationTokens[r] === 0 && (
                  <div className="w-2 h-2 rounded-full bg-gray-800 border border-gray-700" />
                )}
              </div>
            ))}
          </div>
        )}
      </footer>

      {/* Opponent die as face-down token - shown in slots for P4 */}
      <div className="hidden"><DieToken value={1} /></div>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
