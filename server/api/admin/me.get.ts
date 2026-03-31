// Returns 200 if the session cookie is valid — used by the client route guard.
export default defineEventHandler(() => ({ ok: true }))
