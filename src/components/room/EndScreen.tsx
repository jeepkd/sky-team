import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { GameState } from '@/lib/game/types';
import { Button } from '@/components/ui/Button';

interface Props {
  gameId: string;
  gameState: GameState;
  onLeave: () => void;
}

interface GameEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const EVENT_LABELS: Record<string, (p: Record<string, unknown>) => string> = {
  axis_resolved: (p) => `Axis settled at ${(p.tilt as number) > 0 ? '+' : ''}${p.tilt}`,
  engines_resolved: (p) => `Engine output — speed ${p.speed}`,
  traffic_cleared: (p) => `Radio cleared traffic at position ${p.position}`,
  flaps_deployed: (p) => `Flaps extended to level ${p.flaps_level ?? p.level}`,
  gear_deployed: (p) => `${String(p.side).charAt(0).toUpperCase() + String(p.side).slice(1)} gear deployed`,
  brakes_applied: (p) => `Brakes applied — force ${p.force}`,
  approach_advanced: (p) => `Approach advanced to position ${p.position} (speed ${p.speed})`,
  round_started: (p) => `Round ${p.round} begins`,
  round_revealed: (p) => `Round ${p.round} revealed`,
  die_placed: (p) => `${p.role} placed a die in ${p.slotId}`,
  game_ended: (p) => `Game ended — ${p.result}`,
};

const STATUS_CONFIG = {
  victory: { icon: '✈', label: 'LANDED SAFELY', colour: 'text-green-400', border: 'border-green-700' },
  crashed: { icon: '💥', label: 'AIRCRAFT LOST', colour: 'text-red-400', border: 'border-red-800' },
  failed: { icon: '⚠', label: 'APPROACH FAILED', colour: 'text-orange-400', border: 'border-orange-800' },
  active: { icon: '…', label: 'IN PROGRESS', colour: 'text-amber-400', border: 'border-cockpit-border' },
};

export function EndScreen({ gameId, gameState, onLeave }: Props) {
  const [events, setEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    supabase
      .from('game_events')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setEvents((data as GameEvent[]) ?? []));
  }, [gameId]);

  const cfg = STATUS_CONFIG[gameState.status] ?? STATUS_CONFIG.failed;

  const notable = events.filter((e) =>
    ['axis_resolved', 'engines_resolved', 'approach_advanced', 'flaps_deployed',
     'gear_deployed', 'traffic_cleared', 'game_ended'].includes(e.event_type),
  );

  return (
    <div className="min-h-screen bg-cockpit-bg flex flex-col items-center justify-center p-8 font-mono">
      <div className={`w-full max-w-md rounded-2xl border ${cfg.border} bg-cockpit-surface/80 p-8 space-y-6`}>
        {/* Result header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">{cfg.icon}</div>
          <h1 className={`text-2xl font-bold tracking-widest uppercase ${cfg.colour}`}>
            {cfg.label}
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Round {gameState.round - 1} · Approach pos {gameState.approachPos}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Axis', value: gameState.axisTilt > 0 ? `+${gameState.axisTilt}` : String(gameState.axisTilt) },
            { label: 'Flaps', value: `${gameState.flapsLevel}/4` },
            { label: 'Gear', value: gameState.gearDeployed.every(Boolean) ? 'DOWN' : gameState.gearDeployed.some(Boolean) ? 'PARTIAL' : 'UP' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border border-cockpit-border bg-cockpit-bg/60 p-2">
              <div className="text-[10px] text-gray-600 uppercase tracking-widest">{label}</div>
              <div className="text-sm font-bold text-gray-300 mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Event log */}
        {notable.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Flight log</div>
            <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
              {notable.map((e) => (
                <div key={e.id} className="flex gap-2 text-xs">
                  <span className="text-gray-700 shrink-0">›</span>
                  <span className="text-gray-400">
                    {EVENT_LABELS[e.event_type]?.(e.payload) ?? e.event_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={onLeave} className="w-full">
          Return to lobby
        </Button>
      </div>
    </div>
  );
}
