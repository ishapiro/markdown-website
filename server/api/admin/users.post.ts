import { z } from 'zod'
import { users } from '~/server/utils/db/schema'

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['user', 'author', 'admin']).default('user'),
  about: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const db = useDb(event)
  const now = new Date()
  const [user] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      role: parsed.data.role,
      about: parsed.data.about ?? null,
      createdAt: now,
    })
    .returning()

  if (!user) {
    throw createError({ statusCode: 500, message: 'Failed to create user' })
  }
  return user
})
