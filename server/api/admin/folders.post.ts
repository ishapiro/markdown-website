// Create a folder (virtual section). Protected by the auth middleware.

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { notes } from '~/server/utils/db/schema'

const FolderSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9\-\/]+$/, 'Slug must be lowercase alphanumeric with hyphens/slashes'),
  parentPath: z.string().default('/'),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = FolderSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const { name, slug, parentPath } = parsed.data
  const db = useDb(event)

  const existing = await db
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.slug, slug))
    .get()

  if (existing) {
    throw createError({ statusCode: 409, message: `A page or folder with slug "${slug}" already exists` })
  }

  await db.insert(notes).values({
    title: name,
    slug,
    parentPath,
    contentPreview: '',
    r2Key: '',
    isPublished: true,
    isFolder: true,
  })

  return { ok: true, slug }
})
