/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./*.html", "./src/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      colors: {
        sabeel: {
          ivory: '#FAF6F0',
          sage: '#C2D2BD',
          'sage-light': '#EBF2E8',
          raspberry: '#711F35',
          'raspberry-dark': '#581628',
          gold: '#D39E57',
          'gold-light': '#F4E8D7',
          taupe: '#8C7B73',
          'taupe-light': '#F2ECE8',
          dark: '#221F1E'
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
        arabic: ['Amiri', 'serif']
      }
    },
  },
  plugins: [],
}