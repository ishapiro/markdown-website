// Full-text search over the notes_search FTS5 virtual table.

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

  const db = useDatabase()
  const term = `${query.trim()}*`

  const result = await db.sql<SearchRow>`
    SELECT title, slug, content_preview
    FROM notes_search
    WHERE notes_search MATCH ${term}
    ORDER BY rank
    LIMIT 20
  `

  return result.rows
})
