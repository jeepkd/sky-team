import { useState } from 'react';
import type { Session } from '@/types';

const STORAGE_KEY = 'sky-team:session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function useSession(): {
  session: Session | null;
  setSession: (s: Session | null) => void;
} {
  const [session, setSessionState] = useState<Session | null>(loadSession);

  function setSession(s: Session | null) {
    if (s === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
    setSessionState(s);
  }

  return { session, setSession };
}
