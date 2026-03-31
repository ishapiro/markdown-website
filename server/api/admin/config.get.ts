import { siteConfig } from '~/server/utils/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const row = await db.select().from(siteConfig).get()
  if (!row) {
    throw createError({ statusCode: 503, message: 'Site config not initialised' })
  }
  return row
})
