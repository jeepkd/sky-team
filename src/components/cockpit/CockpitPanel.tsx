import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@/types';
import type { GameState, Role } from '@/lib/game/types';
import { DEFAULT_CONFIG } from '@/lib/game/config';
import { buildSlots } from '@/lib/game/slots';
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
import { AxisIndicator } from './AxisIndicator';

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

  // Placement selection: the original die from hand + the value after coffee adjustment.
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const [adjusted, setAdjusted] = useState<number | null>(null);
  // Reroll: toggle mode + selected dice indices.
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

  // Auto-roll at start of each round (+ nudge the AI).
  useEffect(() => {
    if (gameState.phase === 'LOBBY' || gameState.phase === 'ENDED') return;
    rollDice(gameId).catch(() => {});
    if (hasAiPlayer) {
      setAiThinking(true);
      triggerAiTick(gameId).catch(() => {}).finally(() => setAiThinking(false));
    }
  }, [gameId, gameState.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger the AI when it's their turn.
  useEffect(() => {
    if (!hasAiPlayer || gameState.phase !== 'PLACING' || gameState.turn === role) return;
    setAiThinking(true);
    const t = setTimeout(() => {
      triggerAiTick(gameId).catch(() => {}).finally(() => setAiThinking(false));
    }, 600);
    return () => clearTimeout(t);
  }, [gameId, hasAiPlayer, gameState.phase, gameState.turn, role]);

  // End-game sound cues.
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

  // Slot groups.
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
        <span className="uppercase tracking-widest text-gray-500">
          Round <span className="text-amber-400 font-bold">{gameState.round}</span>/{cfg.rules.totalRounds}
        </span>
        <span className="uppercase tracking-widest text-gray-500">
          ☕ <span className={gameState.coffee > 0 ? 'text-amber-400' : 'text-gray-700'}>{gameState.coffee}</span>
        </span>
        <span className="uppercase tracking-widest text-gray-500">
          ⟳ <span className={gameState.reroll > 0 ? 'text-amber-400' : 'text-gray-700'}>{gameState.reroll}</span>
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className={role === 'pilot' ? 'text-blue-500' : 'text-orange-500'}>
            {role === 'pilot' ? 'PILOT' : 'CO-PILOT'}
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
          length={cfg.airport.approachTrackLength}
          position={gameState.approachPos}
          traffic={gameState.traffic}
        />
      </div>

      {/* ── Instrument panel ── */}
      <main className="flex-1 overflow-auto p-2 sm:p-3 space-y-2 sm:space-y-3">
        {/* Instruments: axis + speed gauge */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-lg border border-gray-700/50 bg-cockpit-surface/40 p-3 flex justify-center">
            <AxisIndicator tilt={gameState.axisTilt} spinLimit={cfg.rules.axisSpinLimit} />
          </div>
          <div className="rounded-lg border border-gray-700/50 bg-cockpit-surface/40 p-3 flex justify-center">
            <SpeedGauge
              aeroBlue={gameState.aeroBlue}
              aeroOrange={gameState.aeroOrange}
              speed={gameState.speed}
              finalRound={isFinalRound}
              brakeThreshold={brakeThreshold(gameState, cfg)}
            />
          </div>
        </div>

        {/* Mandatory: axis + engines */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <SlotGroup label="Axis ✦" slots={g.axis} {...slotProps} />
          <SlotGroup label="Engines ✦" slots={g.engine} {...slotProps} />
        </div>

        {/* Pilot (blue) | Co-pilot (orange) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-blue-600 px-1">— Pilot —</div>
            <SlotGroup label="Landing Gear" slots={g.gear} {...slotProps} />
            <SlotGroup label="Radio" slots={g.radioPilot} {...slotProps} />
            <SlotGroup
              label={`Brakes${isFinalRound ? '' : ' (landing round)'}`}
              slots={g.brakes}
              {...slotProps}
            />
          </div>
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-orange-600 px-1">— Co-pilot —</div>
            <SlotGroup label={`Flaps (${gameState.flapsLevel}/${cfg.rules.flaps.length})`} slots={g.flaps} {...slotProps} />
            <SlotGroup label="Radio" slots={g.radioCopilot} {...slotProps} />
          </div>
        </div>

        {/* Concentration → coffee */}
        <SlotGroup
          label={`Concentration → ☕ ${gameState.coffee}/${cfg.rules.coffeeMax}`}
          slots={g.concentration}
          {...slotProps}
          ownerHint="any"
        />
      </main>

      {/* ── Footer / dice tray ── */}
      <footer className="border-t border-cockpit-border bg-cockpit-surface/60 px-4 py-3 space-y-2">
        {gameState.phase === 'PLACING' && (
          <>
            {/* Opponent dice (face down) */}
            <div className="flex items-center gap-2">
              <span className={['text-[10px] font-mono uppercase tracking-widest', opponentRole === 'pilot' ? 'text-blue-600' : 'text-orange-600'].join(' ')}>
                {opponentRole === 'pilot' ? 'Pilot' : 'Co-pilot'}
              </span>
              {Array.from({ length: opponentDiceCount }).map((_, i) => (
                <DieToken key={i} value={0} role={opponentRole} faceDown size="lg" />
              ))}
              {opponentDiceCount === 0 && <span className="text-xs text-gray-700">All placed</span>}
            </div>

            {rerollMode ? (
              /* Reroll selection row */
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-amber-400">Select dice to reroll</span>
                  {myDice.map((v, i) => (
                    <DieToken
                      key={i}
                      value={v}
                      role={role}
                      selected={rerollSel.includes(i)}
                      onClick={() => toggleReroll(i)}
                      size="lg"
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={confirmReroll} className="text-[10px] uppercase tracking-widest border border-amber-600 text-amber-400 hover:bg-amber-700/20 rounded px-3 py-1">
                    Reroll {rerollSel.length} {gameState.pendingReroll === role ? '(free)' : '(1 token)'}
                  </button>
                  <button onClick={() => { setRerollMode(false); setRerollSel([]); }} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-gray-300 px-2">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <DiceHand dice={myDice} selectedDie={selectedDie} onSelect={selectDie} isMyTurn={isMyTurn} role={role} />

                <div className="flex items-center gap-3">
                  {/* Coffee adjuster */}
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
                  {/* Reroll button */}
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
