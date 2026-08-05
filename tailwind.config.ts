import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
