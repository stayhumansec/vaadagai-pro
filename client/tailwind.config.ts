import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1a1a2e',
        brand: {
          blue: '#3b82f6',
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          purple: '#8b5cf6',
          orange: '#f97316',
        },
        gray: {
          DEFAULT: '#64748b',
          3: '#e2e8f0',
          4: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
