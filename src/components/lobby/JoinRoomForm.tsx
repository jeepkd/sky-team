import { useState } from 'react';
import { joinRoom } from '@/lib/rooms';
import type { Session } from '@/types';
import { Button } from '@/components/ui/Button';

interface Props {
  onSession: (s: Session) => void;
  initialCode?: string;
}

export function JoinRoomForm({ onSession, initialCode = '' }: Props) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const session = await joinRoom(code);
      onSession(session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className="space-y-3">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Room code (e.g. AB2C)"
        maxLength={4}
        className="w-full rounded-lg border border-cockpit-border bg-black/30 px-3 py-2 font-mono text-sm uppercase tracking-widest text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cockpit-accent"
      />
      <Button type="submit" variant="secondary" disabled={loading || !code.trim()} className="w-full">
        {loading ? 'Joining…' : 'Join room'}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
