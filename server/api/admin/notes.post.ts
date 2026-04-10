// Create or update a note. Protected by the auth middleware.

import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { notes } from '~/server/utils/db/schema'
import { useR2 } from '~/server/utils/r2'

const NoteSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9\s\-\/]+$/, 'Slug must be lowercase alphanumeric with hyphens/slashes'),
  parent_path: z.string().default('/'),
  content: z.string(),
  is_published: z.boolean().default(true),
  show_date: z.boolean().default(true),
  created_at: z.string().optional(), // YYYY-MM-DD; if omitted, DB default is preserved on update
  sort_order: z.number().int().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = NoteSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  function normalizeSlugPath(raw: string): string {
    return raw
      .split('/')
      .map((seg) => seg.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean)
      .join('/')
  }

  const slug = normalizeSlugPath(parsed.data.slug)
  const { title, content, is_published, show_date, created_at, sort_order } = parsed.data
  const rawParent = parsed.data.parent_path
  const parent_path = rawParent === '/' ? '/' : '/' + normalizeSlugPath(rawParent.replace(/^\//, ''))
  const r2Key = `notes/${slug}.md`
  const cleaned = content.replace(/#+\s/g, '').replace(/\n/g, ' ')
  const contentPreview = cleaned.length > 21000
    ? cleaned.slice(0, 20000) + ' ' + cleaned.slice(-1000)
    : cleaned.slice(0, 20000)

  const r2 = useR2(event)
  await r2.put(r2Key, content, { httpMetadata: { contentType: 'text/markdown' } })

  const db = useDb(event)
  let existing
  try {
    existing = await db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.slug, slug))
      .get()
  } catch (e) {
    console.error('[notes.post] select error:', (e as Error).message)
    throw createError({ statusCode: 500, message: `DB select failed: ${(e as Error).message}` })
  }

  if (existing) {
    await db
      .update(notes)
      .set({
        title,
        parentPath: parent_path,
        contentPreview,
        r2Key,
        isPublished: is_published,
        showDate: show_date,
        updatedAt: sql`CURRENT_TIMESTAMP`,
        ...(created_at ? { createdAt: created_at } : {}),
        ...(sort_order !== undefined ? { sortOrder: sort_order } : {}),
      })
      .where(eq(notes.slug, slug))
  } else {
    try {
      await db
        .insert(notes)
        .values({
          title,
          slug,
          parentPath: parent_path,
          contentPreview,
          r2Key,
          isPublished: is_published,
          showDate: show_date,
          ...(created_at ? { createdAt: created_at } : {}),
          ...(sort_order !== undefined ? { sortOrder: sort_order } : {}),
        })
    } catch (e) {
      console.error('[notes.post] insert error:', (e as Error).message)
      throw createError({ statusCode: 500, message: `DB insert failed: ${(e as Error).message}` })
    }
  }

  return { ok: true, slug }
})
