// Soft-delete (unpublish) or hard-delete a note.
// Query param: ?hard=true for permanent deletion.

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')
  const hard = getQuery(event).hard === 'true'

  const db = useDatabase()
  const result = await db.sql<{ id: number; r2_key: string }>`
    SELECT id, r2_key FROM notes WHERE slug = ${slug}
  `
  const note = result.rows[0]

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  if (hard) {
    await blob.del(note.r2_key)
    await db.sql`DELETE FROM notes WHERE id = ${note.id}`
    return { ok: true, deleted: true }
  }

  await db.sql`
    UPDATE notes SET is_published = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ${note.id}
  `

  return { ok: true, unpublished: true }
})
