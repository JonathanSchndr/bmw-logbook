export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'BMW Logbook',
      short_name: 'BMW Log',
      description: 'Digital driving logbook for BMW vehicles — Finanzamt compliant',
      theme_color: '#1d4ed8',
      background_color: '#f9fafb',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: null,
      runtimeCaching: [
        {
          urlPattern: /^\/api\//,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 } },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },

  compatibilityDate: '2025-05-15',
})
