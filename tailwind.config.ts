import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ShipMova design system (redesign PR A). "black" is the brand
        // near-black, so every existing bg-black / text-black follows it.
        black: "#0A0A0B",
        ink: "#0A0A0B",
        band: "#F3F3F1", // light section band
        muted: "#555555", // body grey
        line: "#E4E4E4", // borders
        // Status badge colors — unchanged by the redesign.
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
        verified: {
          DEFAULT: "#2F6F4E",
          50: "#EAF3EE",
          600: "#2F6F4E",
        },
      },
      fontFamily: {
        // DM Sans for body, Archivo for headings (app/layout.tsx). Monospace
        // (VINs, references) is the device's own — no font download.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        lg: "12px",
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(10, 10, 11, 0.04), 0 4px 16px rgba(10, 10, 11, 0.06)",
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
