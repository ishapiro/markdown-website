import { computeAdminToken } from '~/server/utils/adminAuth'

// Protects all /api/admin/* routes (except /api/admin/login).
// Validates the httpOnly admin-token cookie set on login.
export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)
  if (!path.startsWith('/api/admin')) return
  if (path === '/api/admin/login') return   // login endpoint is always public

  const config = useRuntimeConfig(event)
  const adminPassword = config.adminPassword as string

  if (!adminPassword) {
    throw createError({ statusCode: 503, message: 'Admin password not configured — add NUXT_ADMIN_PASSWORD to .dev.vars' })
  }

  const token = getCookie(event, 'admin-token')
  if (!token) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const expected = await computeAdminToken(adminPassword)
  if (token !== expected) {
    throw createError({ statusCode: 401, message: 'Invalid session' })
  }
})
