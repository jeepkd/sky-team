interface Props {
  value: number;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Pip grid: 9 positions (3×3). true = pip present.
const PIP_LAYOUTS: Record<number, boolean[]> = {
  1: [false, false, false, false, true,  false, false, false, false],
  2: [false, false, true,  false, false, false, true,  false, false],
  3: [false, false, true,  false, true,  false, true,  false, false],
  4: [true,  false, true,  false, false, false, true,  false, true ],
  5: [true,  false, true,  false, true,  false, true,  false, true ],
  6: [true,  false, true,  true,  false, true,  true,  false, true ],
};

const SIZE_CLASSES = {
  sm: 'w-9 h-9 p-1',
  md: 'w-12 h-12 p-1.5',
  lg: 'w-16 h-16 p-2',
};

const PIP_SIZES = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function DieToken({ value, selected, onClick, disabled, size = 'md' }: Props) {
  const pips = PIP_LAYOUTS[value] ?? PIP_LAYOUTS[1];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative rounded-lg grid grid-cols-3 grid-rows-3 transition-all duration-150 border-2',
        SIZE_CLASSES[size],
        selected
          ? 'bg-amber-500 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.8)] scale-110'
          : disabled
            ? 'bg-gray-800 border-gray-700 opacity-40 cursor-not-allowed'
            : onClick
              ? 'bg-cockpit-surface border-cockpit-border hover:border-amber-600 hover:scale-105 cursor-pointer'
              : 'bg-cockpit-surface border-cockpit-border',
      ].join(' ')}
      aria-label={`Die ${value}`}
    >
      {pips.map((hasPip, i) => (
        <span
          key={i}
          className={[
            'rounded-full mx-auto my-auto',
            PIP_SIZES[size],
            hasPip
              ? selected
                ? 'bg-amber-900'
                : 'bg-amber-400'
              : 'bg-transparent',
          ].join(' ')}
        />
      ))}
    </button>
  );
}
