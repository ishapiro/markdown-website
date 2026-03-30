// Create or update a note. Protected by the auth middleware.

import { z } from 'zod'

const NoteSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9\-\/]+$/, 'Slug must be lowercase alphanumeric with hyphens/slashes'),
  parent_path: z.string().default('/'),
  content: z.string(),
  is_published: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = NoteSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const { title, slug, parent_path, content, is_published } = parsed.data
  const r2Key = `notes/${slug}.md`
  const contentPreview = content.replace(/#+\s/g, '').replace(/\n/g, ' ').slice(0, 200)

  const db = useDatabase()

  // Upload full content to blob storage (R2 in production, fs in dev)
  await blob.put(r2Key, content, {
    contentType: 'text/markdown',
    addRandomSuffix: false,
  })

  // Check if note exists
  const existing = await db.sql<{ id: number }>`SELECT id FROM notes WHERE slug = ${slug}`
  const existingRow = existing.rows[0]

  if (existingRow) {
    await db.sql`
      UPDATE notes
      SET title = ${title},
          parent_path = ${parent_path},
          content_preview = ${contentPreview},
          r2_key = ${r2Key},
          is_published = ${is_published ? 1 : 0},
          updated_at = CURRENT_TIMESTAMP
      WHERE slug = ${slug}
    `
  } else {
    await db.sql`
      INSERT INTO notes (title, slug, parent_path, content_preview, r2_key, is_published)
      VALUES (${title}, ${slug}, ${parent_path}, ${contentPreview}, ${r2Key}, ${is_published ? 1 : 0})
    `
  }

  return { ok: true, slug }
})
