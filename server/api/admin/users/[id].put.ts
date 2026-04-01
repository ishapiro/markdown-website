import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~/server/utils/db/schema'

const bodySchema = z.object({
  name: z.string().nullable().optional(),
  role: z.enum(['user', 'author', 'admin']).optional(),
  about: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const db = useDb(event)
  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.role !== undefined) updates.role = parsed.data.role
  if (parsed.data.about !== undefined) updates.about = parsed.data.about

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning()
  if (!updated) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
  return updated
})
