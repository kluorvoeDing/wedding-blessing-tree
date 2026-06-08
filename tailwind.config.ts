import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        blush: "#f7d9d9",
        rose: "#d98f95",
        champagne: "#f6ecd9",
        sage: "#a9b9a7",
        ink: "#49363c"
      },
      boxShadow: {
        card: "0 20px 40px rgba(107, 74, 82, 0.12)"
      },
      backgroundImage: {
        bloom:
          "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(246,236,217,0.85) 38%, rgba(247,217,217,0.55) 100%)"
      }
    }
  },
  plugins: []
};

export default config;
