import { clearSessionCookie } from '~/server/utils/session'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  clearSessionCookie(event, config.sessionCookieName)
  return sendRedirect(event, '/admin/login')
})
