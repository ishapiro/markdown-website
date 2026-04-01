export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],

  routeRules: {
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    adminPassword: '',        // NUXT_ADMIN_PASSWORD
    systemGeminiKey: '',      // NUXT_SYSTEM_GEMINI_KEY
    unsplashAccessKey: '',    // NUXT_UNSPLASH_ACCESS_KEY
    googleClientId: '',       // NUXT_GOOGLE_CLIENT_ID
    googleClientSecret: '',   // NUXT_GOOGLE_CLIENT_SECRET
    sessionSecret: '',        // NUXT_SESSION_SECRET (openssl rand -base64 32)
    sessionCookieName: 'mw_session',
    sessionMaxAge: 60 * 60 * 24 * 7, // 7 days
    oauthRedirectOrigin: '',  // NUXT_OAUTH_REDIRECT_ORIGIN (leave empty — auto-detected)
    public: {},
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
