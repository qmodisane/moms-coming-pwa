/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'concrete': '#2C2C2C',
        'asphalt': '#0A0A0A',
        'hot-pink': '#FF006E',
        'electric-blue': '#00F5FF',
        'lime': '#CCFF00',
        'gold': '#FFD700',
        'danger': '#FF3838',
        'spray-white': '#F5F5F5'
      },
      fontFamily: {
        'marker': ['"Permanent Marker"', 'cursive'],
        'condensed': ['"Roboto Condensed"', 'sans-serif'],
        'graffiti': ['"Bangers"', 'cursive']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'drip': 'drip 2s ease-in-out infinite'
      },
      keyframes: {
        drip: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(10px)' }
        }
      }
    },
  },
  plugins: [],
}
