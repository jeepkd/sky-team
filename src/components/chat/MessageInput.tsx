import { useRef, useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-cockpit-border px-2 py-1.5">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Message…"
        disabled={disabled}
        maxLength={200}
        className="flex-1 bg-transparent border border-gray-700 rounded px-2 py-1 text-[11px] font-mono text-gray-300 placeholder-gray-700 focus:outline-none focus:border-gray-500 disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="text-[10px] uppercase tracking-widest text-amber-600 border border-amber-800 rounded px-2 py-1 hover:bg-amber-900/30 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
