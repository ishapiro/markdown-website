interface SearchRow {
  title: string
  slug: string
  content_preview: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q as string | undefined

  if (!query || query.trim().length < 2) {
    return []
  }

  // FTS5 virtual tables are not supported by Drizzle ORM, so we use the raw D1 client.
  const d1 = event.context.cloudflare?.env?.DB
  if (!d1) throw createError({ statusCode: 500, message: 'D1 database binding not available' })

  const term = `${query.trim()}*`
  const { results } = await d1
    .prepare('SELECT title, slug, content_preview FROM notes_search WHERE notes_search MATCH ? ORDER BY rank LIMIT 20')
    .bind(term)
    .all<SearchRow>()

  return results
})
