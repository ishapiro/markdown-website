import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { siteConfig } from '~/server/utils/db/schema'

const urlOrEmpty = z.string().url().or(z.literal(''))

const ConfigSchema = z.object({
  siteTitle: z.string().min(1).max(255),
  siteTagline: z.string().max(500),
  siteLogoKey: z.string().max(500),
  copyrightNotice: z.string().max(255),
  authorName: z.string().max(255),
  authorEmail: z.string().email().or(z.literal('')),
  twitterUrl: urlOrEmpty,
  githubUrl: urlOrEmpty,
  linkedinUrl: urlOrEmpty,
  mastodonUrl: urlOrEmpty,
  ogImageUrl: urlOrEmpty,
  faviconUrl: urlOrEmpty,
  robotsMeta: z.enum(['index,follow', 'noindex,nofollow', 'noindex,follow', 'index,nofollow']),
  analyticsId: z.string().max(100),
  unsplashAttributionSource: z.string().max(100),
  homePage: z.string().min(1).max(255).startsWith('/'),
  fontFamily: z.enum(['fraunces-manrope', 'geist', 'manrope', 'inter']),
  fontSize: z.enum(['xs', 'sm', 'md', 'lg']),
  backgroundPreset: z.enum(['white', 'cream', 'sand', 'gray']),
  contentWidth: z.enum(['narrow', 'medium', 'wide']),
  textStyle: z.enum(['classic', 'navy-bold']),
  headingColor: z.enum(['default', 'navy', 'charcoal', 'accent']),
  headingRuleStyle: z.enum(['short', 'full', 'none']),
  h2RuleColor: z.enum(['green', 'accent', 'navy', 'charcoal']),
  logoSize: z.enum(['sm', 'md', 'lg', 'xl']),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = ConfigSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }
  const db = useDb(event)
  await db.update(siteConfig).set(parsed.data).where(eq(siteConfig.id, 1))
  return { ok: true }
})
