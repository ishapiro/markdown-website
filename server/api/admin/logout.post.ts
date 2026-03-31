export default defineEventHandler((event) => {
  deleteCookie(event, 'admin-token', { path: '/' })
  return { ok: true }
})
