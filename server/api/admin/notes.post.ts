// Create or update a note. Protected by the auth middleware.

import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { notes } from '~/server/utils/db/schema'

const NoteSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9\-\/]+$/, 'Slug must be lowercase alphanumeric with hyphens/slashes'),
  parent_path: z.string().default('/'),
  content: z.string(),
  is_published: z.boolean().default(true),
  created_at: z.string().optional(), // YYYY-MM-DD; if omitted, DB default is preserved on update
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = NoteSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const { title, slug, parent_path, content, is_published, created_at } = parsed.data
  const r2Key = `notes/${slug}.md`
  const contentPreview = content.replace(/#+\s/g, '').replace(/\n/g, ' ').slice(0, 200)

  // Upload full content to blob storage (R2 in production, local in dev)
  await blob.put(r2Key, content, {
    contentType: 'text/markdown',
    addRandomSuffix: false,
  })

  const db = useDb(event)
  const existing = await db
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.slug, slug))
    .get()

  if (existing) {
    await db
      .update(notes)
      .set({
        title,
        parentPath: parent_path,
        contentPreview,
        r2Key,
        isPublished: is_published,
        updatedAt: sql`CURRENT_TIMESTAMP`,
        ...(created_at ? { createdAt: created_at } : {}),
      })
      .where(eq(notes.slug, slug))
  } else {
    await db
      .insert(notes)
      .values({
        title,
        slug,
        parentPath: parent_path,
        contentPreview,
        r2Key,
        isPublished: is_published,
        ...(created_at ? { createdAt: created_at } : {}),
      })
  }

  return { ok: true, slug }
})
