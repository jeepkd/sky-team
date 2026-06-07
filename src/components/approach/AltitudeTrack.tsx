import { memo } from 'react';

interface Props {
  round: number;
  totalRounds: number;
  rerollRounds: number[];
}

const CELL = 30;

// Vertical altitude track: descends one space (1,000 ft) per round. Each space
// shows who plays first that round and whether it grants a reroll token. The
// current-round marker slides down as rounds complete.
export const AltitudeTrack = memo(function AltitudeTrack({ round, totalRounds, rerollRounds }: Props) {
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const clamped = Math.min(Math.max(round, 1), totalRounds);

  return (
    <div className="relative flex" style={{ height: totalRounds * CELL }}>
      {/* current-round marker rail */}
      <div className="relative w-4 shrink-0">
        <div
          className="absolute left-0 flex items-center justify-center text-amber-400"
          style={{ top: (clamped - 1) * CELL, height: CELL, transition: 'top 0.7s cubic-bezier(0.4,0,0.2,1)' }}
        >
          <span className="text-xs">▶</span>
        </div>
      </div>

      <div className="flex flex-col">
        {rounds.map((r) => {
          const feet = (totalRounds - r) * 1000;
          const pilotFirst = r % 2 === 1;
          const hasReroll = rerollRounds.includes(r);
          const isCurrent = r === clamped;
          const isPast = r < clamped;
          return (
            <div
              key={r}
              className={[
                'flex items-center gap-1.5 px-1.5 border-l-2 font-mono text-[10px]',
                isCurrent ? 'border-amber-400 bg-amber-500/10' : isPast ? 'border-zinc-800 opacity-40' : 'border-zinc-700',
              ].join(' ')}
              style={{ height: CELL, width: 104 }}
              title={`Round ${r}: ${feet} ft · ${pilotFirst ? 'Pilot' : 'Co-pilot'} first${hasReroll ? ' · reroll token' : ''}`}
            >
              {/* who-goes-first chip */}
              <span
                className={[
                  'w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-bold',
                  pilotFirst ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400',
                ].join(' ')}
                title={pilotFirst ? 'Pilot first' : 'Co-pilot first'}
              >
                {pilotFirst ? 'P' : 'C'}
              </span>
              <span className={isCurrent ? 'text-amber-200 font-bold' : feet === 0 ? 'text-green-400' : 'text-gray-500'}>
                {feet === 0 ? 'LAND' : feet}
              </span>
              {hasReroll && <span className="ml-auto text-amber-400" title="Reroll token">⟳</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
