import { computeAdminToken } from '~/server/utils/adminAuth'
import { getSessionCookie, verifySession } from '~/server/utils/session'

// Routes only admins may access (authors are excluded)
const ADMIN_ONLY_PREFIXES = [
  '/api/admin/users',
  '/api/admin/analytics',
]

// Protects all /api/admin/* routes (except /api/admin/login).
// Accepts:
//   1. Legacy HMAC admin-token cookie (password login) — always grants full admin access
//   2. JWT mw_session cookie with role='admin' — full access
//   3. JWT mw_session cookie with role='author' — content routes only (not users/analytics)
export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)
  if (!path.startsWith('/api/admin')) return
  if (path === '/api/admin/login') return  // always public

  const config = useRuntimeConfig(event)

  // Path 1: HMAC cookie (password login — always admin)
  const hmacToken = getCookie(event, 'admin-token')
  if (hmacToken) {
    const adminPassword = config.adminPassword as string
    if (adminPassword) {
      const expected = await computeAdminToken(adminPassword)
      if (hmacToken === expected) return
    }
  }

  // Path 2: JWT session cookie
  const { sessionSecret, sessionCookieName } = config
  if (sessionSecret) {
    const jwtToken = getSessionCookie(event, sessionCookieName)
    if (jwtToken) {
      const payload = await verifySession(jwtToken, sessionSecret)
      if (payload?.role === 'admin') return

      // Authors can access content routes but not user management or analytics
      if (payload?.role === 'author') {
        const isAdminOnly = ADMIN_ONLY_PREFIXES.some(prefix => path.startsWith(prefix))
        if (!isAdminOnly) return
        throw createError({ statusCode: 403, message: 'Admin access required' })
      }
    }
  }

  throw createError({ statusCode: 401, message: 'Not authenticated' })
})
