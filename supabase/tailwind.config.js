/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // White theme
        bg:     '#FFFFFF',
        surface:'#F8F9FA',
        card:   '#FFFFFF',
        border: '#E5E7EB',
        accent: '#C0392B',
        accent2:'#E74C3C',
        muted:  '#6B7280',
        dim:    '#9CA3AF',
        text:   '#111827',
        sub:    '#4B5563',
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
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        lifted: '0 4px 24px rgba(0,0,0,0.10)',
        red: '0 4px 16px rgba(192,57,43,0.25)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease both',
        'scale-in': 'scaleIn 0.2s ease both',
        'slide-in': 'slideIn 0.3s ease both',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
