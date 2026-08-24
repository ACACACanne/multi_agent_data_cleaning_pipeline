// frontend/tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        "brand-dark": "var(--color-brand-dark)",
        "brand-light": "var(--color-brand-light)",
        "brand-accent": "var(--color-brand-accent)",
      },
    },
  },
  plugins: [],
};
