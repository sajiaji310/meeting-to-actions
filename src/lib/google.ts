import "server-only"

import { AppError } from "./errors"
import { googleConfig } from "./env"
import type { PlannedEvent } from "./events"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ")

export type GoogleToken = {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export function googleAuthorizationUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}) {
  const url = new URL(AUTH_URL)
  url.searchParams.set("client_id", input.clientId)
  url.searchParams.set("redirect_uri", input.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", SCOPES)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", input.state)
  return url.toString()
}

async function postToken(body: URLSearchParams): Promise<GoogleToken> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  })
  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error_description" in data
        ? String((data as { error_description?: unknown }).error_description ?? "")
        : ""
    throw new AppError(
      message
        ? `Google 授权失败：${message.slice(0, 160)}`
        : "Google 授权失败，没有拿到访问令牌。",
      401,
      "GOOGLE_TOKEN",
    )
  }
  const token = data as GoogleToken
  if (!token.access_token || !token.expires_in) {
    throw new AppError("Google 返回的令牌不完整。", 401, "GOOGLE_TOKEN")
  }
  return token
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const config = googleConfig()
  return postToken(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  )
}

export async function refreshGoogleToken(refreshToken: string) {
  const config = googleConfig()
  return postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  )
}

export async function fetchGoogleEmail(accessToken: string) {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return null
  const data = (await response.json().catch(() => null)) as { email?: string } | null
  return data?.email ?? null
}

export function toGoogleEvent(event: PlannedEvent) {
  if (event.allDay) {
    return {
      summary: event.summary,
      description: event.description,
      start: { date: event.startDate },
      end: { date: event.endDate },
    }
  }

  return {
    summary: event.summary,
    description: event.description,
    start: {
      dateTime: `${event.startDate}T${event.startTime}:00`,
      timeZone: event.timeZone,
    },
    end: {
      dateTime: `${event.endDate}T${event.endTime}:00`,
      timeZone: event.timeZone,
    },
  }
}

export async function insertGoogleEvent(accessToken: string, event: PlannedEvent) {
  const response = await fetch(EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toGoogleEvent(event)),
    signal: AbortSignal.timeout(20_000),
  })
  const body: unknown = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

export function googleErrorMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error
    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message.slice(0, 220)
    }
  }
  return "Google 日历没有接受这条事件。"
}
