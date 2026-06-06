import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { joinRoom } from '@/lib/rooms';
import { Lobby } from '@/components/lobby/Lobby';
import { RoomScreen } from '@/components/room/RoomScreen';

function getRoomCodeFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('room') ?? undefined;
}

export default function App() {
  const { session, setSession } = useSession();
  const urlCode = getRoomCodeFromUrl();
  const [autoJoining, setAutoJoining] = useState(false);

  // Auto-join when opened via invite link
  useEffect(() => {
    if (!urlCode || session) return;
    setAutoJoining(true);
    joinRoom(urlCode)
      .then(setSession)
      .catch(() => {}) // fall through to lobby with pre-filled code on error
      .finally(() => setAutoJoining(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (session) {
    return <RoomScreen session={session} onLeave={() => setSession(null)} />;
  }

  if (autoJoining) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-gray-400 text-sm">Joining room…</p>
      </div>
    );
  }

  return <Lobby onSession={setSession} initialCode={urlCode} />;
}
