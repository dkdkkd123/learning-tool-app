/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0f1117',
          1: '#1a1d27',
          2: '#222536',
          3: '#2a2e40',
        },
      },
    },
  },
  plugins: [],
};
