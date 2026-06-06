import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@/types';
import type { GameState, Role } from '@/lib/game/types';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { buildSlots } from '@/lib/game/slots';
import { validatePlacement } from '@/lib/game/validate';
import { brakeThreshold } from '@/lib/game/resolve';
import { placeDie, rollDice, reroll as rerollApi, triggerAiTick, sendMessage } from '@/lib/api';
import { useChat } from '@/hooks/useChat';
import { sounds } from '@/lib/sounds';
import { ApproachTrack } from '@/components/approach/ApproachTrack';
import { DiceHand } from '@/components/dice/DiceHand';
import { DieToken } from '@/components/dice/DieToken';
import { ToastList } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { SlotGroup } from './SlotGroup';
import { SpeedGauge } from './SpeedGauge';
import { AxisDial } from './AxisDial';

interface Props {
  session: Session;
  gameState: GameState;
  myDice: number[];
  hasAiPlayer?: boolean;
  onLeave: () => void;
}

export function CockpitPanel({ session, gameState, myDice, hasAiPlayer = false, onLeave }: Props) {
  const { gameId, role } = session;
  const cfg = DEFAULT_CONFIG;
  const slots = buildSlots(cfg);

  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const [adjusted, setAdjusted] = useState<number | null>(null);
  const [rerollMode, setRerollMode] = useState(false);
  const [rerollSel, setRerollSel] = useState<number[]>([]);
  const [aiThinking, setAiThinking] = useState(false);

  const messages = useChat(gameId);
  const { toasts, addToast, dismiss } = useToast();

  const isMyTurn = gameState.phase === 'PLACING' && gameState.turn === role;
  const opponentRole: Role = role === 'pilot' ? 'copilot' : 'pilot';
  const opponentDiceCount = gameState.remaining[opponentRole].length;
  const isFinalRound = gameState.round >= cfg.rules.totalRounds;
  const coffeeCost = selectedDie !== null && adjusted !== null ? Math.abs(adjusted - selectedDie) : 0;
  const altitudeFt = (cfg.rules.totalRounds - gameState.round) * 1000;

  useEffect(() => {
    if (gameState.phase === 'LOBBY' || gameState.phase === 'ENDED') return;
    rollDice(gameId).catch(() => {});
    if (hasAiPlayer) {
      setAiThinking(true);
      triggerAiTick(gameId).catch(() => {}).finally(() => setAiThinking(false));
    }
  }, [gameId, gameState.round]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasAiPlayer || gameState.phase !== 'PLACING' || gameState.turn === role) return;
    setAiThinking(true);
    const t = setTimeout(() => {
      triggerAiTick(gameId).catch(() => {}).finally(() => setAiThinking(false));
    }, 600);
    return () => clearTimeout(t);
  }, [gameId, hasAiPlayer, gameState.phase, gameState.turn, role]);

  useEffect(() => {
    if (gameState.phase !== 'ENDED') return;
    if (gameState.status === 'victory') sounds.victory();
    else sounds.crash();
  }, [gameState.phase, gameState.status]);

  const selectDie = useCallback((v: number) => {
    sounds.dieSelected();
    setSelectedDie((prev) => (prev === v ? null : v));
    setAdjusted((prev) => (prev === v ? null : v));
  }, []);

  const adjust = useCallback((delta: number) => {
    setAdjusted((prev) => {
      if (prev === null || selectedDie === null) return prev;
      const next = prev + delta;
      if (next < 1 || next > 6) return prev;
      if (Math.abs(next - selectedDie) > gameState.coffee) return prev;
      return next;
    });
  }, [selectedDie, gameState.coffee]);

  const handleSlotClick = useCallback(async (slotId: string) => {
    if (selectedDie === null || adjusted === null) return;
    try {
      await placeDie(gameId, slotId, adjusted, adjusted !== selectedDie ? selectedDie : undefined);
      sounds.diePlaced();
      setSelectedDie(null);
      setAdjusted(null);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Placement failed', 'error');
    }
  }, [gameId, selectedDie, adjusted, addToast]);

  const toggleReroll = useCallback((index: number) => {
    setRerollSel((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }, []);

  const confirmReroll = useCallback(async () => {
    try {
      await rerollApi(gameId, rerollSel);
      sounds.dieSelected();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Reroll failed', 'error');
    } finally {
      setRerollMode(false);
      setRerollSel([]);
    }
  }, [gameId, rerollSel, addToast]);

  const handleSendMessage = useCallback((text: string) => {
    sendMessage(gameId, role, text).catch(() => {});
  }, [gameId, role]);

  const canReroll = (gameState.reroll > 0 || gameState.pendingReroll === role) && myDice.length > 0;

  const g = {
    axis: slots.filter((s) => s.group === 'axis'),
    engine: slots.filter((s) => s.group === 'engine'),
    radioPilot: slots.filter((s) => s.id.startsWith('radio_pilot')),
    radioCopilot: slots.filter((s) => s.id.startsWith('radio_copilot')),
    flaps: slots.filter((s) => s.group === 'flaps'),
    gear: slots.filter((s) => s.group === 'gear'),
    brakes: slots.filter((s) => s.group === 'brakes'),
    concentration: slots.filter((s) => s.group === 'concentration'),
  };

  const slotProps = {
    gameState,
    myRole: role,
    selectedDie: adjusted,
    onSlotClick: handleSlotClick,
    cfg,
  };

  return (
    <div className="min-h-svh bg-cockpit-bg flex flex-col font-mono select-none">
      {/* ── Header ── */}
      <header className="border-b border-cockpit-border bg-cockpit-surface/60 px-3 py-2 flex items-center gap-2 sm:gap-4 text-xs flex-wrap">
        <span className="text-cockpit-accent font-bold tracking-widest">✈ SKY TEAM</span>
        <span className="text-gray-600">|</span>
        <span className="uppercase tracking-widest text-gray-500">{cfg.airport.name}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="uppercase tracking-widest text-gray-500">☕ <span className={gameState.coffee > 0 ? 'text-amber-400' : 'text-gray-700'}>{gameState.coffee}</span></span>
          <span className="uppercase tracking-widest text-gray-500">⟳ <span className={gameState.reroll > 0 ? 'text-amber-400' : 'text-gray-700'}>{gameState.reroll}</span></span>
          <span className={role === 'pilot' ? 'text-blue-400 font-bold' : 'text-orange-400 font-bold'}>
            {role === 'pilot' ? 'PILOT' : 'CO-PILOT'}
          </span>
          <ChatPanel messages={messages} myRole={role} aiThinking={aiThinking} hasAi={hasAiPlayer} onSend={handleSendMessage} />
          <button onClick={onLeave} className="text-gray-600 hover:text-gray-400 border border-gray-700 rounded px-2 py-0.5 uppercase tracking-widest">Leave</button>
        </div>
      </header>

      {/* ── Control panel (the board) ── */}
      <main className="flex-1 overflow-auto p-2 sm:p-4">
        <div
          className="mx-auto max-w-5xl rounded-2xl border border-zinc-700/80 p-3 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.6)_inset]"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, rgba(39,39,42,0.9), rgba(9,9,11,0.95)), repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 6px)',
          }}
        >
          {/* Top: the two cockpit screens */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3">
            <Screen title="Current Position">
              <ApproachTrack length={cfg.airport.approachTrackLength} position={gameState.approachPos} traffic={gameState.traffic} />
            </Screen>
            <Screen title="Altitude" accent="blue">
              <div className="flex items-baseline gap-2 justify-center py-1">
                <span className="text-3xl font-bold text-blue-300 tabular-nums">{altitudeFt}</span>
                <span className="text-xs text-gray-500 uppercase">ft</span>
              </div>
              <div className="text-center text-[10px] uppercase tracking-widest text-gray-500">
                Round {gameState.round}/{cfg.rules.totalRounds} · {gameState.firstPlayer === 'pilot' ? 'PLT first' : 'CPL first'}
              </div>
            </Screen>
          </div>

          {/* Middle: pilot wing | center stack | co-pilot wing */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
            {/* Pilot (blue) wing */}
            <div className="space-y-3 order-2 lg:order-1">
              <SlotGroup label="◀ Radio · Pilot" slots={g.radioPilot} {...slotProps} />
              <SlotGroup label="Landing Gear" slots={g.gear} {...slotProps} variant="switch" />
              <SlotGroup label={`Brakes${isFinalRound ? ' · LANDING' : ''}`} slots={g.brakes} {...slotProps} variant="switch" />
            </div>

            {/* Center column */}
            <div className="space-y-3 order-1 lg:order-2">
              {/* Axis dial + the two axis dice */}
              <div className="rounded-xl border border-zinc-600/60 bg-zinc-900/50 p-3">
                <div className="mb-1 text-center text-[9px] font-mono uppercase tracking-[0.2em] text-gray-400">Axis ✦</div>
                <AxisDial tilt={gameState.axisTilt} spinLimit={cfg.rules.axisSpinLimit} />
                <div className="mt-1 flex items-center justify-center gap-6">
                  <AxisDie slotId="axis_pilot" {...slotProps} />
                  <AxisDie slotId="axis_copilot" {...slotProps} />
                </div>
              </div>

              {/* Engines + speed gauge */}
              <div className="rounded-xl border border-zinc-600/60 bg-zinc-900/50 p-3 space-y-2">
                <div className="text-center text-[9px] font-mono uppercase tracking-[0.2em] text-gray-400">Engines ✦</div>
                <div className="flex items-center justify-center gap-6">
                  <AxisDie slotId="engine_pilot" {...slotProps} />
                  <AxisDie slotId="engine_copilot" {...slotProps} />
                </div>
                <div className="flex justify-center pt-1">
                  <SpeedGauge
                    aeroBlue={gameState.aeroBlue}
                    aeroOrange={gameState.aeroOrange}
                    speed={gameState.speed}
                    finalRound={isFinalRound}
                    brakeThreshold={brakeThreshold(gameState, cfg)}
                  />
                </div>
              </div>

              {/* Concentration */}
              <SlotGroup label={`Concentration → ☕ ${gameState.coffee}/${cfg.rules.coffeeMax}`} slots={g.concentration} {...slotProps} ownerHint="any" />
            </div>

            {/* Co-pilot (orange) wing */}
            <div className="space-y-3 order-3">
              <SlotGroup label="Radio · Co-pilot ▶" slots={g.radioCopilot} {...slotProps} />
              <SlotGroup label={`Flaps (${gameState.flapsLevel}/${cfg.rules.flaps.length})`} slots={g.flaps} {...slotProps} variant="switch" vertical />
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer / dice tray ── */}
      <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-4 py-3 space-y-2">
        {gameState.phase === 'PLACING' && (
          <>
            <div className="flex items-center gap-2">
              <span className={['text-[10px] font-mono uppercase tracking-widest', opponentRole === 'pilot' ? 'text-blue-500' : 'text-orange-500'].join(' ')}>
                {opponentRole === 'pilot' ? 'Pilot' : 'Co-pilot'} (behind screen)
              </span>
              {Array.from({ length: opponentDiceCount }).map((_, i) => (
                <DieToken key={i} value={0} role={opponentRole} faceDown size="md" />
              ))}
              {opponentDiceCount === 0 && <span className="text-xs text-gray-700">All placed</span>}
            </div>

            {rerollMode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-amber-400">Select dice to reroll</span>
                  {myDice.map((v, i) => (
                    <DieToken key={i} value={v} role={role} selected={rerollSel.includes(i)} onClick={() => toggleReroll(i)} size="lg" />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={confirmReroll} className="text-[10px] uppercase tracking-widest border border-amber-600 text-amber-400 hover:bg-amber-700/20 rounded px-3 py-1">
                    Reroll {rerollSel.length} {gameState.pendingReroll === role ? '(free)' : '(1 token)'}
                  </button>
                  <button onClick={() => { setRerollMode(false); setRerollSel([]); }} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-gray-300 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <DiceHand dice={myDice} selectedDie={selectedDie} onSelect={selectDie} isMyTurn={isMyTurn} role={role} />
                <div className="flex items-center gap-3">
                  {selectedDie !== null && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => adjust(-1)} disabled={gameState.coffee === 0} className="w-6 h-6 rounded border border-amber-700 text-amber-500 disabled:opacity-30 hover:bg-amber-700/20">−</button>
                      <div className="flex flex-col items-center">
                        <DieToken value={adjusted ?? selectedDie} role={role} size="md" />
                        {coffeeCost > 0 && <span className="text-[9px] text-amber-500">☕×{coffeeCost}</span>}
                      </div>
                      <button onClick={() => adjust(1)} disabled={gameState.coffee === 0} className="w-6 h-6 rounded border border-amber-700 text-amber-500 disabled:opacity-30 hover:bg-amber-700/20">+</button>
                    </div>
                  )}
                  {canReroll && (
                    <button onClick={() => setRerollMode(true)} className="text-[10px] uppercase tracking-widest border border-amber-700 text-amber-500 hover:bg-amber-700/20 rounded px-2 py-1">
                      ⟳ Reroll{gameState.pendingReroll === role ? ' (free)' : ''}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="text-[10px] uppercase tracking-widest text-gray-600 h-3">
              {!isMyTurn && `Waiting for ${opponentRole}…`}
              {isMyTurn && selectedDie !== null && 'Adjust with ☕ if needed, then click a glowing space'}
              {isMyTurn && selectedDie === null && 'Select a die to place'}
            </div>
          </>
        )}
      </footer>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/** A framed cockpit "screen" (inset dark window with a bezel). */
function Screen({ title, accent = 'amber', children }: { title: string; accent?: 'amber' | 'blue'; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-black/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] p-2">
      <div className={['text-[8px] font-mono uppercase tracking-[0.2em] mb-1', accent === 'blue' ? 'text-blue-500/70' : 'text-amber-600/70'].join(' ')}>{title}</div>
      {children}
    </div>
  );
}

/** A single big circular die slot (used for the mandatory Axis & Engine spaces). */
function AxisDie({ slotId, gameState, myRole, selectedDie, onSlotClick, cfg }: {
  slotId: string;
  gameState: GameState;
  myRole: Role;
  selectedDie: number | null;
  onSlotClick: (slotId: string) => void;
  cfg: typeof DEFAULT_CONFIG;
}) {
  const isPilot = slotId.endsWith('pilot') && !slotId.endsWith('copilot');
  const placed = gameState.placed.find((p) => p.slotId === slotId);
  const isValid =
    selectedDie !== null && !placed && gameState.phase === 'PLACING' &&
    validatePlacement(gameState, { role: myRole, slotId, dieValue: selectedDie }, cfg).ok;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={['text-[8px] font-mono uppercase tracking-wider', isPilot ? 'text-blue-400/80' : 'text-orange-400/80'].join(' ')}>
        {isPilot ? 'Pilot' : 'Co-pilot'}
      </span>
      {placed ? (
        <DieToken value={placed.value} role={placed.role} size="md" />
      ) : (
        <button
          onClick={isValid ? () => onSlotClick(slotId) : undefined}
          disabled={!isValid}
          className={[
            'w-12 h-12 rounded-full border-2 transition-all duration-150',
            isPilot ? 'border-blue-800/50 bg-blue-950/40' : 'border-orange-800/50 bg-orange-950/40',
            isValid
              ? (isPilot
                ? 'border-blue-400 bg-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.6)] cursor-pointer hover:scale-105'
                : 'border-orange-400 bg-orange-500/15 shadow-[0_0_12px_rgba(249,115,22,0.6)] cursor-pointer hover:scale-105')
              : selectedDie !== null ? 'opacity-25' : '',
          ].join(' ')}
          aria-label={slotId}
        />
      )}
    </div>
  );
}
