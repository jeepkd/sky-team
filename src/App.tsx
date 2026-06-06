import { useEffect, useState } from 'react';
import { supabase, getClientId } from './lib/supabase';

type ConnState =
  | { status: 'checking' }
  | { status: 'ok'; roomCount: number }
  | { status: 'error'; message: string };

/**
 * Phase 0 (setup gate): prove the React app boots, env vars are wired,
 * and the browser can reach Supabase. We query the `rooms` table — once
 * the schema migration has run this returns a count (0 is fine); before
 * that it surfaces a clear error so setup problems are obvious.
 */
export default function App() {
  const [conn, setConn] = useState<ConnState>({ status: 'checking' });
  const clientId = getClientId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });

      if (cancelled) return;
      if (error) {
        setConn({ status: 'error', message: error.message });
      } else {
        setConn({ status: 'ok', roomCount: count ?? 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-cockpit-border bg-cockpit-surface p-8">
        <h1 className="mb-1 text-2xl font-bold text-cockpit-accent">✈ Sky Team Digital</h1>
        <p className="mb-6 text-sm text-gray-400">Setup verification</p>

        <Row label="React app" ok detail="rendered" />
        <Row label="Client identity" ok detail={clientId.slice(0, 8) + '…'} />
        <Row
          label="Supabase connection"
          ok={conn.status === 'ok'}
          pending={conn.status === 'checking'}
          detail={
            conn.status === 'checking'
              ? 'checking…'
              : conn.status === 'ok'
                ? `connected — ${conn.roomCount} room(s)`
                : conn.message
          }
        />

        {conn.status === 'error' && (
          <p className="mt-4 text-xs leading-relaxed text-amber-400">
            If this says the <code>rooms</code> table is missing, run the SQL in{' '}
            <code>supabase/migrations/001_initial_schema.sql</code> in the Supabase Studio SQL
            editor.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  ok,
  pending,
  detail,
}: {
  label: string;
  ok?: boolean;
  pending?: boolean;
  detail: string;
}) {
  const dot = pending ? '🟡' : ok ? '🟢' : '🔴';
  return (
    <div className="flex items-center justify-between border-b border-cockpit-border py-2 last:border-0">
      <span className="text-sm">
        {dot} {label}
      </span>
      <span className="font-mono text-xs text-gray-400">{detail}</span>
    </div>
  );
}
