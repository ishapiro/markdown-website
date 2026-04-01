import { deleteCookie, getCookie, setCookie } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import type { H3Event } from 'h3'

export interface SessionPayload {
  sub: number // user id
  email: string
  name: string | null
  role: 'user' | 'author' | 'admin'
  googleSub: string | null
}

const encoder = new TextEncoder()

function getSecret(secret: string): Uint8Array {
  return encoder.encode(secret)
}

export async function createSession(
  payload: SessionPayload,
  secret: string,
  maxAgeSeconds: number,
): Promise<string> {
  const { sub, ...rest } = payload
  const token = await new SignJWT({ ...rest, sub: String(sub) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSecret(secret))
  return token
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(secret))
    const raw = payload as unknown as Omit<SessionPayload, 'sub'> & { sub: string }
    return { ...raw, sub: Number(raw.sub) }
  } catch {
    return null
  }
}

export function getSessionCookie(event: H3Event, cookieName: string): string | null {
  const cookie = getCookie(event, cookieName)
  return cookie ?? null
}

export function setSessionCookie(
  event: H3Event,
  cookieName: string,
  token: string,
  maxAgeSeconds: number,
) {
  setCookie(event, cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

export function clearSessionCookie(event: H3Event, cookieName: string) {
  deleteCookie(event, cookieName, { path: '/' })
}
