import { eq, sql } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'
import { useR2 } from '~/server/utils/r2'

// Soft-delete (unpublish) or hard-delete a note or folder.
// Query param: ?hard=true for permanent deletion.
// When hard-deleting a folder, direct children are moved to the folder's parent path.

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')
  const hard = getQuery(event).hard === 'true'

  const db = useDb(event)
  const note = await db
    .select({ id: notes.id, r2Key: notes.r2Key, isFolder: notes.isFolder, parentPath: notes.parentPath })
    .from(notes)
    .where(eq(notes.slug, slug))
    .get()

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  if (hard) {
    if (note.isFolder) {
      // Move all direct children to this folder's parent path
      await db
        .update(notes)
        .set({ parentPath: note.parentPath, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(notes.parentPath, `/${slug}`))
    } else {
      const r2 = useR2(event)
      await r2.delete(note.r2Key)
    }
    await db.delete(notes).where(eq(notes.id, note.id))
    return { ok: true, deleted: true }
  }

  await db
    .update(notes)
    .set({ isPublished: false, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(notes.id, note.id))

  return { ok: true, unpublished: true }
})
