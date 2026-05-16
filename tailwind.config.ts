import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        cream: "#fbf1ea",
        parchment: "#f5e9df",
        ink: "#063f27",
        moss: "#0f5335",
        fern: "#557c5b",
        mist: "#d8e7dd",
        clay: "#bd7658",
        ember: "#e7784b",
        gold: "#c99d3e",
        ice: "#cdebf0"
      },
      boxShadow: {
        soft: "0 22px 70px rgba(43, 32, 24, 0.12)",
        card: "0 18px 45px rgba(47, 36, 27, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
