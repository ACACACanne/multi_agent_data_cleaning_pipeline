export default {
  plugins: {
    "@tailwindcss/postcss": {
      config: "./tailwind.css", // only if you want the plugin to use that engine file
    },
    autoprefixer: {},
  },
};
