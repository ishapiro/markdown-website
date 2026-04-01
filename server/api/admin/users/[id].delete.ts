import { eq } from 'drizzle-orm'
import { users } from '~/server/utils/db/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, message: 'Invalid user id' })
  }

  const db = useDb(event)
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning()
  if (!deleted) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
  return { ok: true }
})
