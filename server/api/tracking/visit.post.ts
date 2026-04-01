import { z } from 'zod'
import { getCookie } from 'h3'
import { pageVisits } from '~/server/utils/db/schema'
import { getOptionalSession } from '~/server/utils/auth'

const bodySchema = z.object({
  path: z.string().max(500),
  startedAt: z.number().int(),
  durationSeconds: z.number().int().nullable().optional(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
})

function normalizePath(raw: string): string {
  try {
    const url = new URL(raw, 'https://placeholder.invalid')
    let p = url.pathname.toLowerCase().replace(/\/+$/, '') || '/'
    return p
  } catch {
    return raw.split('?')[0].toLowerCase().replace(/\/+$/, '') || '/'
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const { path, startedAt, durationSeconds, referrer, utmSource, utmMedium, utmCampaign } = parsed.data

  const visitorId = getCookie(event, 'mw_visitor_id') ?? null
  const session = await getOptionalSession(event)
  const userId = session?.sub ?? null

  // Get geo from Cloudflare cf object (only available in production)
  const cf = (event.context as any).cloudflare?.request?.cf as Record<string, unknown> | undefined
  const country = typeof cf?.country === 'string' ? cf.country.slice(0, 2) : null
  const city = typeof cf?.city === 'string' ? String(cf.city).slice(0, 100) : null

  const db = useDb(event)
  await db.insert(pageVisits).values({
    userId,
    visitorId,
    path: normalizePath(path),
    startedAt: new Date(startedAt * 1000),
    durationSeconds: durationSeconds ?? null,
    referrer: referrer?.slice(0, 500) ?? null,
    utmSource: utmSource?.slice(0, 100) ?? null,
    utmMedium: utmMedium?.slice(0, 100) ?? null,
    utmCampaign: utmCampaign?.slice(0, 100) ?? null,
    country,
    city,
  })

  return { ok: true }
})
