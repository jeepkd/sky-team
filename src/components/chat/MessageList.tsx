import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/hooks/useChat';

interface Props {
  messages: ChatMessage[];
  myRole: string;
  aiThinking: boolean;
}

const ROLE_LABELS: Record<string, string> = { pilot: 'PLT', copilot: 'CPL', ai: 'AI' };
const ROLE_COLORS: Record<string, string> = {
  pilot: 'text-sky-400',
  copilot: 'text-emerald-400',
  ai: 'text-amber-400',
};

export function MessageList({ messages, myRole, aiThinking }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-[11px] font-mono">
      {messages.length === 0 && (
        <p className="text-gray-700 text-center pt-4">No messages yet.</p>
      )}
      {messages.map((m) => (
        <div key={m.id} className={['flex gap-2', m.role === myRole ? 'justify-end' : ''].join(' ')}>
          {m.role !== myRole && (
            <span className={['font-bold shrink-0', ROLE_COLORS[m.role] ?? 'text-gray-500'].join(' ')}>
              {ROLE_LABELS[m.role] ?? m.role}
            </span>
          )}
          <span
            className={[
              'rounded px-2 py-0.5 leading-relaxed',
              m.role === 'ai'
                ? 'bg-amber-950/60 text-amber-300'
                : m.role === myRole
                  ? 'bg-cockpit-surface text-gray-200'
                  : 'bg-gray-900 text-gray-400',
            ].join(' ')}
          >
            {m.content}
          </span>
          {m.role === myRole && (
            <span className={['font-bold shrink-0', ROLE_COLORS[m.role] ?? 'text-gray-500'].join(' ')}>
              {ROLE_LABELS[m.role] ?? m.role}
            </span>
          )}
        </div>
      ))}
      {aiThinking && (
        <div className="flex gap-2">
          <span className="font-bold text-amber-400 shrink-0">AI</span>
          <span className="rounded px-2 py-0.5 bg-amber-950/60 text-amber-600 animate-pulse">thinking…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
