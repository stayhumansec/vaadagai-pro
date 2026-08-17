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
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Tamil"', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)',
        card: '0 1px 3px rgba(15, 23, 42, 0.05), 0 8px 24px -8px rgba(15, 23, 42, 0.10)',
        elevated: '0 4px 10px -2px rgba(15, 23, 42, 0.08), 0 16px 40px -12px rgba(15, 23, 42, 0.18)',
        glow: '0 0 0 1px rgba(59, 130, 246, 0.15), 0 8px 24px -6px rgba(59, 130, 246, 0.35)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
