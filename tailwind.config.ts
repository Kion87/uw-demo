import type { Config } from "tailwindcss";

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        nuxt: {
          bg: "rgb(var(--bg) / <alpha-value>)",
          panel: "rgb(var(--panel) / <alpha-value>)",
          border: "rgb(var(--border) / <alpha-value>)",
          text: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--muted) / <alpha-value>)",
          muted2: "rgb(var(--muted-2) / <alpha-value>)",
          green: "rgb(var(--green) / <alpha-value>)",
          gold: "rgb(var(--accent-gold) / <alpha-value>)",
          emerald: "rgb(var(--accent-emerald) / <alpha-value>)",
          orange: "rgb(var(--accent-orange) / <alpha-value>)",
          violet: "rgb(var(--accent-violet) / <alpha-value>)",
          heroFrom: "rgb(var(--hero-from) / <alpha-value>)",
          heroTo: "rgb(var(--hero-to) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
};
