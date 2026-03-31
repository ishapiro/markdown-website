// Download an Unsplash photo, save it to R2, and return a local URL.
// Triggers the required Unsplash download event for API compliance.

import { useR2, mimeToExt } from '~/server/utils/r2'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { regularUrl: string; downloadLocation: string; altDescription: string }
  const { regularUrl, downloadLocation } = body

  if (!regularUrl) throw createError({ statusCode: 400, message: 'regularUrl required' })

  const config = useRuntimeConfig(event)
  const accessKey = config.unsplashAccessKey as string
  if (!accessKey) {
    throw createError({ statusCode: 503, message: 'Unsplash not configured — add NUXT_UNSPLASH_ACCESS_KEY to .dev.vars' })
  }

  // Required by Unsplash API terms: trigger download event
  if (downloadLocation) {
    await fetch(`${downloadLocation}?client_id=${accessKey}`).catch(() => {})
  }

  const imgRes = await fetch(regularUrl)
  if (!imgRes.ok) throw createError({ statusCode: 500, message: 'Failed to download Unsplash image' })

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const mimeType = contentType.split(';')[0].trim()
  const ext = mimeToExt(mimeType)
  const key = `images/${Date.now()}-unsplash.${ext}`

  const r2 = useR2(event)
  await r2.put(key, await imgRes.arrayBuffer(), { httpMetadata: { contentType: mimeType } })

  return { url: `/api/images/${key}` }
})
