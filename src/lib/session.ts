import "server-only"

import { cookies } from "next/headers"

import { sessionSecret } from "./env"
import { refreshGoogleToken } from "./google"
import { sealJson, unsealJson } from "./seal"

export const SESSION_COOKIE = "mnt_session"
export const STATE_COOKIE = "mnt_oauth_state"

export type CalendarSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email: string
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

export async function readCalendarSession() {
  const secret = sessionSecret()
  if (!secret) return null
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const session = unsealJson<CalendarSession>(raw, secret)
  if (!session?.accessToken || !session.refreshToken || !session.expiresAt) return null
  return session
}

export async function writeCalendarSession(session: CalendarSession) {
  const secret = sessionSecret()
  if (!secret) return
  const jar = await cookies()
  jar.set(SESSION_COOKIE, sealJson(session, secret), sessionCookieOptions(60 * 60 * 24 * 30))
}

export async function ensureFreshSession(session: CalendarSession) {
  if (session.expiresAt > Date.now() + 60_000) return session
  const token = await refreshGoogleToken(session.refreshToken)
  const next: CalendarSession = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || session.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    email: session.email,
  }
  await writeCalendarSession(next)
  return next
}
