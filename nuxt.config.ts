export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/main.css"],

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  nitro: {
    preset: "netlify",
    externals: {
      inline: ["@prisma/adapter-pg", "pg"],
    },
  },
});
