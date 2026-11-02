import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "#EEF0EC", 
        surface: "#F8F9F6", 
        primary: "#23322B",
        secondary: "#55645C", 
        divider: "#C9CFC6", 
        danger: "#B3261E",
        accent: "#E8A317", 
        safe: "#CFE3D4",
      },
      fontFamily: {
        sans: ["var(--font-barlow)", "sans-serif"],
        condensed: ["var(--font-barlow-condensed)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: { none: "0px", sm: "4px" },
      boxShadow: { none: "none" },
    },
  },
  plugins: [],
};
export default config;