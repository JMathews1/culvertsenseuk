import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        border: 'var(--border)',
        border2: 'var(--border2)',
        'cs-teal': 'var(--teal)',
        'cs-amber': 'var(--amber)',
        'cs-red': 'var(--red)',
        'cs-blue': 'var(--blue)',
        'cs-green': 'var(--green)',
        text: 'var(--text)',
        'text-dim': 'var(--text-dim)',
        'text-mid': 'var(--text-mid)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
