import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0f172a", // Deep Black / Slate 900
          light: "#1e293b",   // Slate 800
          dark: "#020617",    // Slate 950
        },
        accent: {
          DEFAULT: "#2563eb", // Refined Bank Blue Accent
          hover: "#1d4ed8",   // Blue 700
          light: "#eff6ff",   // Blue 50
        },
        bank: {
          black: "#0f172a",
          grey: "#475569",
          greyMuted: "#64748b",
          greySubtle: "#f1f5f9",
          surface: "#ffffff",
          bg: "#f8fafc",
          border: "#e2e8f0",
          borderStrong: "#cbd5e1",
          blue: "#2563eb",
          blueLight: "#eff6ff",
          blueBorder: "#bfdbfe",
          text: "#0f172a",
        },
      },
      fontFamily: {
        poppins: ["Poppins", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
