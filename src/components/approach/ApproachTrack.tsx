interface Props {
  length: number;
  position: number;
  traffic: number[];
}

export function ApproachTrack({ length, position, traffic }: Props) {
  const cells = Array.from({ length }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-mono text-gray-600 uppercase tracking-widest mr-2">
        APP
      </span>
      <div className="flex items-center gap-0.5">
        {cells.map((pos) => {
          const isPlane = position === pos;
          const hasTraffic = traffic.includes(pos);
          return (
            <div
              key={pos}
              className={[
                'relative flex items-center justify-center w-8 h-8 rounded border font-mono text-xs transition-colors',
                isPlane
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : hasTraffic
                    ? 'border-red-700 bg-red-900/30 text-red-400'
                    : 'border-cockpit-border bg-cockpit-surface/50 text-gray-600',
              ].join(' ')}
              title={`Position ${pos}${hasTraffic ? ' — TRAFFIC' : ''}${isPlane ? ' — PLANE' : ''}`}
            >
              {isPlane ? '✈' : hasTraffic ? '⚡' : pos}
            </div>
          );
        })}
      </div>
      <div className="ml-2 flex items-center gap-1">
        <div className="w-6 border-t border-dashed border-gray-700" />
        <div className="flex items-center justify-center w-10 h-8 rounded border border-green-800 bg-green-900/20 text-green-400 text-xs font-mono font-bold">
          RWY
        </div>
      </div>
    </div>
  );
}
