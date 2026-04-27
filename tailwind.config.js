
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ────────────────────────────────────────────────
      //  Genesis Color Palette
      // ────────────────────────────────────────────────
      colors: {
        primary:    { DEFAULT: '#6366F1', hover: '#4F46E5' },
        secondary:  '#20970B',
        neutral:    '#9C9C9C',
        bg:         '#FAFAFA',
        surface:    '#FFFFFF',
        'text-primary':   '#0A0A0A',
        'text-secondary': '#6B6B6B',
        border:     '#E8E8EC',
        success:    '#10B981',
        warning:    '#F59E0B',
        error:      '#EF4444',
      },

      // ────────────────────────────────────────────────
      //  Genesis Typography
      // ────────────────────────────────────────────────
      fontFamily: {
        display: ['"General Sans"', 'sans-serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display':  ['72px', { lineHeight: '1.05', letterSpacing: '-0.04em' }],
        'headline': ['60px', { lineHeight: '1.1',  letterSpacing: '-0.04em' }],
        'section':  ['32px', { lineHeight: '1.2',  letterSpacing: '-0.03em' }],
        'subhead':  ['24px', { lineHeight: '1.3',  letterSpacing: '-0.02em' }],
        'body':     ['15px', { lineHeight: '1.6' }],
        'small':    ['13px', { lineHeight: '1.5' }],
        'caption':  ['12px', { lineHeight: '1.4' }],
        'overline': ['11px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
      },

      // ────────────────────────────────────────────────
      //  Genesis Spacing (4px grid)
      // ────────────────────────────────────────────────
      spacing: {
        '18': '72px',
        '22': '88px',
      },
      maxWidth: {
        container: '1280px',
      },

      // ────────────────────────────────────────────────
      //  Genesis Border Radius
      // ────────────────────────────────────────────────
      borderRadius: {
        'chip':  '4px',
        'btn':   '6px',
        'panel': '8px',
        'card':  '12px',
        'pill':  '9999px',
      },

      // ────────────────────────────────────────────────
      //  Genesis Elevation / Shadows
      // ────────────────────────────────────────────────
      boxShadow: {
        'card-hover': '0 8px 30px rgba(0,0,0,0.08)',
        'btn-primary': '0 4px 12px rgba(99,102,241,0.35)',
        'focus-ring':  '0 0 0 3px rgba(99,102,241,0.12)',
        'dropdown':    '0 10px 40px rgba(0,0,0,0.12)',
      },

      // ────────────────────────────────────────────────
      //  Animations (micro-interactions)
      // ────────────────────────────────────────────────
      transitionDuration: {
        '200': '200ms',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideDown: { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.97)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.2s ease-out',
        'slide-down':'slideDown 0.2s ease-out',
        'scale-in':  'scaleIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
