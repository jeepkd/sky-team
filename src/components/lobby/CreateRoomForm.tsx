import { useState } from 'react';
import { createRoom } from '@/lib/api';
import type { Session } from '@/types';
import type { Role } from '@/lib/game/types';
import { Button } from '@/components/ui/Button';

interface Props {
  onSession: (s: Session) => void;
}

const ROLE_INFO: Record<Role, { label: string; description: string; duties: string[] }> = {
  pilot: {
    label: 'Pilot',
    description: 'Controls the flight stick and left engine.',
    duties: ['Axis (left)', 'Engine left (1–3)', 'Gear left (≥3)', 'Flaps & Radio'],
  },
  copilot: {
    label: 'Co-pilot',
    description: 'Manages throttle and right-side systems.',
    duties: ['Axis (right)', 'Engine right (4–6)', 'Gear right (≥3)', 'Flaps & Radio'],
  },
};

export function CreateRoomForm({ onSession }: Props) {
  const [role, setRole] = useState<Role>('pilot');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const session = await createRoom(role);
      onSession(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Role picker */}
      <div className="grid grid-cols-2 gap-2">
        {(['pilot', 'copilot'] as Role[]).map((r) => {
          const info = ROLE_INFO[r];
          const selected = role === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={[
                'rounded-lg border p-3 text-left transition-all duration-150',
                selected
                  ? 'border-cockpit-accent bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                  : 'border-cockpit-border bg-cockpit-surface/40 hover:border-gray-600',
              ].join(' ')}
            >
              <div className={['text-xs font-mono font-bold uppercase tracking-widest mb-1', selected ? 'text-amber-400' : 'text-gray-400'].join(' ')}>
                {info.label}
              </div>
              <div className="text-[10px] text-gray-500 leading-relaxed">
                {info.description}
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {info.duties.map((d) => (
                  <li key={d} className={['text-[9px] font-mono', selected ? 'text-amber-600' : 'text-gray-700'].join(' ')}>
                    · {d}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading ? 'Creating…' : `Create room as ${ROLE_INFO[role].label}`}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
