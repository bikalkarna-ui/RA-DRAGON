/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Core tokens — now dark theme (app-wide)
        bg:     '#09090B',
        surface:'#111318',
        card:   '#17191E',
        border: '#26282F',
        accent: '#D6453D',
        accent2:'#E15D56',
        muted:  '#9CA3AF',
        dim:    '#6B7280',
        text:   '#FFFFFF',
        sub:    '#B4B8C0',
        // Extra palette for icons/status, matches the dark spec exactly
        dark: {
          bg:      '#09090B',
          sidebar: '#111318',
          card:    '#17191E',
          border:  '#26282F',
          primary: '#4F7CFF',
          red:     '#D6453D',
          green:   '#22C55E',
          orange:  '#F59E0B',
          purple:  '#8B5CF6',
          text:    '#FFFFFF',
          sub:     '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl2: '16px',
        xl3: '20px',
        xl4: '24px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.06), 0 2px 8px rgba(16,24,40,0.06), 0 10px 28px rgba(16,24,40,0.07)',
        soft: '0 1px 3px rgba(16,24,40,0.07), 0 1px 4px rgba(16,24,40,0.06)',
        lifted: '0 6px 16px rgba(16,24,40,0.09), 0 16px 40px rgba(16,24,40,0.11)',
        red: '0 3px 10px rgba(192,57,43,0.22), 0 10px 24px rgba(192,57,43,0.18)',
        inner: 'inset 0 1px 2px rgba(16,24,40,0.04)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease both',
        'scale-in': 'scaleIn 0.2s ease both',
        'slide-in': 'slideIn 0.3s ease both',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
