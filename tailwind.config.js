/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:     '#0F1115',
        surface:'#171A21',
        card:   '#1E2230',
        border: '#2A2E3A',
        accent: '#E53935',
        accent2:'#FF6B6B',
        muted:  '#6B7280',
        dim:    '#4B5563',
        text:   '#F1F3F7',
        sub:    '#9BA3AF',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl2: '20px',
        xl3: '24px',
        xl4: '28px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 0 1px rgba(229,57,53,0.3), 0 4px 24px rgba(229,57,53,0.15)',
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease both',
        'scale-in': 'scaleIn 0.2s ease both',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
