import { eq } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'
import { useR2 } from '~/server/utils/r2'

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')

  const db = useDb(event)
  const note = await db.select().from(notes).where(eq(notes.slug, slug)).get()

  if (!note || !note.isPublished) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const r2 = useR2(event)
  const content = await r2.get(note.r2Key)
  if (!content) {
    throw createError({ statusCode: 404, message: `Note content not found in R2 storage (key: ${note.r2Key})` })
  }

  return {
    id: note.id,
    title: note.title,
    slug: note.slug,
    parentPath: note.parentPath,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    sortOrder: note.sortOrder,
    showDate: note.showDate,
    content: await content.text(),
  }
})
