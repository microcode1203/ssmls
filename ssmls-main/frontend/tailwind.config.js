/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Geist', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono:    ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark:    '#1d4ed8',
          light:   '#3b82f6',
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        navy: {
          DEFAULT: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        }
      },
      borderRadius: {
        'xl':  '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        'xs':   '0 1px 2px rgba(15,23,42,.04)',
        'card': '0 1px 3px rgba(15,23,42,.06),0 1px 2px rgba(15,23,42,.04)',
        'md':   '0 4px 16px rgba(15,23,42,.08)',
        'lg':   '0 12px 40px rgba(15,23,42,.12)',
        'xl':   '0 24px 64px rgba(15,23,42,.16)',
      },
      animation: {
        'fade-up':  'fade-up 0.3s ease both',
        'fade-in':  'fade-in 0.2s ease both',
        'slide-in': 'slide-in 0.25s cubic-bezier(.32,.72,0,1)',
      }
    }
  },
  plugins: []
}
