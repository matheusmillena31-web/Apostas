/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06080d',
          900: '#0b0f17',
          850: '#101620',
          800: '#141b27',
          700: '#1d2736',
          600: '#2b394d',
        },
        electric: {
          500: '#2388ff',
          600: '#1171e8',
          700: '#0c57b5',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(35, 136, 255, 0.18), 0 18px 60px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
