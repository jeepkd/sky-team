import { useState } from 'react';
import { createRoom } from '@/lib/api';
import type { Session } from '@/types';
import type { Role } from '@/lib/game/types';
import { DESTINATIONS } from '@/lib/game/config';
import { Button } from '@/components/ui/Button';

const DIFFICULTY_COLOR: Record<string, string> = {
  Intro: 'text-green-400',
  Easy: 'text-green-400',
  Medium: 'text-amber-400',
  Hard: 'text-red-400',
};

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
  const [destination, setDestination] = useState<string>(DESTINATIONS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const session = await createRoom(role, destination);
      onSession(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Destination picker */}
      <div>
        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-gray-500">Destination</div>
        <div className="grid grid-cols-2 gap-2">
          {DESTINATIONS.map((d) => {
            const selected = destination === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDestination(d.id)}
                className={[
                  'rounded-lg border p-2 text-left transition-all duration-150',
                  selected
                    ? 'border-cockpit-accent bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'border-cockpit-border bg-cockpit-surface/40 hover:border-gray-600',
                ].join(' ')}
              >
                <div className="text-[11px] font-mono font-bold text-gray-300 leading-tight">{d.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-mono">
                  <span className={DIFFICULTY_COLOR[d.difficulty] ?? 'text-gray-500'}>{d.difficulty}</span>
                  <span className="text-gray-600">· {d.trafficSlots.length} ✈ traffic</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

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
