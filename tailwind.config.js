/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Dragon fire palette
        fire: {
          50:  '#fff1f0', 100: '#ffe0dd', 200: '#ffc5bf',
          300: '#ff9b91', 400: '#ff6355', 500: '#ff2d1a',
          600: '#ed1505', 700: '#c81006', 800: '#a5100b',
          900: '#88130e', 950: '#4b0504',
        },
        gold: {
          50:  '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
          600: '#d97706', 700: '#b45309', 800: '#92400e',
          900: '#78350f',
        },
        obsidian: {
          50:  '#f6f6f7', 100: '#e2e2e5', 200: '#c5c5cb',
          300: '#a0a0aa', 400: '#71717d', 500: '#52525e',
          600: '#3a3a44', 700: '#26262f', 800: '#18181f',
          900: '#0e0e14', 950: '#07070a',
        },
        dragon: {
          red:    '#c0392b',
          dark:   '#0a0a0f',
          card:   '#12121a',
          border: '#2a1a1a',
          glow:   '#ff2d1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace'],
      },
      backgroundImage: {
        'dragon-scales': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M0 20 L20 0 L40 20 L20 40 Z' fill='%23ff2d1a' fill-opacity='0.03'/%3E%3C/g%3E%3C/svg%3E\")",
        'fire-glow': 'radial-gradient(ellipse at top, rgba(192,57,43,0.15) 0%, transparent 70%)',
        'dragon-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #1a0808 50%, #0a0a0f 100%)',
      },
      boxShadow: {
        'fire': '0 0 20px rgba(255,45,26,0.3), 0 0 60px rgba(255,45,26,0.1)',
        'fire-sm': '0 0 10px rgba(255,45,26,0.2)',
        'gold': '0 0 20px rgba(245,158,11,0.3)',
      },
      animation: {
        'fire-pulse': 'firePulse 2s ease-in-out infinite',
        'dragon-breathe': 'dragonBreathe 3s ease-in-out infinite',
        'scale-appear': 'scaleAppear 0.5s ease-out',
      },
      keyframes: {
        firePulse: {
          '0%,100%': { boxShadow: '0 0 10px rgba(255,45,26,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(255,45,26,0.6), 0 0 60px rgba(255,45,26,0.2)' },
        },
        dragonBreathe: {
          '0%,100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        scaleAppear: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
