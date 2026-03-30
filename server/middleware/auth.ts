// Cloudflare Access middleware: protects all /api/admin/* routes.
// Cloudflare Access injects the `cf-access-authenticated-user-email` header
// after the user authenticates via Zero Trust. If this header is missing the
// request never reached our server through the Access tunnel, so we reject it.
export default defineEventHandler((event) => {
  if (!getRequestPath(event).startsWith('/api/admin')) return

  const userEmail = getHeader(event, 'cf-access-authenticated-user-email')

  if (!userEmail) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: Cloudflare Access authentication required',
    })
  }

  // Attach email to the event context for downstream handlers
  event.context.adminEmail = userEmail
})
