import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'

export function getOAuthRedirectUri(event: H3Event, callbackPath = '/api/auth/callback'): string {
  const config = useRuntimeConfig(event)
  const override = (config as { oauthRedirectOrigin?: string }).oauthRedirectOrigin
  if (override && typeof override === 'string' && override.trim().length > 0) {
    const base = override.replace(/\/$/, '')
    return base + callbackPath
  }

  const requestUrl = getRequestURL(event)
  return requestUrl.origin + callbackPath
}
