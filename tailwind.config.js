/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7', // Primary UI Blue
          600: '#0369a1',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#0f172a',
        },
        scada: {
          bg: '#f8fafc',       // Crisp White/Off-White Background
          panel: '#ffffff',    // Card/Container Pure White
          border: '#e2e8f0',   // Subtle light border
          header: '#0f172a',   // Dark navy header text / contrast accents
          displayBg: '#0f172a',// Digital meter dark background
          ch1: '#0284c7',      // CH1 Blue Accent
          ch2: '#2563eb',      // CH2 Royal Blue Accent
          success: '#10b981',  // Green status indicator
          warning: '#f59e0b',  // Yellow status indicator
          danger: '#ef4444',   // Red alarm/stop indicator
        }
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
