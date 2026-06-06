import { memo } from 'react';

interface Props {
  /** Signed cumulative tilt; + toward pilot, − toward copilot. */
  tilt: number;
  /** |tilt| >= spinLimit is a crash (the X marks). */
  spinLimit: number;
}

export const AxisIndicator = memo(function AxisIndicator({ tilt, spinLimit }: Props) {
  // Marks from -spinLimit..+spinLimit; the ends are the X (spin).
  const marks = Array.from({ length: spinLimit * 2 + 1 }, (_, i) => i - spinLimit);
  const danger = Math.abs(tilt) >= spinLimit - 1;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest">
        <span className="text-orange-500/70">co-pilot</span>
        <span className={['mx-2', danger ? 'text-red-400 font-bold' : 'text-gray-500'].join(' ')}>
          Axis {tilt > 0 ? `+${tilt}` : tilt}
        </span>
        <span className="text-blue-500/70">pilot</span>
      </div>
      <div className="flex items-center gap-0.5">
        {marks.map((m) => {
          const isEnd = Math.abs(m) === spinLimit;
          const isCenter = m === 0;
          const isCurrent = m === tilt;
          return (
            <div
              key={m}
              className={[
                'w-5 h-6 rounded flex items-center justify-center text-[10px] font-mono border',
                isEnd ? 'border-red-700 text-red-500 bg-red-950/40'
                  : isCenter ? 'border-green-700 text-green-500 bg-green-950/30'
                  : m > 0 ? 'border-blue-900/40 text-blue-700 bg-blue-950/20'
                  : 'border-orange-900/40 text-orange-700 bg-orange-950/20',
                isCurrent ? 'ring-2 ring-amber-400 scale-110 z-10' : '',
              ].join(' ')}
              title={isEnd ? 'Spin — crash!' : isCenter ? 'Level' : `${Math.abs(m)} ${m > 0 ? 'pilot' : 'co-pilot'}`}
            >
              {isEnd ? '✕' : isCurrent ? '▲' : isCenter ? '0' : '·'}
            </div>
          );
        })}
      </div>
    </div>
  );
});
