import { eq, sql } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

// Soft-delete (unpublish) or hard-delete a note.
// Query param: ?hard=true for permanent deletion.

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')
  const hard = getQuery(event).hard === 'true'

  const db = useDb(event)
  const note = await db
    .select({ id: notes.id, r2Key: notes.r2Key })
    .from(notes)
    .where(eq(notes.slug, slug))
    .get()

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  if (hard) {
    await blob.delete(note.r2Key)
    await db.delete(notes).where(eq(notes.id, note.id))
    return { ok: true, deleted: true }
  }

  await db
    .update(notes)
    .set({ isPublished: false, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(notes.id, note.id))

  return { ok: true, unpublished: true }
})
