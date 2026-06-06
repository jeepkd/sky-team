import { useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@/types';
import type { GameState, Role } from '@/lib/game/types';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { buildSlots } from '@/lib/game/slots';
import { placeDie, rollDice, revealRound, resolveRound, useConcentration, triggerAiTick, sendMessage } from '@/lib/api';
import { validatePlacement } from '@/lib/game/validate';
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
  const [revealStep, setRevealStep] = useState(0);
  const messages = useChat(gameId);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toasts, addToast, dismiss } = useToast();
  const cfg = DEFAULT_CONFIG;
  const slots = buildSlots(cfg);

  const isMyTurn = gameState.phase === 'PLACING' && gameState.turn === role;
  const opponentRole: Role = role === 'pilot' ? 'copilot' : 'pilot';
  const opponentDiceCount = gameState.remaining[opponentRole].length;

  const hasConcentration = gameState.concentrationTokens[role] > 0;
  const concentrationFilled = gameState.placed.some((p) => p.slotId.startsWith('concentration_'));

  const tiltLimit = cfg.rules.axisTiltLimitPerRound[gameState.round - 1] ?? 2;
  const axisDanger = Math.abs(gameState.axisTilt) >= tiltLimit;

  // Auto-roll at start of each round
  useEffect(() => {
    if (gameState.phase === 'LOBBY' || gameState.phase === 'ENDED') return;
    rollDice(gameId).catch(() => {});
    if (hasAiPlayer) {
      setAiThinking(true);
      triggerAiTick(gameId).catch(() => {}).finally(() => setAiThinking(false));
    }
  }, [gameId, gameState.round]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (axisDanger && gameState.phase === 'PLACING') sounds.warning();
  }, [axisDanger, gameState.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gameState.phase !== 'ENDED') return;
    if (gameState.status === 'victory') sounds.victory();
    else sounds.crash();
  }, [gameState.phase, gameState.status]);

  useEffect(() => {
    if (!hasAiPlayer) return;
    if (gameState.phase !== 'PLACING') return;
    if (gameState.turn === role) return;
    setAiThinking(true);
    const t = setTimeout(() => {
      triggerAiTick(gameId).catch(() => {}).finally(() => setAiThinking(false));
    }, 600);
    return () => clearTimeout(t);
  }, [gameId, hasAiPlayer, gameState.phase, gameState.turn, role]);

  // Sequential slot-reveal animation
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
        if (s >= total) { clearInterval(revealTimerRef.current!); return s; }
        return s + 1;
      });
    }, 350);
    return () => { if (revealTimerRef.current) clearInterval(revealTimerRef.current); };
  }, [gameState.phase, gameState.placed.length]);

  // Pilot auto-triggers reveal then resolve
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

  // Slot groups
  const slotGroups = {
    axis: slots.filter((s) => s.group === 'axis'),
    engineLeft: slots.filter((s) => s.id === 'engine_left'),
    engineRight: slots.filter((s) => s.id === 'engine_right'),
    radioPilot: slots.filter((s) => s.id === 'radio_pilot'),
    radioCopilot: slots.filter((s) => s.id.startsWith('radio_copilot')),
    flaps: slots.filter((s) => s.group === 'flaps'),
    gearLeft: slots.filter((s) => s.id === 'gear_left'),
    gearRight: slots.filter((s) => s.id === 'gear_right'),
    brakes: slots.filter((s) => s.group === 'brakes'),
    concentration: slots.filter((s) => s.group === 'concentration'),  // 3 slots, any player
  };

  const slotProps = {
    gameState,
    myRole: role,
    selectedDie: concentrationMode ? null : selectedDie,
    onSlotClick: handleSlotClick,
    cfg,
    concentrationMode,
    revealStep,
  };

  const isLanding = gameState.approachPos >= cfg.rules.approachTrackLength - 1;

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
          <span className={role === 'pilot' ? 'text-blue-500' : 'text-orange-500'}>
            {role === 'pilot' ? 'PILOT' : 'CO-PILOT'}
          </span>
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

      {/* Hidden-info banner */}
      {gameState.phase === 'PLACING' && !hiddenInfoDismissed && (
        <div className="flex items-center justify-between bg-amber-950/60 border-b border-amber-800/50 px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-600">
          <span>⚠ Placing phase — do not reveal your dice values to your partner (honour system)</span>
          <button
            onClick={() => setHiddenInfoDismissed(true)}
            className="ml-4 text-amber-700 hover:text-amber-500 leading-none"
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {/* ── Instrument panel ── */}
      <main className="flex-1 overflow-auto p-2 sm:p-3 space-y-2 sm:space-y-3">

        {/* ── Axis — full-width center piece ── */}
        <div className="rounded-lg border border-gray-700/50 bg-cockpit-surface/40 p-3">
          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 text-center">
            Axis — {axisDanger ? <span className="text-red-400 animate-pulse">⚠ DANGER</span> : 'level'}
          </div>
          <div className="flex items-center justify-center gap-8">
            {slotGroups.axis.map((slot) => {
              const isPilot = slot.id === 'axis_pilot';
              const placed = gameState.placed.find((p) => p.slotId === slot.id);
              const placementIndex = gameState.placed.findIndex((p) => p.slotId === slot.id);
              const isRevealing = gameState.phase === 'REVEALING';
              const isRevealed = !isRevealing || placementIndex < revealStep;
              const isValid =
                !concentrationMode &&
                selectedDie !== null &&
                !placed &&
                gameState.phase === 'PLACING' &&
                validatePlacement(gameState, { role, slotId: slot.id, dieValue: selectedDie }, cfg).ok;

              return (
                <div key={slot.id} className="flex flex-col items-center gap-1">
                  <span className={['text-[9px] font-mono uppercase tracking-wider', isPilot ? 'text-blue-500/70' : 'text-orange-500/70'].join(' ')}>
                    {isPilot ? 'PILOT' : 'COPILOT'}
                  </span>
                  {placed ? (
                    <div className={['transition-all duration-300', !isRevealed ? 'opacity-0 scale-75' : 'opacity-100 scale-100'].join(' ')}>
                      <DieToken value={placed.value} role={placed.role} size="lg" />
                    </div>
                  ) : (
                    <button
                      onClick={isValid ? () => handleSlotClick(slot.id) : undefined}
                      disabled={!isValid}
                      className={[
                        'w-16 h-16 rounded-full border-2 transition-all duration-150',
                        isPilot ? 'border-blue-900/40 bg-blue-950/30' : 'border-orange-900/40 bg-orange-950/30',
                        isValid
                          ? isPilot
                            ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.5)] cursor-pointer hover:scale-105'
                            : 'border-orange-400 bg-orange-500/10 shadow-[0_0_12px_rgba(249,115,22,0.5)] cursor-pointer hover:scale-105'
                          : selectedDie !== null ? 'opacity-25' : '',
                      ].join(' ')}
                      aria-label={`Axis ${isPilot ? 'pilot' : 'copilot'} slot`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main panel — Pilot left | Copilot right ── */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">

          {/* Pilot column */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-blue-600 px-1">— Pilot —</div>
            <SlotGroup label="Engine (1–3)" slots={slotGroups.engineLeft} {...slotProps} />
            <SlotGroup label="Gear Left" slots={slotGroups.gearLeft} {...slotProps} />
            <SlotGroup label="Radio" slots={slotGroups.radioPilot} {...slotProps} />
            {isLanding && (
              <SlotGroup label="Brakes" slots={slotGroups.brakes} {...slotProps} />
            )}
            {!isLanding && (
              <div className="rounded-lg border border-gray-800/40 bg-gray-900/20 p-3 opacity-40">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-gray-700">Brakes (landing only)</div>
                <div className="mt-2 flex gap-2">
                  {slotGroups.brakes.map((s) => (
                    <div key={s.id} className="w-10 h-10 rounded border-2 border-gray-800/30 bg-gray-900/10" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copilot column */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-orange-600 px-1">— Co-pilot —</div>
            <SlotGroup label="Engine (4–6)" slots={slotGroups.engineRight} {...slotProps} />
            <SlotGroup label="Gear Right" slots={slotGroups.gearRight} {...slotProps} />
            <SlotGroup label="Radio" slots={slotGroups.radioCopilot} {...slotProps} />
            <SlotGroup
              label={`Flaps${gameState.flapsLevel > 0 ? ` (${gameState.flapsLevel}/4)` : ''}`}
              slots={slotGroups.flaps}
              {...slotProps}
            />
          </div>
        </div>

        {/* ── Concentration — full width ── */}
        <SlotGroup
          label={`Concentration — Pilot: ${gameState.concentrationTokens.pilot} · Co-pilot: ${gameState.concentrationTokens.copilot}`}
          slots={slotGroups.concentration}
          {...slotProps}
          ownerHint="any"
        />
      </main>

      {/* ── Footer / dice tray ── */}
      <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-4 py-3 space-y-2">
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

        {gameState.phase === 'PLACING' && (
          <>
            {/* Opponent dice face-down */}
            <div className="flex items-center gap-2">
              <span className={[
                'text-[10px] font-mono uppercase tracking-widest',
                opponentRole === 'pilot' ? 'text-blue-600' : 'text-orange-600',
              ].join(' ')}>
                {opponentRole === 'pilot' ? 'Pilot' : 'Co-pilot'}
              </span>
              {Array.from({ length: opponentDiceCount }).map((_, i) => (
                <DieToken key={i} value={0} role={opponentRole} faceDown size="lg" />
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
                role={role}
              />

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

            <div className="text-[10px] uppercase tracking-widest text-gray-600 h-3">
              {!isMyTurn && `Waiting for ${opponentRole}…`}
              {isMyTurn && selectedDie && !concentrationMode && 'Click a glowing slot to place'}
              {isMyTurn && !selectedDie && !concentrationMode && 'Select a die to place'}
              {concentrationMode && 'Select a placed slot to retrieve that die'}
            </div>
          </>
        )}

        {/* Concentration token dots */}
        {gameState.phase === 'PLACING' && (
          <div className="flex items-center gap-4 pt-1 border-t border-cockpit-border/50">
            {(['pilot', 'copilot'] as Role[]).map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span className={['text-[9px] uppercase', r === 'pilot' ? 'text-blue-700' : 'text-orange-700'].join(' ')}>
                  {r === 'pilot' ? 'PLT' : 'CPL'}
                </span>
                {Array.from({ length: Math.max(0, gameState.concentrationTokens[r]) }).map((_, i) => (
                  <div key={i} className={['w-2 h-2 rounded-full', r === 'pilot' ? 'bg-blue-600/70' : 'bg-orange-600/70'].join(' ')} />
                ))}
                {gameState.concentrationTokens[r] === 0 && (
                  <div className="w-2 h-2 rounded-full bg-gray-800 border border-gray-700" />
                )}
              </div>
            ))}
          </div>
        )}
      </footer>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
