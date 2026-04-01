import { sql, gte, desc } from 'drizzle-orm'
import { pageVisits } from '~/server/utils/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)

  // 30 days ago as unix timestamp
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Top 20 pages by visit count (last 30 days)
  const topPages = await db
    .select({
      path: pageVisits.path,
      visits: sql<number>`count(*)`.as('visits'),
    })
    .from(pageVisits)
    .where(gte(pageVisits.startedAt, thirtyDaysAgo))
    .groupBy(pageVisits.path)
    .orderBy(desc(sql`count(*)`))
    .limit(20)

  // Total unique visitors (last 30 days) — by visitorId or userId
  const uniqueVisitorRows = await db
    .select({
      visitorId: pageVisits.visitorId,
      userId: pageVisits.userId,
    })
    .from(pageVisits)
    .where(gte(pageVisits.startedAt, thirtyDaysAgo))

  const uniqueKeys = new Set<string>()
  for (const row of uniqueVisitorRows) {
    if (row.userId != null) uniqueKeys.add(`u:${row.userId}`)
    else if (row.visitorId) uniqueKeys.add(`v:${row.visitorId}`)
  }
  const uniqueVisitors = uniqueKeys.size

  // Total visits (last 30 days)
  const totalVisits = uniqueVisitorRows.length

  // Recent 50 visits
  const recentVisits = await db
    .select({
      id: pageVisits.id,
      path: pageVisits.path,
      startedAt: pageVisits.startedAt,
      country: pageVisits.country,
      referrer: pageVisits.referrer,
      userId: pageVisits.userId,
    })
    .from(pageVisits)
    .orderBy(desc(pageVisits.startedAt))
    .limit(50)

  return { topPages, uniqueVisitors, totalVisits, recentVisits }
})
