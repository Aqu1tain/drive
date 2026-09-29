import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  devServer: { host: '127.0.0.1', port: 3000 },
  modules: ['@nuxtjs/color-mode'],
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        { name: 'color-scheme', content: 'light dark' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'drive-theme',
  },

  routeRules: {
    '/**': { ssr: false },
    '/s/**': { ssr: true },
    '/invite/**': { ssr: true },
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['reka-ui', '@tanstack/vue-query', '@tanstack/vue-virtual', '@lucide/vue', 'vue-sonner', 'markdown-it', 'better-auth/vue'],
    },
  },

  runtimeConfig: {
    databaseUrl: '',
    authSecret: '',
    setupToken: '',
    trustProxy: false,
    storage: {
      driver: 'local',
      localDir: './storage-data',
      s3: {
        endpoint: '',
        region: 'us-east-1',
        bucket: 'drive',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: true,
      },
    },
    smtp: {
      url: '',
      from: 'Drive <drive@localhost>',
    },
    uploadMaxBytes: 5 * 1024 ** 3,
    storageQuotaBytes: 100 * 1024 ** 3,
    activity: {
      retentionDays: 365,
      ipMode: 'hash',
    },
    public: {
      appUrl: 'http://localhost:3000',
      usercontentUrl: 'http://127.0.0.1:3000',
      appName: 'Drive',
      defaultLocale: 'en',
    },
  },

  nitro: {
    experimental: { tasks: true, asyncContext: true },
    scheduledTasks: {
      '0 3 * * *': ['activity:prune'],
      '0 * * * *': ['uploads:sweep'],
    },
  },

  typescript: {
    strict: true,
  },
})
