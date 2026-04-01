import type { H3Event } from 'h3'
import { getSessionCookie, verifySession, type SessionPayload } from '~/server/utils/session'

export async function getOptionalSession(event: H3Event): Promise<SessionPayload | null> {
  const config = useRuntimeConfig(event)
  const { sessionSecret, sessionCookieName } = config
  if (!sessionSecret) return null
  const token = getSessionCookie(event, sessionCookieName)
  if (!token) return null
  const payload = await verifySession(token, sessionSecret)
  return typeof payload === 'object' && payload !== null ? payload : null
}

export async function requireSession(event: H3Event): Promise<SessionPayload> {
  const session = await getOptionalSession(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return session
}

export async function requireAdmin(event: H3Event): Promise<SessionPayload> {
  const session = await requireSession(event)
  if (session.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return session
}
