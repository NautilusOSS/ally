/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf8f3',
          100: '#faf0e6',
          200: '#f5e1d0',
          300: '#ecc9a8',
          400: '#e0a875',
          500: '#d4945f',
          600: '#c47d4a',
          700: '#a8663d',
          800: '#8a5436',
          900: '#70462f',
        },
        sand: {
          50: '#faf9f6',
          100: '#f5f3ed',
          200: '#e8e4d6',
          300: '#d4cdb8',
          400: '#b8ae94',
          500: '#a08f73',
          600: '#8a7860',
          700: '#726250',
          800: '#5f5244',
          900: '#4f4439',
        },
        dune: {
          50: '#f7f5f2',
          100: '#ede8e0',
          200: '#d9d0c1',
          300: '#c0b29d',
          400: '#a8907a',
          500: '#957a63',
          600: '#7d6654',
          700: '#675448',
          800: '#56473e',
          900: '#4a3e36',
        },
        stone: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#6c757d',
          600: '#495057',
          700: '#343a40',
          800: '#212529',
          900: '#1a1d20',
        },
      },
    },
  },
  plugins: [
    plugin(function({ addVariant }) {
      addVariant('oled', '.oled &');
    }),
  ],
};
