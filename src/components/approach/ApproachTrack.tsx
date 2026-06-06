import { memo } from 'react';

interface Props {
  length: number;
  position: number;
  traffic: number[];
}

export const ApproachTrack = memo(function ApproachTrack({ length, position, traffic }: Props) {
  const cells = Array.from({ length }, (_, i) => i + 1);
  const clampedPos = Math.min(Math.max(position, 1), length);
  const pct = length <= 1 ? 0 : ((clampedPos - 1) / (length - 1)) * 100;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-mono text-gray-600 uppercase tracking-widest mr-2 shrink-0">
        APP
      </span>

      <div className="relative flex items-center gap-0.5">
        {cells.map((pos) => {
          const tokenCount = traffic.filter((t) => t === pos).length;
          const isActive = pos === clampedPos;
          const hasTraffic = tokenCount > 0;

          return (
            <div
              key={pos}
              className={[
                'relative flex flex-col items-center justify-center w-8 h-8 rounded border font-mono text-xs',
                isActive && hasTraffic
                  ? 'border-red-500 bg-red-900/40 text-amber-400'
                  : isActive
                    ? 'border-amber-400/60 bg-amber-500/10 text-amber-400/60'
                    : hasTraffic
                      ? 'border-red-700 bg-red-900/30 text-red-400'
                      : 'border-cockpit-border bg-cockpit-surface/50 text-gray-600',
              ].join(' ')}
              title={`Position ${pos}${hasTraffic ? ` — ${tokenCount} TRAFFIC` : ''}`}
            >
              {hasTraffic ? (
                <span className="leading-none">✈</span>
              ) : (
                <span>{pos}</span>
              )}
              {tokenCount > 1 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[8px] flex items-center justify-center font-bold leading-none">
                  {tokenCount}
                </span>
              )}
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
