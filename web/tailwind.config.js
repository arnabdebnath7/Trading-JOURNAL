/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070a0f',
          900: '#0b0f16',
          850: '#0f1520',
          800: '#131b27',
          700: '#1a2432',
          600: '#24303f',
          500: '#34435211'
        },
        profit: '#22c55e',
        loss: '#ef4444',
        brand: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.7)'
      }
    }
  },
  plugins: []
};
