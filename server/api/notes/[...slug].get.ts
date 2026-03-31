import { eq } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'
import { useR2 } from '~/server/utils/r2'

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')

  const db = useDb(event)
  const d1 = event.context.cloudflare?.env?.DB

  // DEBUG: raw D1 query bypassing Drizzle entirely
  const rawResult = await d1.prepare('SELECT id, slug, is_published FROM notes WHERE slug = ?').bind(slug).first()
  console.log(`[notes] slug="${slug}" rawD1=`, JSON.stringify(rawResult ?? null))

  const note = await db.select().from(notes).where(eq(notes.slug, slug)).get()
  console.log(`[notes] drizzle note=`, JSON.stringify(note ?? null))

  if (!note || !note.isPublished) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  const r2 = useR2(event)
  console.log(`[notes] fetching R2 key: ${note.r2Key}`)
  const content = await r2.get(note.r2Key)
  console.log(`[notes] R2 content found: ${content !== null}`)
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
