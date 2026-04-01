// Patch a note's sort_order without requiring all fields.

import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { notes } from '~/server/utils/db/schema'

const PatchSchema = z.object({
  sort_order: z.number().int().nullable(),
})

export default defineEventHandler(async (event) => {
  const slugParts = getRouterParam(event, 'slug') as string
  const slug = slugParts.replace(/^\//, '')

  const body = await readBody(event)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const db = useDb(event)
  const result = await db
    .update(notes)
    .set({ sortOrder: parsed.data.sort_order, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(notes.slug, slug))

  if (!result) {
    throw createError({ statusCode: 404, message: 'Note not found' })
  }

  return { ok: true }
})
