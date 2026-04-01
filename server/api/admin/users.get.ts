import { desc } from 'drizzle-orm'
import { users } from '~/server/utils/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return db.select().from(users).orderBy(desc(users.createdAt))
})
