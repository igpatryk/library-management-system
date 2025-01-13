/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './src/**/*.{js,jsx,ts,tsx}',
      './public/index.html',
    ],
    theme: {
      extend: {
        colors: {
          // Optional: Add custom colors specific to your library app
          'library-primary': '#2c3e50',
          'library-secondary': '#3498db',
        },
        fontFamily: {
          // Optional: Add custom font families
          'sans': ['Inter', 'ui-sans-serif', 'system-ui'],
        }
      },
    },
    plugins: [],
  }