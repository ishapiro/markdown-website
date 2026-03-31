import { siteConfig } from '~/server/utils/db/schema'

// Public fields — safe to expose without authentication
const PUBLIC_FIELDS = [
  'siteTitle', 'siteTagline', 'siteLogoKey', 'copyrightNotice', 'authorName',
  'twitterUrl', 'githubUrl', 'linkedinUrl', 'mastodonUrl',
  'ogImageUrl', 'faviconUrl', 'robotsMeta',
] as const

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const row = await db.select().from(siteConfig).get()
  if (!row) {
    throw createError({ statusCode: 503, message: 'Site config not initialised' })
  }
  return Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, row[k]]))
})
