import type { Session } from '@/types';
import { Card } from '@/components/ui/Card';
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';

interface Props {
  onSession: (s: Session) => void;
  initialCode?: string;
}

export function Lobby({ onSession, initialCode }: Props) {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cockpit-accent">✈ Sky Team</h1>
          <p className="mt-1 text-sm text-gray-400">Two-player cooperative landing game</p>
        </div>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            New game
          </h2>
          <CreateRoomForm onSession={onSession} />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Join game
          </h2>
          <JoinRoomForm onSession={onSession} initialCode={initialCode} />
        </Card>
      </div>
    </div>
  );
}
