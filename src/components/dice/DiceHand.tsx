import { memo } from 'react';
import { DieToken } from './DieToken';

interface Props {
  dice: number[];
  selectedDie: number | null;
  onSelect: (v: number) => void;
  isMyTurn: boolean;
}

export const DiceHand = memo(function DiceHand({ dice, selectedDie, onSelect, isMyTurn }: Props) {
  if (dice.length === 0) {
    return (
      <div className="text-xs font-mono text-gray-600 uppercase tracking-widest">
        No dice remaining
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono uppercase tracking-widest text-gray-500 mr-1">
        Your dice
      </span>
      {dice.map((v, i) => (
        <DieToken
          key={i}
          value={v}
          selected={selectedDie === v && dice.indexOf(v) === i}
          onClick={isMyTurn ? () => onSelect(v) : undefined}
          disabled={!isMyTurn}
          size="lg"
        />
      ))}
      {!isMyTurn && (
        <span className="ml-2 text-xs font-mono text-gray-500">
          Opponent&apos;s turn
        </span>
      )}
    </div>
  );
});
