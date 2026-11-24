import { connection } from "next/server"
import { NextResponse } from "next/server"

import { SESSION_COOKIE } from "@/lib/session"

export async function POST() {
  await connection()
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
