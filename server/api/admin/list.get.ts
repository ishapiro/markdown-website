import { asc, desc } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

// Returns all notes (published + unpublished) for the admin panel.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const results = await db
    .select({
      title: notes.title,
      slug: notes.slug,
      isPublished: notes.isPublished,
      parentPath: notes.parentPath,
      sortOrder: notes.sortOrder,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .orderBy(asc(notes.parentPath), desc(notes.createdAt))
  return results
})
