import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0E1B2C",
          50: "#F4F6F8",
          100: "#E4E9EE",
          400: "#5C7086",
          700: "#1A2C42",
          900: "#0E1B2C",
        },
        marine: {
          DEFAULT: "#1D4E6B",
          50: "#EEF4F7",
          100: "#D7E5EC",
          400: "#3E7597",
          600: "#1D4E6B",
          700: "#163C54",
        },
        copper: {
          DEFAULT: "#B8622A",
          50: "#FBF1EA",
          100: "#F3DCC8",
          400: "#C97A44",
          600: "#B8622A",
          700: "#8F4B1F",
        },
        paper: {
          DEFAULT: "#F3F4F1",
          100: "#FFFFFF",
          200: "#EBECE8",
        },
        verified: {
          DEFAULT: "#2F6F4E",
          50: "#EAF3EE",
          600: "#2F6F4E",
        },
        slate: {
          DEFAULT: "#1F2937",
          500: "#5B6472",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        lg: "12px",
      },
      spacing: {
        // Keeps the button size rhythm on an 8px step: sm h-9 (36) → md h-11 (44) → lg h-13 (52).
        "13": "3.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
