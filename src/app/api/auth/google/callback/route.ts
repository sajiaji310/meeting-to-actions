import { connection } from "next/server"
import { NextResponse, type NextRequest } from "next/server"

import { googleRedirectUri, requestOrigin, sessionSecret } from "@/lib/env"
import { exchangeGoogleCode, fetchGoogleEmail } from "@/lib/google"
import { sealJson } from "@/lib/seal"
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  sessionCookieOptions,
  type CalendarSession,
} from "@/lib/session"

function back(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/${query}`, requestOrigin(request)))
}

function safeMessage(value: string | null) {
  if (!value) return "Google 授权没有完成。"
  return value.replace(/\s+/g, " ").slice(0, 140)
}

export async function GET(request: NextRequest) {
  await connection()
  const origin = requestOrigin(request)
  const params = request.nextUrl.searchParams
  const oauthError = params.get("error")
  if (oauthError) {
    const message =
      oauthError === "access_denied" ? "已取消 Google 授权。" : safeMessage(params.get("error_description"))
    const response = NextResponse.redirect(
      new URL(`/?calendar=error&message=${encodeURIComponent(message)}`, origin),
    )
    response.cookies.delete(STATE_COOKIE)
    return response
  }

  const state = params.get("state")
  const saved = request.cookies.get(STATE_COOKIE)?.value
  if (!state || !saved || state !== saved) {
    const response = back(request, "?calendar=error&message=" + encodeURIComponent("授权状态校验失败，请重新连接。"))
    response.cookies.delete(STATE_COOKIE)
    return response
  }

  const code = params.get("code")
  if (!code) {
    return back(request, "?calendar=error&message=" + encodeURIComponent("Google 没有返回授权码。"))
  }

  const secret = sessionSecret()
  if (!secret) {
    return back(request, "?calendar=error&message=" + encodeURIComponent("缺少 SESSION_SECRET。"))
  }

  try {
    const token = await exchangeGoogleCode(code, googleRedirectUri(request))
    if (!token.refresh_token) {
      const response = back(
        request,
        "?calendar=error&message=" +
          encodeURIComponent("Google 没有返回刷新令牌。请在账号授权页移除本应用后重试。"),
      )
      response.cookies.delete(STATE_COOKIE)
      return response
    }
    const email = (await fetchGoogleEmail(token.access_token)) ?? ""
    const session: CalendarSession = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      email,
    }
    const response = NextResponse.redirect(new URL("/?calendar=connected", origin))
    response.cookies.set(SESSION_COOKIE, sealJson(session, secret), sessionCookieOptions(60 * 60 * 24 * 30))
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (error) {
    const message = error instanceof Error ? safeMessage(error.message) : "Google 授权失败。"
    const response = back(request, `?calendar=error&message=${encodeURIComponent(message)}`)
    response.cookies.delete(STATE_COOKIE)
    return response
  }
}
