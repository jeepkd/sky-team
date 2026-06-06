import type { Player, Role } from '@/types';

const ROLE_LABELS: Record<Role, string> = {
  pilot: 'Pilot',
  copilot: 'Co-Pilot',
};

interface Props {
  role: Role;
  player: (Player & { is_ai?: boolean }) | null;
  isYou: boolean;
  online: boolean;
}

export function SeatCard({ role, player, isYou, online }: Props) {
  const isAi = player?.is_ai ?? false;
  return (
    <div className="flex items-center justify-between rounded-xl border border-cockpit-border bg-cockpit-surface p-4">
      <div>
        <p className="text-sm font-semibold text-white">{ROLE_LABELS[role]}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {player
            ? isAi
              ? 'AI Co-pilot'
              : isYou
                ? 'You'
                : 'Opponent'
            : 'Waiting…'}
        </p>
      </div>
      <span
        className={`h-2.5 w-2.5 rounded-full transition-colors ${
          isAi
            ? 'bg-amber-500'
            : player && online
              ? 'bg-green-400'
              : player
                ? 'bg-gray-600'
                : 'bg-gray-800'
        }`}
      />
    </div>
  );
}
