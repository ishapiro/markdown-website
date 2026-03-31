// Proxy Unsplash photo search. Requires UNSPLASH_ACCESS_KEY in the environment.

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  if (!q) throw createError({ statusCode: 400, message: 'Query required' })

  const config = useRuntimeConfig(event)
  const accessKey = config.unsplashAccessKey as string
  if (!accessKey) {
    throw createError({ statusCode: 503, message: 'Unsplash not configured — add NUXT_UNSPLASH_ACCESS_KEY to .dev.vars' })
  }

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${accessKey}` } },
  )

  if (!res.ok) throw createError({ statusCode: res.status, message: 'Unsplash search failed' })

  const data = await res.json() as { results: Record<string, unknown>[] }

  return data.results.map((photo: Record<string, unknown>) => {
    const urls = photo.urls as Record<string, string>
    const user = photo.user as Record<string, unknown>
    const links = photo.links as Record<string, string>
    const userLinks = (user.links as Record<string, string>) ?? {}
    return {
      id: photo.id as string,
      altDescription: (photo.alt_description ?? photo.description ?? '') as string,
      thumbUrl: urls.thumb,
      regularUrl: urls.regular,
      downloadLocation: links.download_location,
      photographerName: user.name as string,
      photographerUrl: userLinks.html ?? '',
    }
  })
})
