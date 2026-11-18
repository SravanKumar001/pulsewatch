/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        ink: '#101828',
        muted: '#667085',
        brand: '#635bff',
      },
      boxShadow: {
        card: '0 2px 8px rgba(16, 24, 40, .035), 0 1px 2px rgba(16, 24, 40, .025)',
      },
    },
  },
  plugins: [],
}
