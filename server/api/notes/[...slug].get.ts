import { and, eq } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')

  const db = useDb(event)
  const note = await db
    .select()
    .from(notes)
    .where(and(eq(notes.slug, slug), eq(notes.isPublished, true)))
    .get()

  if (!note) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const content = await blob.get(note.r2Key)
  if (!content) {
    throw createError({ statusCode: 404, message: 'Note content not found in storage' })
  }

  return {
    id: note.id,
    title: note.title,
    slug: note.slug,
    parentPath: note.parentPath,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    content: await content.text(),
  }
})
