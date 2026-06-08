/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fbf8eb',
          100: '#f4ebb9',
          200: '#eddca1',
          300: '#e1c66f',
          400: '#d5b03d',
          500: '#c29b38', // Brand gold
          600: '#aa7e2a',
          700: '#8e6120',
          800: '#754d1d',
          900: '#613e1c',
        }
      }
    },
  },
  plugins: [],
}
