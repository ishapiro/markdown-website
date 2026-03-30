export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@nuxtjs/tailwindcss'],

  hub: {
    // database handled by Nitro useDatabase() — blob still via NuxtHub
    blob: true,
  },

  nitro: {
    experimental: {
      database: true,
    },
    // Dev: better-sqlite3 at .data/db.sqlite3 (Node 20 compatible)
    // Production: connector is overridden to cloudflare-d1 via NITRO_DATABASE_DEFAULT_CONNECTOR env var,
    // or by setting database.default.connector = 'cloudflare-d1' in a production nuxt.config override.
    database: {
      default: {
        connector: 'better-sqlite3',
        options: { cwd: '.' },
      },
    },
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
})
