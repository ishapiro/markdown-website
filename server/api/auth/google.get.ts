import { getOAuthRedirectUri } from '~/server/utils/oauth-redirect'
import { getRequestURL } from 'h3'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const clientId = config.googleClientId
  if (!clientId) {
    throw createError({ statusCode: 500, message: 'Google OAuth not configured' })
  }

  const requestUrl = getRequestURL(event)
  const redirectUri = getOAuthRedirectUri(event)

  console.log(
    '[auth/google] SSO init',
    'requestOrigin=', requestUrl.origin,
    'redirectUri=', redirectUri,
    'clientId=', clientId ? '(set)' : '(missing)',
  )

  const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return sendRedirect(event, url.toString())
})
