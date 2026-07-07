/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: '#00f0ff',
        emerald: '#00D084',
        glass: 'rgba(255,255,255,0.06)'
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: [],
}
