import { useState } from 'react';
import type { ChatMessage } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface Props {
  messages: ChatMessage[];
  myRole: string;
  aiThinking: boolean;
  hasAi: boolean;
  onSend: (text: string) => void;
  onRequestAi?: () => void;
}

export function ChatPanel({ messages, myRole, aiThinking, hasAi, onSend, onRequestAi }: Props) {
  const [open, setOpen] = useState(false);

  // Unread badge
  const [lastSeen, setLastSeen] = useState(0);
  const unread = messages.length - lastSeen;

  function handleOpen() {
    setOpen(true);
    setLastSeen(messages.length);
  }

  function handleClose() {
    setOpen(false);
    setLastSeen(messages.length);
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="relative flex items-center gap-1.5 border border-gray-700 rounded px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-gray-500 hover:text-gray-300 hover:border-gray-500"
      >
        Chat
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-[8px] flex items-center justify-center text-black font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-72 h-72 flex flex-col bg-cockpit-bg border border-cockpit-border rounded-tl-lg shadow-2xl z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cockpit-border text-[10px] font-mono uppercase tracking-widest">
        <span className="text-gray-500">Comms</span>
        <div className="flex items-center gap-2">
          {hasAi && onRequestAi && (
            <button
              onClick={() => { onRequestAi(); }}
              disabled={aiThinking}
              className="text-amber-700 hover:text-amber-500 disabled:opacity-40"
              title="Ask AI co-pilot"
            >
              Ask AI
            </button>
          )}
          <button onClick={handleClose} className="text-gray-700 hover:text-gray-400">✕</button>
        </div>
      </div>

      <MessageList messages={messages} myRole={myRole} aiThinking={aiThinking} />
      <MessageInput onSend={onSend} disabled={false} />
    </div>
  );
}
