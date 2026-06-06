import { memo } from 'react';

interface Props {
  /** Engine-sum boundary: sum <= aeroBlue → 0 spaces. */
  aeroBlue: number;
  /** sum <= aeroOrange → 1 space; else 2. */
  aeroOrange: number;
  /** Current engine sum (0 if engines not yet resolved this round). */
  speed: number;
  /** When true (final round) speed is compared with the brakes, not the markers. */
  finalRound?: boolean;
  brakeThreshold?: number;
}

// The engine-sum scale runs 2..12 (two dice).
const SCALE = Array.from({ length: 11 }, (_, i) => i + 2);

export const SpeedGauge = memo(function SpeedGauge({ aeroBlue, aeroOrange, speed, finalRound, brakeThreshold }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-gray-500">
        <span>Speed</span>
        {speed > 0 && <span className="text-amber-300">sum {speed}</span>}
        {finalRound && (
          <span className="text-red-400">landing — need &lt; {brakeThreshold}</span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {SCALE.map((n) => {
          // Advancement zone for this sum.
          const zone = finalRound
            ? (brakeThreshold !== undefined && n < brakeThreshold ? 'ok' : 'bad')
            : n <= aeroBlue ? '0' : n <= aeroOrange ? '1' : '2';
          const isSpeed = n === speed;
          const zoneColor =
            zone === '0' ? 'text-gray-600 border-cockpit-border'
            : zone === '1' ? 'text-green-500/70 border-green-900/50'
            : zone === '2' ? 'text-amber-400/80 border-amber-900/50'
            : zone === 'ok' ? 'text-green-500/70 border-green-900/50'
            : 'text-red-500/70 border-red-900/50';
          return (
            <div key={n} className="relative flex flex-col items-center">
              {/* marker ticks sit between numbers */}
              <div
                className={[
                  'w-6 h-7 rounded border flex items-center justify-center font-mono text-xs',
                  zoneColor,
                  isSpeed ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold scale-110' : 'bg-cockpit-surface/40',
                ].join(' ')}
              >
                {n}
              </div>
              {/* blue marker after aeroBlue, orange after aeroOrange */}
              {n === aeroBlue && <span className="absolute -right-1 top-0 bottom-0 w-1 rounded bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              {n === aeroOrange && <span className="absolute -right-1 top-0 bottom-0 w-1 rounded bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]" />}
            </div>
          );
        })}
      </div>
      {!finalRound && (
        <div className="flex gap-3 text-[9px] font-mono text-gray-600">
          <span>≤{aeroBlue}: <span className="text-gray-500">0 spaces</span></span>
          <span><span className="text-green-600">●</span> 1 space</span>
          <span><span className="text-amber-600">●</span> 2 spaces</span>
        </div>
      )}
    </div>
  );
});
