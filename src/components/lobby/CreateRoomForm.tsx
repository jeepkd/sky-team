import { useState } from 'react';
import { createRoom } from '@/lib/api';
import type { Session } from '@/types';
import { Button } from '@/components/ui/Button';

interface Props {
  onSession: (s: Session) => void;
}

export function CreateRoomForm({ onSession }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const session = await createRoom();
      onSession(session);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : String(e),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading ? 'Creating…' : 'Create room'}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
