import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        brand: {
          50: "#effef8",
          100: "#d9fbef",
          200: "#b5f5df",
          300: "#7de9c9",
          400: "#43d4ae",
          500: "#1db893",
          600: "#119577",
          700: "#117761",
          800: "#135e4e",
          900: "#124e42"
        }
      },
      boxShadow: {
        soft: "0 10px 35px -15px rgba(15, 23, 42, .15)",
      },
    },
  },
  plugins: [],
} satisfies Config;
