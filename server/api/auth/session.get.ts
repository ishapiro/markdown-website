import { getOptionalSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await getOptionalSession(event)
  if (!session) return { user: null }
  return {
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      role: session.role,
      googleSub: session.googleSub,
    },
  }
})
