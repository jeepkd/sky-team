import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  role: 'pilot' | 'copilot' | 'ai';
  content: string;
  createdAt: string;
}

export function useChat(gameId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!gameId) return;

    // Load history
    supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data.map(toMsg));
        }
      });

    // Realtime subscription
    const topic = `messages:${gameId}`;
    supabase.removeChannel(supabase.channel(topic));
    const ch = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setMessages((prev) => {
            const msg = toMsg(payload.new as Record<string, string>);
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  return messages;
}

function toMsg(row: Record<string, string>): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    createdAt: row.created_at,
  };
}
