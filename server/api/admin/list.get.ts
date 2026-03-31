import { desc } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

// Returns all notes (published + unpublished) for the admin panel.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const results = await db
    .select({ title: notes.title, slug: notes.slug, is_published: notes.isPublished })
    .from(notes)
    .orderBy(desc(notes.updatedAt))
  return results
})
