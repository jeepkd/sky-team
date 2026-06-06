import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useGameState } from '@/hooks/useGameState';
import { joinRoom } from '@/lib/api';
import { fetchPlayers } from '@/lib/rooms';
import { Lobby } from '@/components/lobby/Lobby';
import { RoomScreen } from '@/components/room/RoomScreen';
import { CockpitPanel } from '@/components/cockpit/CockpitPanel';
import { EndScreen } from '@/components/room/EndScreen';

function getRoomCodeFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('room') ?? undefined;
}

export default function App() {
  const { session, setSession } = useSession();
  const urlCode = getRoomCodeFromUrl();
  const [autoJoining, setAutoJoining] = useState(false);
  // null = not yet loaded, false = no AI, true = has AI
  const [hasAiPlayer, setHasAiPlayer] = useState<boolean>(false);

  const gameState = useGameState(session?.gameId ?? null, session?.role ?? null);
  const myDice = gameState?.remaining[session?.role ?? 'pilot'] ?? [];

  // Auto-join from ?room= URL param when no session exists
  useEffect(() => {
    if (!urlCode || session) return;
    setAutoJoining(true);
    joinRoom(urlCode)
      .then((r) => setSession({ roomCode: urlCode, gameId: r.gameId, role: r.role }))
      .catch(() => {})
      .finally(() => setAutoJoining(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect AI player whenever we have a game session
  useEffect(() => {
    if (!session?.gameId) { setHasAiPlayer(false); return; }
    fetchPlayers(session.gameId)
      .then((players) => {
        setHasAiPlayer(players.some((p) => (p as typeof p & { is_ai?: boolean }).is_ai));
      })
      .catch(() => {});
  }, [session?.gameId]);

  // P6.1: Validate persisted session against live game state.
  // If the game has been cleaned up or ended and cleared, drop the stale session.
  useEffect(() => {
    if (!session || !gameState) return;
    // If the game status is no longer active and not ended (i.e. cleaned up), clear session
    if (gameState.status !== 'active' && gameState.phase !== 'ENDED') {
      setSession(null);
    }
  }, [gameState?.status, gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (autoJoining) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-gray-400 text-sm font-mono">Joining room…</p>
      </div>
    );
  }

  if (!session) {
    return <Lobby onSession={setSession} initialCode={urlCode} />;
  }

  // Show loading state while game state is being fetched (prevents flash to RoomScreen on reconnect)
  if (!gameState) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-gray-400 text-sm font-mono animate-pulse">Connecting…</p>
      </div>
    );
  }

  if (gameState.phase === 'ENDED') {
    return (
      <EndScreen
        gameId={session.gameId}
        gameState={gameState}
        onLeave={() => setSession(null)}
      />
    );
  }

  const isPlaying = gameState.phase !== 'LOBBY' && gameState.status === 'active';

  if (isPlaying) {
    return (
      <CockpitPanel
        session={session}
        gameState={gameState}
        myDice={myDice}
        hasAiPlayer={hasAiPlayer}
        onLeave={() => setSession(null)}
      />
    );
  }

  return <RoomScreen session={session} onLeave={() => setSession(null)} />;
}
