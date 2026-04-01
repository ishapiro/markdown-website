import { eq, count } from 'drizzle-orm'
import { users, type User } from '~/server/utils/db/schema'
import { createSession, setSessionCookie } from '~/server/utils/session'
import { getOAuthRedirectUri } from '~/server/utils/oauth-redirect'
import { getRequestURL } from 'h3'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { googleClientId, googleClientSecret, sessionSecret, sessionCookieName, sessionMaxAge } = config
  if (!googleClientId || !googleClientSecret || !sessionSecret) {
    throw createError({ statusCode: 500, message: 'Auth not configured' })
  }

  const query = getQuery(event)
  const code = query.code as string
  const error = query.error as string | undefined
  if (error) {
    return sendRedirect(event, '/admin/login?error=' + encodeURIComponent(error))
  }
  if (!code) {
    return sendRedirect(event, '/admin/login?error=no_code')
  }

  const requestUrl = getRequestURL(event)
  const redirectUri = getOAuthRedirectUri(event)

  console.log(
    '[auth/callback] Token exchange',
    'requestOrigin=', requestUrl.origin,
    'redirectUri=', redirectUri,
    'codePresent=', !!code,
  )

  let tokenRes: { access_token: string }
  try {
    tokenRes = await $fetch<{ access_token: string }>(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    console.log('[auth/callback] Token exchange OK')
  } catch (e) {
    const err = e as any
    console.error(
      '[auth/callback] Token exchange failed',
      'redirect_uri=', redirectUri,
      'message=', err?.message,
      'data=', err?.data,
    )
    return sendRedirect(event, '/admin/login?error=token_exchange_failed')
  }

  let userinfoRes: { sub?: string; id?: string; email?: string; name?: string; picture?: string; [k: string]: unknown }
  try {
    // @ts-expect-error - $fetch infers Nuxt API route types from string literals; GOOGLE_USERINFO_URL is external
    userinfoRes = await $fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    }) as { sub?: string; id?: string; email?: string; name?: string; picture?: string; [k: string]: unknown }
  } catch (e) {
    console.error('[auth/callback] Userinfo fetch failed', e)
    return sendRedirect(event, '/admin/login?error=missing_userinfo')
  }

  // Google userinfo v2 returns "id"; OpenID uses "sub" — accept either
  const googleSubRaw = userinfoRes?.sub ?? userinfoRes?.id
  const googleSub = googleSubRaw != null ? String(googleSubRaw) : ''
  const email = userinfoRes?.email != null ? String(userinfoRes.email) : ''
  if (!googleSub || !email) {
    console.error('[auth/callback] Missing userinfo fields, keys=', Object.keys(userinfoRes || {}))
    return sendRedirect(event, '/admin/login?error=missing_userinfo')
  }
  const name = userinfoRes?.name != null ? String(userinfoRes.name) : null
  const avatarUrl = userinfoRes?.picture != null ? String(userinfoRes.picture) : null

  const db = useDb(event)
  const now = new Date()

  // 1) Look up by Google sub (returning user)
  const existingBySub = await db.select().from(users).where(eq(users.googleSub, googleSub)).limit(1)

  let user: User
  if (existingBySub.length > 0) {
    user = existingBySub[0]
    await db
      .update(users)
      .set({ email, name, avatarUrl, lastLoginAt: now })
      .where(eq(users.id, user.id))
    user = { ...user, email, name, avatarUrl, lastLoginAt: now }
  } else {
    // 2) Look up by email (admin pre-created the user row)
    const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existingByEmail.length > 0) {
      const existingUser = existingByEmail[0]
      console.log('[auth/callback] Linking pre-created user id=', existingUser.id, 'email=', email)
      await db
        .update(users)
        .set({ googleSub, name: name ?? existingUser.name, avatarUrl, lastLoginAt: now })
        .where(eq(users.id, existingUser.id))
      user = { ...existingUser, googleSub, name: name ?? existingUser.name, avatarUrl, lastLoginAt: now }
    } else {
      // 3) New user — first-time Google sign-in.
      // If no users exist yet, make this person the first admin.
      const [{ value: userCount }] = await db.select({ value: count() }).from(users)
      const role = userCount === 0 ? 'admin' : 'user'
      console.log('[auth/callback] Creating new user email=', email, 'role=', role)
      const [inserted] = await db
        .insert(users)
        .values({ email, name, googleSub, avatarUrl, role, createdAt: now, lastLoginAt: now })
        .returning()
      if (!inserted) {
        throw createError({ statusCode: 500, message: 'Failed to create user' })
      }
      user = inserted
    }
  }

  const token = await createSession(
    {
      sub: user.id,
      email: user.email,
      name: user.name ?? null,
      role: user.role as 'user' | 'author' | 'admin',
      googleSub: user.googleSub ?? null,
    },
    sessionSecret,
    sessionMaxAge,
  )
  setSessionCookie(event, sessionCookieName, token, sessionMaxAge)
  const destination = user.role === 'user' ? '/admin/access-denied' : '/admin'
  return sendRedirect(event, destination)
})
