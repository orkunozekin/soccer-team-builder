import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        'neutral-10': '#11151B',
        'neutral-20': '#232C35',
        'neutral-30': '#36444D',
        'neutral-40': '#4A5C64',
        'neutral-50': '#657A80',
        'neutral-60': '#8E9FA4',
        'neutral-70': '#A9B9BC',
        'neutral-80': '#C4D1D4',
        'neutral-90': '#E1E8EA',
        'neutral-95': '#F0F4F5',
        'neutral-98': '#F9FBFB',
        'pinny-orange': '#FF8641',
        'pinny-green': '#BAE87B',
        'pinny-blue': '#8BC3DC',
        'red-10': '#250704',
        'red-20': '#570F0C',
        'red-30': '#861719',
        'red-40': '#B82215',
        'red-50': '#D72A1C',
        'red-60': '#E60000',
        'red-70': '#FF7A7B',
        'red-80': '#FFB5B3',
        'red-90': '#FFD8D6',
        'red-95': '#FFF3F2',
        // Floodlight (dark) / Daylight (light) palette. Values are RGB
        // triplets in app/globals.css (:root = Daylight, .dark = Floodlight)
        // so opacity modifiers like text-chalk/70 keep working.
        ink: 'rgb(var(--fl-ink) / <alpha-value>)',
        rail: 'rgb(var(--fl-rail) / <alpha-value>)',
        turf: {
          DEFAULT: 'rgb(var(--fl-turf) / <alpha-value>)',
          raised: 'rgb(var(--fl-turf-raised) / <alpha-value>)',
        },
        line: 'rgb(var(--fl-line) / <alpha-value>)',
        chalk: 'rgb(var(--fl-chalk) / <alpha-value>)',
        fog: 'rgb(var(--fl-fog) / <alpha-value>)',
        flare: 'rgb(var(--fl-flare) / <alpha-value>)',
        lime: 'rgb(var(--fl-lime) / <alpha-value>)',
        mist: 'rgb(var(--fl-mist) / <alpha-value>)',
        dim: 'rgb(var(--fl-dim) / <alpha-value>)',
        'live-text': 'rgb(var(--fl-live-text) / <alpha-value>)',
        'live-pill': 'rgb(var(--fl-live-pill) / <alpha-value>)',
        'live-pill-border': 'rgb(var(--fl-live-pill-border) / <alpha-value>)',
        'ok-pill': 'rgb(var(--fl-ok-pill) / <alpha-value>)',
        'ok-pill-border': 'rgb(var(--fl-ok-pill-border) / <alpha-value>)',
        danger: 'rgb(var(--fl-danger) / <alpha-value>)',
        'danger-wash': 'rgb(var(--fl-danger-wash) / <alpha-value>)',
        // Same in both themes: dark text on fills that never flip (white
        // RSVP pill, orange profile badge).
        'on-bright': 'rgb(var(--fl-on-bright) / <alpha-value>)',
        // Full shadow color incl. alpha (e.g. shadow-elevation), per theme.
        elevation: 'rgb(var(--fl-elevation))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'ball-bounce': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '25%': { transform: 'translateY(-12px) rotate(90deg)' },
          '50%': { transform: 'translateY(0) rotate(180deg)' },
          '75%': { transform: 'translateY(-6px) rotate(270deg)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up-fade': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'headcount-bump': {
          '0%, 100%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.15)' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': {
            transform: 'translateY(110vh) rotate(720deg)',
            opacity: '0',
          },
        },
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.04)', opacity: '0.2' },
        },
        'rsvp-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(215, 42, 28, 0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(215, 42, 28, 0.35)' },
        },
        'badge-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'ball-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out forwards',
        'ball-bounce': 'ball-bounce 1.2s ease-in-out infinite',
        'scale-in': 'scale-in 0.4s ease-out forwards',
        'slide-up-fade': 'slide-up-fade 0.5s ease-out forwards',
        'headcount-bump': 'headcount-bump 0.5s ease-out',
        'confetti-fall': 'confetti-fall 2.5s ease-in forwards',
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
        'rsvp-glow': 'rsvp-glow 1s ease-out',
        'badge-pulse': 'badge-pulse 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'ball-spin': 'ball-spin 4s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
