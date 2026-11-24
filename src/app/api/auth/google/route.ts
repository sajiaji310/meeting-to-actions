import { randomBytes } from "node:crypto"

import { connection } from "next/server"
import { NextResponse, type NextRequest } from "next/server"

import { googleConfig, googleRedirectUri, requestOrigin, sessionSecret } from "@/lib/env"
import { googleAuthorizationUrl } from "@/lib/google"
import { STATE_COOKIE, sessionCookieOptions } from "@/lib/session"

function redirectHome(request: NextRequest, query: string) {
  const url = new URL(`/${query}`, requestOrigin(request))
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  await connection()
  const google = googleConfig()
  if (!google.configured) {
    return redirectHome(request, "?calendar=not-configured")
  }
  if (!sessionSecret()) {
    return redirectHome(
      request,
      `?calendar=error&message=${encodeURIComponent("缺少 SESSION_SECRET，无法保存 Google 登录状态。")}`,
    )
  }

  const state = randomBytes(24).toString("base64url")
  const destination = googleAuthorizationUrl({
    clientId: google.clientId,
    redirectUri: googleRedirectUri(request),
    state,
  })
  const response = NextResponse.redirect(destination)
  response.cookies.set(STATE_COOKIE, state, sessionCookieOptions(60 * 10))
  return response
}
