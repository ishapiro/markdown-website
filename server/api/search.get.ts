interface SearchRow {
  title: string
  slug: string
  content_preview: string
}

function makeSnippet(preview: string, term: string): string {
  const idx = preview.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return preview.slice(0, 200)
  const start = Math.max(0, idx - 100)
  const end = Math.min(preview.length, idx + term.length + 100)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < preview.length ? '…' : ''
  return prefix + preview.slice(start, end) + suffix
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q as string | undefined

  if (!query || query.trim().length < 2) {
    return []
  }

  const d1 = event.context.cloudflare?.env?.DB
  if (!d1) throw createError({ statusCode: 500, message: 'D1 database binding not available' })

  const term = `${query.trim()}*`
  const { results } = await d1
    .prepare('SELECT title, slug, content_preview FROM notes_search WHERE notes_search MATCH ? ORDER BY rank LIMIT 20')
    .bind(term)
    .all() as { results: SearchRow[] }

  return results.map((r: SearchRow) => ({
    title: r.title,
    slug: r.slug,
    snippet: makeSnippet(r.content_preview, query.trim()),
  }))
})
