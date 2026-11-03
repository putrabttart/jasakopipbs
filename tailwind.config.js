/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#FAFAF9',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
          950: '#0A0A0B',
        },
        accent: {
          50: '#FDF8F3',
          100: '#F8EDDF',
          200: '#EDD3B0',
          300: '#DBB07A',
          400: '#C68A4D',
          500: '#A66D33',
          600: '#7E5126',
          700: '#5C3B1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        card: '0 4px 16px -4px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
