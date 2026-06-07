import { memo } from 'react';

interface Props {
  length: number;
  position: number;
  traffic: number[];
}

const CELL = 30;

// Vertical approach track: the plane slides DOWN toward the airport (bottom)
// as its position increases. Airplane (traffic) tokens sit on their positions.
export const ApproachTrack = memo(function ApproachTrack({ length, position, traffic }: Props) {
  const cells = Array.from({ length }, (_, i) => i + 1);
  const clamped = Math.min(Math.max(position, 1), length);

  return (
    <div className="relative flex" style={{ height: length * CELL }}>
      {/* plane marker rail */}
      <div className="relative w-5 shrink-0">
        <div
          className="absolute left-0 flex items-center justify-center text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]"
          style={{
            top: (clamped - 1) * CELL,
            height: CELL,
            transition: 'top 0.7s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <span className="text-base" style={{ transform: 'rotate(90deg)' }}>✈</span>
        </div>
      </div>

      {/* track cells */}
      <div className="flex flex-col">
        {cells.map((pos) => {
          const count = traffic.filter((t) => t === pos).length;
          const isAirport = pos === length;
          const isCurrent = pos === clamped;
          return (
            <div
              key={pos}
              className={[
                'relative flex items-center gap-1 px-1.5 border-l-2 font-mono text-[10px]',
                isCurrent ? 'border-amber-400 bg-amber-500/10' : count > 0 ? 'border-red-700 bg-red-900/20' : 'border-zinc-700',
                isAirport ? 'border-l-green-600' : '',
              ].join(' ')}
              style={{ height: CELL, width: 96 }}
              title={`Position ${pos}${count > 0 ? ` — ${count} traffic` : ''}${isAirport ? ' — airport' : ''}`}
            >
              <span className={isAirport ? 'text-green-400 font-bold' : 'text-gray-600'}>
                {isAirport ? 'RWY' : pos}
              </span>
              {count > 0 && (
                <span className="ml-auto flex items-center">
                  {/* Stack tokens slightly offset so each is individually visible */}
                  <span className="relative flex items-center" style={{ width: 14 + (Math.min(count, 4) - 1) * 8 }}>
                    {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute flex items-center justify-center w-[14px] h-[14px] rounded-full bg-red-700 border border-red-400 text-[8px] text-red-100"
                        style={{ left: i * 8, zIndex: i }}
                        title={`${count} airplane${count > 1 ? 's' : ''}`}
                      >
                        ✈
                      </span>
                    ))}
                  </span>
                  {count > 4 && (
                    <span className="ml-1 text-[8px] font-mono text-red-400">×{count}</span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
