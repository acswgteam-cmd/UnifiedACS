
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],

  // No darkMode toggle — the whole system is dark-first per DESIGN.md
  theme: {
    // ── Override Tailwind's default color palette with Linear tokens ──────────
    // This makes `bg-white`, `text-zinc-900` etc. silently remap to dark surfaces
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      // Linear exact tokens (DESIGN.md)
      canvas:    '#0E0F11',
      's1':      '#16171A',
      's2':      '#1D1E22',
      's3':      '#27282D',
      's4':      '#35373E',

      hairline:  '#27282D',
      'hairline-strong':   '#35373E',
      'hairline-tertiary': '#4A4D56',

      ink:         '#F7F8F8',
      'ink-muted': '#C1C4CB',
      'ink-subtle':'#8A8F98',
      'ink-dim':   '#62656A',

      primary: '#5E6AD2',
      'primary-hover': '#6F7BF7',
      'primary-focus': '#4B55A9',

      success: '#27A644',
      warning: '#E5A50A',
      error:   '#E5534B',

      // Inverse (rare light surfaces per DESIGN.md)
      white:   '#F7F8F8',    // remap 'white' → ink color (near-white on dark)
      black:   '#0E0F11',    // remap 'black' → canvas

      // Map Tailwind zinc/gray/slate to Linear surfaces so legacy classes work
      zinc: {
        50:  '#1D1E22',   // surface-3
        100: '#16171A',   // surface-2
        200: '#27282D',   // hairline
        300: '#35373E',   // hairline-strong
        400: '#62656A',   // ink-dim
        500: '#8A8F98',   // ink-subtle
        600: '#8A8F98',   // ink-subtle
        700: '#C1C4CB',   // ink-muted
        800: '#F7F8F8',   // ink (primary)
        900: '#F7F8F8',   // ink (primary)
        950: '#F7F8F8',   // ink (primary)
      },
      slate: {
        50:  '#1D1E22',
        100: '#16171A',
        200: '#27282D',
        300: '#35373E',
        400: '#62656A',
        500: '#8A8F98',
        600: '#8A8F98',
        700: '#C1C4CB',
        800: '#F7F8F8',
        900: '#F7F8F8',
        950: '#F7F8F8',
      },
      gray: {
        50:  '#1D1E22',
        100: '#16171A',
        200: '#27282D',
        300: '#35373E',
        400: '#62656A',
        500: '#8A8F98',
        600: '#8A8F98',
        700: '#C1C4CB',
        800: '#F7F8F8',
        900: '#F7F8F8',
        950: '#F7F8F8',
      },

      // Keep semantic colors (charts use these heavily)
      blue:   { 50:'#1e2a4a', 100:'#1e3a5f', 200:'#1d4ed8', 300:'#3b82f6', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 800:'#1e40af', 900:'#1e3a8a', 950:'#172554' },
      indigo: { 50:'#1e1b4b', 100:'#312e81', 200:'#4338ca', 300:'#6366f1', 400:'#818cf8', 500:'#6366f1', 600:'#4f46e5', 700:'#4338ca', 800:'#3730a3', 900:'#312e81', 950:'#1e1b4b' },
      violet: { 500:'#8b5cf6', 600:'#7c3aed', 700:'#6d28d9' },
      purple: { 400:'#c084fc', 500:'#a855f7', 600:'#9333ea', 700:'#7e22ce' },
      fuchsia:{ 500:'#d946ef', 600:'#c026d3' },
      pink:   { 500:'#ec4899', 600:'#db2777' },
      red:    { 400:'#f87171', 500:'#ef4444', 600:'#dc2626', 700:'#b91c1c' },
      orange: { 400:'#fb923c', 500:'#f97316', 600:'#ea580c' },
      amber:  { 50:'rgba(245,158,11,0.1)', 200:'rgba(245,158,11,0.3)', 400:'#fbbf24', 500:'#f59e0b', 600:'#d97706', 700:'#b45309' },
      yellow: { 400:'#facc15', 500:'#eab308' },
      lime:   { 500:'#84cc16' },
      green:  { 400:'#4ade80', 500:'#22c55e', 600:'#16a34a', 700:'#15803d' },
      emerald:{ 400:'#34d399', 500:'#10b981', 600:'#059669', 700:'#047857' },
      teal:   { 400:'#2dd4bf', 500:'#14b8a6', 600:'#0d9488' },
      cyan:   { 400:'#22d3ee', 500:'#06b6d4' },
    },

    // Typography — exact DESIGN.md scale
    fontSize: {
      'display-xl': ['80px',  { lineHeight: '1.05', letterSpacing: '-3.0px', fontWeight: '600' }],
      'display-lg': ['56px',  { lineHeight: '1.10', letterSpacing: '-1.8px', fontWeight: '600' }],
      'display-md': ['40px',  { lineHeight: '1.15', letterSpacing: '-1.0px', fontWeight: '600' }],
      'headline':   ['28px',  { lineHeight: '1.20', letterSpacing: '-0.6px', fontWeight: '600' }],
      'card-title': ['22px',  { lineHeight: '1.25', letterSpacing: '-0.4px', fontWeight: '500' }],
      'subhead':    ['20px',  { lineHeight: '1.40', letterSpacing: '-0.2px', fontWeight: '400' }],
      'body-lg':    ['18px',  { lineHeight: '1.50', letterSpacing: '-0.1px', fontWeight: '400' }],
      'body':       ['16px',  { lineHeight: '1.50', letterSpacing: '-0.05px', fontWeight: '400' }],
      'body-sm':    ['14px',  { lineHeight: '1.50', letterSpacing: '0', fontWeight: '400' }],
      'caption':    ['12px',  { lineHeight: '1.40', letterSpacing: '0', fontWeight: '400' }],
      'button':     ['14px',  { lineHeight: '1.20', letterSpacing: '0', fontWeight: '500' }],
      'eyebrow':    ['13px',  { lineHeight: '1.30', letterSpacing: '0.4px', fontWeight: '500' }],
      'mono':       ['13px',  { lineHeight: '1.50', letterSpacing: '0', fontWeight: '400' }],
      // Legacy Tailwind sizes used in pages
      'xs':  ['11px', { lineHeight: '1.5' }],
      'sm':  ['13px', { lineHeight: '1.5' }],
      'base':['14px', { lineHeight: '1.5' }],
      'lg':  ['16px', { lineHeight: '1.5' }],
      'xl':  ['18px', { lineHeight: '1.4' }],
      '2xl': ['22px', { lineHeight: '1.3' }],
      '3xl': ['28px', { lineHeight: '1.2' }],
      '4xl': ['36px', { lineHeight: '1.1' }],
      '5xl': ['48px', { lineHeight: '1.05' }],
      '6xl': ['60px', { lineHeight: '1' }],
      '7xl': ['72px', { lineHeight: '1' }],
      '8xl': ['96px', { lineHeight: '1' }],
      '9xl': ['128px', { lineHeight: '1' }],
    },

    fontFamily: {
      display: ['Inter', '"SF Pro Display"', '-apple-system', 'system-ui', 'sans-serif'],
      sans:    ['Inter', '"SF Pro Text"',    '-apple-system', 'system-ui', 'sans-serif'],
      mono:    ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      // Legacy aliases
      body:    ['Inter', '"SF Pro Text"', '-apple-system', 'system-ui', 'sans-serif'],
    },

    // DESIGN.md exact spacing
    spacing: {
      '0':   '0px',
      'px':  '1px',
      '0.5': '2px',
      '1':   '4px',   // xxs
      '1.5': '6px',
      '2':   '8px',   // xs
      '2.5': '10px',
      '3':   '12px',  // sm
      '3.5': '14px',
      '4':   '16px',  // md
      '5':   '20px',
      '6':   '24px',  // lg
      '7':   '28px',
      '8':   '32px',  // xl
      '9':   '36px',
      '10':  '40px',
      '11':  '44px',
      '12':  '48px',  // xxl
      '14':  '56px',
      '16':  '64px',
      '20':  '80px',
      '24':  '96px',  // section
      '28':  '112px',
      '32':  '128px',
      '36':  '144px',
      '40':  '160px',
      '48':  '192px',
      '56':  '224px',
      '64':  '256px',
      '72':  '288px',
      '80':  '320px',
      '96':  '384px',
    },

    // DESIGN.md exact border radius
    borderRadius: {
      'none': '0',
      'xs':   '4px',
      'sm':   '6px',
      DEFAULT:'8px',
      'md':   '8px',
      'lg':   '12px',
      'xl':   '16px',
      'xxl':  '24px',
      'pill': '9999px',
      'full': '9999px',
      // Legacy Tailwind names used in existing pages
      'rounded': '4px',
      'rounded-md': '8px',
      'rounded-lg': '12px',
      'rounded-xl': '16px',
      'rounded-2xl': '24px',
      'rounded-full': '9999px',
    },

    extend: {
      // Additional utilities
      boxShadow: {
        'focus': '0 0 0 2px rgba(94, 105, 209, 0.4)',
        'card':  '0 1px 2px rgba(0,0,0,0.05)',
        'dropdown': '0 8px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px #262626',
      },
      maxWidth: {
        'container': '1280px',
      },
      opacity: {
        '7': '0.07',
        '15': '0.15',
      },
    },
  },
  plugins: [],
}
