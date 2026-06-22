/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // ── Core palette ────────────────────────────────────────────────────────
        navy: {
          DEFAULT: '#273469',
          hover:   '#1e2a55',
          soft:    '#e8ecf4',
          muted:   '#f0f2f7',
        },
        sky: {
          DEFAULT: '#4EA5D9',
          hover:   '#3d94c8',
          soft:    '#e3f1fa',
        },
        rose: {
          DEFAULT: '#9B6A6C',
          soft:    '#f5eced',
        },
        charcoal: {
          DEFAULT: '#30343F',
          600:     '#6B6E7A',
          400:     '#9B9EA8',
        },
        cream: {
          DEFAULT: '#FFEEDB',
          light:   '#FFF8F0',
          mid:     '#FFF5E9',
        },
        border: {
          DEFAULT: '#E8E0D6',
          strong:  '#D4CCC2',
        },
        // ── Invoice PDF echo (PDF preview frame / decorative only) ──────────────
        invoice: {
          wash:   '#d6eaf5',
          accent: '#86b9d4',
        },
        // ── Legacy aliases (keep so existing pages don't break) ──────────────────
        'eigensu-blue': '#86b9d4',
        'eigensu-bg':   '#d6eaf5',
      },
      fontFamily: {
        // CSS variable injected by next/font in app/layout.tsx
        sans:    ['var(--font-sans)', 'Poppins', 'Inter', 'Helvetica Neue', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
