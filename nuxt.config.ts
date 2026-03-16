export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bmw-logbook',
    sessionSecret: process.env.NUXT_SESSION_SECRET || 'change-this-to-random-string-min-32-chars',
    public: {
      appName: 'BMW Logbook',
    },
  },

  nitro: {
    plugins: ['~~/server/plugins/01.mqtt.ts'],
    experimental: {
      wasm: false,
    },
  },

  typescript: {
    strict: true,
    shim: false,
  },

  app: {
    head: {
      title: 'BMW Logbook',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Digital driving logbook for BMW vehicles — compliant with German Tax Office requirements' },
      ],
      link: [],
    },
  },

  compatibilityDate: '2025-05-15',
})
