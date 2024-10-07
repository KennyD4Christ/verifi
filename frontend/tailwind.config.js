module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      backgroundImage: {
        'custom-pattern': "url('./public/pattern.svg')",
      },
    },
  },
  plugins: [],
}
