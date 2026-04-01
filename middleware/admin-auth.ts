// Protects /admin/* routes.
// - No valid session → /admin/login
// - Valid session but role='user' → /admin/access-denied
// - role='admin' or 'author' → allow
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  if (to.path === '/admin/login' || to.path === '/admin/access-denied') return

  // Check Google OAuth session first
  try {
    const session = await $fetch<{ user: { role: string } | null }>('/api/auth/session')
    if (session?.user) {
      if (session.user.role === 'user') return navigateTo('/admin/access-denied')
      return // admin or author — allow
    }
  } catch {}

  // Fall back to HMAC cookie check (password login)
  try {
    await $fetch('/api/admin/me')
  } catch {
    return navigateTo('/admin/login')
  }
})
