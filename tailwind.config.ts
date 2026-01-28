import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Spec Part 21, Lines 2236-2252: Modern futuristic color palette
        background: "#0A0A0B",
        foreground: "#FAFAFA",
        primary: {
          DEFAULT: "#3B82F6",
          light: "#60A5FA",
          foreground: "#FAFAFA",
        },
        accent: {
          DEFAULT: "#22D3EE",
          foreground: "#0A0A0B",
        },
        muted: {
          DEFAULT: "#71717A",
          foreground: "#A1A1AA",
        },
        border: "#27272A",
        card: {
          DEFAULT: "#18181B",
          foreground: "#FAFAFA",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FAFAFA",
        },
        popover: {
          DEFAULT: "#18181B",
          foreground: "#FAFAFA",
        },
        secondary: {
          DEFAULT: "#27272A",
          foreground: "#FAFAFA",
        },
        input: "#27272A",
        ring: "#3B82F6",
      },
      fontFamily: {
        // Spec Part 21, Lines 2255-2272: Typography using Geist
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        // Spec Part 21, Line 2250-2252: Brand gradient
        "brand-gradient": "linear-gradient(135deg, #A855F7 0%, #22D3EE 100%)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
};

export default config;
