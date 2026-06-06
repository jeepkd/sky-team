import { memo } from 'react';

interface Props {
  length: number;
  position: number;
  traffic: number[];
}

export const ApproachTrack = memo(function ApproachTrack({ length, position, traffic }: Props) {
  const cells = Array.from({ length }, (_, i) => i + 1);
  // position 0 = pre-approach; clamp display within cells
  const clampedPos = Math.min(Math.max(position, 1), length);
  // percentage offset for the animated plane (0% = cell 1, 100% = cell N)
  const pct = length <= 1 ? 0 : ((clampedPos - 1) / (length - 1)) * 100;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-mono text-gray-600 uppercase tracking-widest mr-2 shrink-0">
        APP
      </span>

      {/* Track cells */}
      <div className="relative flex items-center gap-0.5">
        {cells.map((pos) => {
          const hasTraffic = traffic.includes(pos);
          const isActive = pos === clampedPos;
          return (
            <div
              key={pos}
              className={[
                'flex items-center justify-center w-8 h-8 rounded border font-mono text-xs',
                isActive
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-400/60'
                  : hasTraffic
                    ? 'border-red-700 bg-red-900/30 text-red-400'
                    : 'border-cockpit-border bg-cockpit-surface/50 text-gray-600',
              ].join(' ')}
              title={`Position ${pos}${hasTraffic ? ' — TRAFFIC' : ''}`}
            >
              {hasTraffic && !isActive ? '⚡' : pos}
            </div>
          );
        })}

        {/* Animated plane that slides over the track */}
        {position >= 1 && (
          <div
            className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
            style={{
              left: `calc(${pct}% * (${length - 1} / ${length}) + ${pct === 0 ? 0 : 4}px)`,
              width: '32px',
              transition: 'left 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <span
              className="text-amber-400 text-sm drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]"
              title={`Position ${position}`}
            >
              ✈
            </span>
          </div>
        )}
      </div>

      {/* Runway */}
      <div className="ml-2 flex items-center gap-1">
        <div className="w-4 border-t border-dashed border-gray-700" />
        <div
          className={[
            'flex items-center justify-center w-10 h-8 rounded border text-xs font-mono font-bold transition-colors',
            position >= length
              ? 'border-green-600 bg-green-900/40 text-green-400'
              : 'border-green-900 bg-green-900/10 text-green-800',
          ].join(' ')}
        >
          RWY
        </div>
      </div>
    </div>
  );
});
