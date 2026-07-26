/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Core tokens — light theme, white + red (matches landing page)
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
        // Same class names used across Home/Cashier — now resolve to light values
        dark: {
          bg:      '#FFFFFF',
          sidebar: '#FFFFFF',
          card:    '#FFFFFF',
          border:  '#E5E7EB',
          primary: '#2563EB',
          red:     '#C0392B',
          green:   '#16A34A',
          orange:  '#D97706',
          purple:  '#7C3AED',
          text:    '#111827',
          sub:     '#6B7280',
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
