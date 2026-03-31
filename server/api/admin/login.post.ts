import { computeAdminToken } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  const { password } = await readBody<{ password: string }>(event)
  const config = useRuntimeConfig(event)
  const adminPassword = config.adminPassword as string

  if (!adminPassword || !password || password !== adminPassword) {
    throw createError({ statusCode: 401, message: 'Incorrect password' })
  }

  const token = await computeAdminToken(adminPassword)
  const host = getHeader(event, 'host') ?? ''
  const isLocalDev = host.startsWith('localhost') || host.startsWith('127.0.0.1')

  setCookie(event, 'admin-token', token, {
    httpOnly: true,
    secure: !isLocalDev,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return { ok: true }
})
