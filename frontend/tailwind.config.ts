import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: { extend: {
    colors: { brand: { DEFAULT: '#3b82f6', soft: '#eff6ff', dark: '#2563eb' }, surface: { DEFAULT: '#ffffff', alt: '#f8fafc' }, ink: { DEFAULT: '#0f172a', soft: '#475569' }, ok: '#22c55e', warn: '#f59e0b', danger: '#ef4444' },
    borderRadius: { xl: '0.875rem' },
    minHeight: { 11: '2.75rem' }, minWidth: { 11: '2.75rem' },
    keyframes: { 'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } } },
    animation: { 'fade-in': 'fade-in 180ms ease-out' }
  } },
  plugins: []
}
export default config
