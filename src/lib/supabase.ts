import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.local.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url, anonKey);

/**
 * Stable per-browser identity for Phase 1 — no auth required yet.
 * We generate a UUID once and persist it in localStorage so a player
 * keeps the same identity across reloads. This is what later becomes
 * the reconnection anchor; we can swap it for Supabase anonymous auth
 * in a later phase without changing call sites.
 */
export function getClientId(): string {
  const KEY = 'sky-team:client-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
