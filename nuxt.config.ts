export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@nuxtjs/tailwindcss'],

  hub: {
    blob: true,
  },

  routeRules: {
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    adminEmail: process.env.ADMIN_EMAIL || '',
    public: {
      siteName: 'Cogitations',
      siteDescription: 'A personal knowledge base',
    },
  },

  compatibilityDate: '2024-07-30',

  nitro: {
    rollupConfig: {
      onwarn(warning, warn) {
        // Suppress false-positive warnings from third-party packages
        if (warning.code === 'THIS_IS_UNDEFINED') return
        if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message?.includes('node_modules')) return
        warn(warning)
      },
    },
  },
})
