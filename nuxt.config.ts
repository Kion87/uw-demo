export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss", "@netlify/nuxt"],
  css: ["~/assets/css/main.css"],

  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  nitro: {
    preset: "netlify", // Functions mode
    externals: {
      inline: ["@prisma/adapter-pg", "pg"],
    },
  },
});
