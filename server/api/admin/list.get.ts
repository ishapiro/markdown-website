// Returns all notes (published + unpublished) for the admin panel.
export default defineEventHandler(async () => {
  const db = useDatabase()
  const result = await db.sql<{ title: string; slug: string; is_published: number }>`
    SELECT title, slug, is_published FROM notes ORDER BY updated_at DESC
  `
  return result.rows
})
