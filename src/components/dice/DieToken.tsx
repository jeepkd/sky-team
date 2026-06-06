interface Props {
  value: number;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  role?: 'pilot' | 'copilot';
  faceDown?: boolean;
}

// Pip grid: 9 positions (3×3). true = pip present.
const PIP_LAYOUTS: Record<number, boolean[]> = {
  0: [false, false, false, false, false, false, false, false, false],
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

type RoleTheme = {
  base: string;
  selected: string;
  pip: string;
  pipSelected: string;
  shadow: string;
};

const ROLE_THEMES: Record<'pilot' | 'copilot' | 'neutral', RoleTheme> = {
  pilot: {
    base: 'bg-blue-950 border-blue-700',
    selected: 'bg-blue-600 border-blue-300',
    pip: 'bg-blue-400',
    pipSelected: 'bg-blue-100',
    shadow: 'shadow-[0_0_12px_rgba(59,130,246,0.8)]',
  },
  copilot: {
    base: 'bg-orange-950 border-orange-700',
    selected: 'bg-orange-500 border-orange-300',
    pip: 'bg-orange-400',
    pipSelected: 'bg-orange-100',
    shadow: 'shadow-[0_0_12px_rgba(249,115,22,0.8)]',
  },
  neutral: {
    base: 'bg-cockpit-surface border-cockpit-border',
    selected: 'bg-amber-500 border-amber-300',
    pip: 'bg-amber-400',
    pipSelected: 'bg-amber-900',
    shadow: 'shadow-[0_0_12px_rgba(245,158,11,0.8)]',
  },
};

export function DieToken({ value, selected, onClick, disabled, size = 'md', role, faceDown }: Props) {
  const pips = PIP_LAYOUTS[value] ?? PIP_LAYOUTS[1];
  const theme = ROLE_THEMES[role ?? 'neutral'];

  if (faceDown) {
    return (
      <div
        className={[
          'relative rounded-lg border-2 flex items-center justify-center',
          SIZE_CLASSES[size],
          theme.base,
        ].join(' ')}
        title="Hidden die"
      >
        <span className="text-gray-600 font-mono font-bold" style={{ fontSize: size === 'lg' ? '1.1rem' : '0.7rem' }}>?</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative rounded-lg grid grid-cols-3 grid-rows-3 transition-all duration-150 border-2',
        SIZE_CLASSES[size],
        selected
          ? `${theme.selected} ${theme.shadow} scale-110`
          : disabled
            ? 'bg-gray-800 border-gray-700 opacity-40 cursor-not-allowed'
            : onClick
              ? `${theme.base} hover:border-opacity-80 hover:scale-105 cursor-pointer`
              : theme.base,
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
              ? selected ? theme.pipSelected : theme.pip
              : 'bg-transparent',
          ].join(' ')}
        />
      ))}
    </button>
  );
}
