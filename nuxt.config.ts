export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],

  routeRules: {
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    adminPassword: '',   // set via NUXT_ADMIN_PASSWORD in .dev.vars / Cloudflare secret
    systemGeminiKey: '',     // set via NUXT_SYSTEM_GEMINI_KEY in .dev.vars / Cloudflare secret
    unsplashAccessKey: '',   // set via NUXT_UNSPLASH_ACCESS_KEY in .dev.vars / Cloudflare secret
    public: {
      siteName: 'Cogitations',
      siteDescription: 'A personal knowledge base',
    },
  },

  compatibilityDate: '2024-09-19',

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: false, // use root wrangler.toml so local D1 lives in .wrangler/ and persists across builds
      nodeCompat: true,
    },
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
