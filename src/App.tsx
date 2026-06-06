import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useGameState } from '@/hooks/useGameState';
import { joinRoom } from '@/lib/api';
import { Lobby } from '@/components/lobby/Lobby';
import { RoomScreen } from '@/components/room/RoomScreen';
import { CockpitPanel } from '@/components/cockpit/CockpitPanel';

function getRoomCodeFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('room') ?? undefined;
}

export default function App() {
  const { session, setSession } = useSession();
  const urlCode = getRoomCodeFromUrl();
  const [autoJoining, setAutoJoining] = useState(false);

  const gameState = useGameState(session?.gameId ?? null);
  const myDice = gameState?.remaining[session?.role ?? 'pilot'] ?? [];

  useEffect(() => {
    if (!urlCode || session) return;
    setAutoJoining(true);
    joinRoom(urlCode)
      .then((r) => setSession({ roomCode: urlCode, gameId: r.gameId, role: r.role as 'pilot' | 'copilot' }))
      .catch(() => {})
      .finally(() => setAutoJoining(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Show cockpit once the game is in an active playing phase
  const isPlaying =
    gameState &&
    gameState.phase !== 'LOBBY' &&
    gameState.status === 'active';

  const isEnded = gameState?.phase === 'ENDED';

  if (isPlaying || isEnded) {
    return (
      <CockpitPanel
        session={session}
        gameState={gameState}
        myDice={myDice}
        onLeave={() => setSession(null)}
      />
    );
  }

  return <RoomScreen session={session} onLeave={() => setSession(null)} />;
}
