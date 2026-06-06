import { memo } from 'react';

interface Props {
  /** Signed cumulative tilt; + toward pilot (blue, left), − toward co-pilot (orange, right). */
  tilt: number;
  /** |tilt| >= spinLimit is a crash (the X marks at the ends of the arc). */
  spinLimit: number;
}

const W = 240;
const H = 138;
const CX = W / 2;
const CY = 122;
const R = 100;

// Map a tilt mark to a point on the upper semicircle.
// Pilot (positive) is on the LEFT, co-pilot (negative) on the RIGHT.
function pointAt(mark: number, limit: number, radius: number) {
  const posAngle = 90 + (mark / limit) * 90; // degrees: 90=top, 180=left, 0=right
  const rad = (posAngle * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

export const AxisDial = memo(function AxisDial({ tilt, spinLimit }: Props) {
  const marks = Array.from({ length: spinLimit * 2 + 1 }, (_, i) => i - spinLimit);
  const clamped = Math.max(-spinLimit, Math.min(spinLimit, tilt));
  const danger = Math.abs(tilt) >= spinLimit - 1;
  // Bank angle of the airplane: pilot-high banks left (negative rotation).
  const bank = -(clamped / spinLimit) * 38;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px]">
        <defs>
          <linearGradient id="axisArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Arc track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#axisArc)"
          strokeWidth="3"
          strokeOpacity="0.5"
        />

        {/* Tick marks */}
        {marks.map((m) => {
          const isEnd = Math.abs(m) === spinLimit;
          const isCenter = m === 0;
          const outer = pointAt(m, spinLimit, R + 2);
          const inner = pointAt(m, spinLimit, R - (isEnd || isCenter ? 14 : 9));
          const label = pointAt(m, spinLimit, R + 13);
          return (
            <g key={m}>
              <line
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke={isEnd ? '#ef4444' : isCenter ? '#22c55e' : m > 0 ? '#3b82f6' : '#f97316'}
                strokeWidth={isEnd || isCenter ? 3 : 1.5}
                strokeOpacity={isEnd || isCenter ? 0.9 : 0.5}
              />
              {isEnd && (
                <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize="11" fill="#ef4444" fontWeight="bold">✕</text>
              )}
              {isCenter && (
                <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize="9" fill="#22c55e">0</text>
              )}
            </g>
          );
        })}

        {/* Current-tilt needle */}
        {(() => {
          const p = pointAt(clamped, spinLimit, R - 4);
          return (
            <line
              x1={CX} y1={CY} x2={p.x} y2={p.y}
              stroke={danger ? '#ef4444' : '#fbbf24'}
              strokeWidth="2"
              strokeLinecap="round"
              style={{ transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)' }}
            />
          );
        })()}

        {/* Banking airplane (front view) at the hub */}
        <g transform={`rotate(${bank} ${CX} ${CY})`} style={{ transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)' }}>
          <rect x={CX - 34} y={CY - 4} width="68" height="6" rx="3" fill={danger ? '#ef4444' : '#e5e7eb'} />
          <rect x={CX - 4} y={CY - 16} width="8" height="22" rx="3" fill={danger ? '#ef4444' : '#e5e7eb'} />
          <circle cx={CX} cy={CY} r="6" fill={danger ? '#ef4444' : '#fbbf24'} />
          <rect x={CX - 10} y={CY + 8} width="20" height="4" rx="2" fill={danger ? '#ef4444' : '#9ca3af'} />
        </g>

        {/* hub base */}
        <circle cx={CX} cy={CY} r="3" fill="#27272a" />
      </svg>

      <div className="flex items-center gap-2 -mt-1 text-[10px] font-mono uppercase tracking-widest">
        <span className="text-blue-500/80">◀ pilot</span>
        <span className={['mx-1', danger ? 'text-red-400 font-bold animate-pulse' : 'text-gray-500'].join(' ')}>
          {tilt > 0 ? `+${tilt}` : tilt}
        </span>
        <span className="text-orange-500/80">co-pilot ▶</span>
      </div>
    </div>
  );
});
