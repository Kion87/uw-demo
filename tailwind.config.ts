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
          green: "rgb(var(--green) / <alpha-value>)",
        },
      },
    },
  },
};
