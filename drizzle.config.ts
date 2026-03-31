import { defineConfig } from 'drizzle-kit'

const isRemoteD1 = process.env.DRIZZLE_REMOTE_D1 === '1'

export default defineConfig(
  isRemoteD1
    ? {
        dialect: 'sqlite',
        driver: 'd1-http',
        schema: './server/utils/db/schema.ts',
        out: './drizzle',
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
          databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
          token: process.env.CLOUDFLARE_D1_TOKEN!,
        },
      }
    : {
        dialect: 'sqlite',
        schema: './server/utils/db/schema.ts',
        out: './drizzle',
        dbCredentials: { url: './.data/cogitations-studio.sqlite' },
      },
)
