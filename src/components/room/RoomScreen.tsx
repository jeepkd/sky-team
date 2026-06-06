import { useEffect, useState } from 'react';
import { supabase, getClientId, purgeChannel } from '@/lib/supabase';
import { fetchPlayers } from '@/lib/rooms';
import { usePresence } from '@/hooks/usePresence';
import { rollDice, addAiPlayer } from '@/lib/api';
import { ROLES } from '@/types';
import type { Player, Session } from '@/types';
import { SeatCard } from './SeatCard';
import { Button } from '@/components/ui/Button';

interface Props {
  session: Session;
  onLeave: () => void;
}

export function RoomScreen({ session, onLeave }: Props) {
  const { roomCode, gameId, role } = session;
  const clientId = getClientId();
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const { online } = usePresence(gameId, role, clientId);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  // Initial load
  useEffect(() => {
    let active = true;
    fetchPlayers(gameId).then((p) => { if (active) setPlayers(p); });
    return () => { active = false; };
  }, [gameId]);

  // Keep seats in sync via realtime
  useEffect(() => {
    purgeChannel(`room-players:${gameId}`);

    const channel = supabase
      .channel(`room-players:${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        () => { fetchPlayers(gameId).then(setPlayers); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const hasAiPlayer = players.some((p) => (p as Player & { is_ai?: boolean }).is_ai);
  const bothSeated = ROLES.every((r) => players.some((p) => p.role === r));
  const bothPresent = bothSeated && (hasAiPlayer || ROLES.every((r) => online[r]));

  async function addAi() {
    try {
      await addAiPlayer(gameId);
    } catch (e) {
      console.error('Failed to add AI:', e);
    }
  }

  async function startGame() {
    setStarting(true);
    try {
      await rollDice(gameId);
    } finally {
      setStarting(false);
    }
  }

  function copyInvite() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cockpit-accent">✈ Sky Team</h1>
          <p className="mt-1 text-sm text-gray-400">Waiting for both players…</p>
        </div>

        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-4 text-center">
          <p className="mb-1 text-xs uppercase tracking-wider text-gray-500">Room code</p>
          <p className="font-mono text-4xl font-bold tracking-widest text-cockpit-accent">
            {roomCode}
          </p>
          <button
            onClick={copyInvite}
            className="mt-2 text-xs text-gray-500 underline hover:text-gray-300"
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>

        <div className="space-y-3">
          {ROLES.map((r) => (
            <SeatCard
              key={r}
              role={r}
              player={players.find((p) => p.role === r) ?? null}
              isYou={r === role}
              online={online[r]}
            />
          ))}
        </div>

        {!bothSeated && !hasAiPlayer && (
          <Button
            variant="secondary"
            onClick={addAi}
            className="w-full border-amber-800 text-amber-600 hover:bg-amber-900/20"
          >
            Add AI Co-pilot
          </Button>
        )}

        {bothPresent && (
          <Button
            variant="primary"
            onClick={startGame}
            disabled={starting}
            className="w-full"
          >
            {starting ? 'Starting…' : 'Start Game'}
          </Button>
        )}

        <Button variant="secondary" onClick={onLeave} className="w-full">
          Leave room
        </Button>
      </div>
    </div>
  );
}
