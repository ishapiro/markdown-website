// Hybrid fetch: metadata from D1 (via Nitro useDatabase), content from R2 (via NuxtHub blob).

interface NoteRow {
  id: number
  title: string
  slug: string
  parent_path: string
  r2_key: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')

  const db = useDatabase()
  const result = await db.sql<NoteRow>`
    SELECT id, title, slug, parent_path, r2_key, updated_at
    FROM notes
    WHERE slug = ${slug} AND is_published = 1
  `
  const note = result.rows[0]

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  // Fetch raw Markdown from blob storage (R2 in production, fs in dev)
  const content = await blob.get(note.r2_key)
  if (!content) {
    throw createError({ statusCode: 404, message: 'Note content not found in storage' })
  }

  return {
    id: note.id,
    title: note.title,
    slug: note.slug,
    parentPath: note.parent_path,
    updatedAt: note.updated_at,
    content: await content.text(),
  }
})
