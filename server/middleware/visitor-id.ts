import { getCookie, setCookie } from 'h3'

const VISITOR_COOKIE = 'mw_visitor_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// Sets a persistent anonymous visitor UUID cookie on all public page requests.
// Skipped for API routes and admin pages.
export default defineEventHandler((event) => {
  const path = event.path ?? ''
  if (path.startsWith('/api/') || path.startsWith('/admin/')) return

  if (getCookie(event, VISITOR_COOKIE)) return

  const id = crypto.randomUUID()
  setCookie(event, VISITOR_COOKIE, id, {
    httpOnly: false, // must be readable client-side for the tracking beacon
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
})
