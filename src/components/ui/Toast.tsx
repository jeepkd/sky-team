import type { ToastItem } from '@/hooks/useToast';

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TYPE_STYLES: Record<ToastItem['type'], string> = {
  error: 'border-red-700 bg-red-900/80 text-red-200',
  info: 'border-cockpit-border bg-cockpit-surface text-gray-300',
  success: 'border-green-700 bg-green-900/80 text-green-200',
};

export function ToastList({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'flex items-start gap-2 rounded-lg border px-4 py-3 text-xs font-mono shadow-lg',
            TYPE_STYLES[t.type],
          ].join(' ')}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 ml-2"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
