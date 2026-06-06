import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cockpit: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
