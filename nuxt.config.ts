export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss", "@netlify/nuxt"],
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap",
        },
      ],
    },
  },

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  nitro: {
    preset: "netlify", // Functions mode
    externals: {
      inline: ["@prisma/adapter-pg", "pg"],
    },
  },
});
