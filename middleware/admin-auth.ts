// Pages only admins may access (authors are excluded)
const ADMIN_ONLY_PAGES = ['/admin/users', '/admin/analytics']

// Protects /admin/* routes.
// - No valid session → /admin/login
// - Valid session but role='user' → /admin/access-denied
// - Valid session but role='author' on admin-only page → /admin/access-denied
// - role='admin' or 'author' (non-restricted page) → allow
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  if (to.path === '/admin/login' || to.path === '/admin/access-denied') return

  // Check Google OAuth session first
  try {
    const session = await $fetch<{ user: { role: string } | null }>('/api/auth/session')
    if (session?.user) {
      if (session.user.role === 'user') return navigateTo('/admin/access-denied')
      if (session.user.role === 'author' && ADMIN_ONLY_PAGES.some(p => to.path.startsWith(p))) {
        return navigateTo('/admin/access-denied')
      }
      return // admin, or author on an allowed page
    }
  } catch {}

  // Fall back to HMAC cookie check (password login — always admin)
  try {
    await $fetch('/api/admin/me')
  } catch {
    return navigateTo('/admin/login')
  }
})
