import { connection } from "next/server"

import { AppError, errorResponse } from "@/lib/errors"
import { googleConfig, sessionSecret } from "@/lib/env"
import { planCalendarRequest, type PlannedEvent } from "@/lib/events"
import { googleErrorMessage, insertGoogleEvent, refreshGoogleToken } from "@/lib/google"
import {
  ensureFreshSession,
  readCalendarSession,
  writeCalendarSession,
  type CalendarSession,
} from "@/lib/session"
import type { CalendarSyncResult } from "@/lib/types"

export const maxDuration = 60

async function refreshSession(session: CalendarSession) {
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

export async function POST(request: Request) {
  try {
    await connection()
    const payload: unknown = await request.json().catch(() => null)
    const { events } = planCalendarRequest(payload)

    if (!googleConfig().configured) {
      throw new AppError(
        "没有配置 Google OAuth。这些行动项没有写入任何日历，你可以下载 .ics 文件。",
        400,
        "CALENDAR_NOT_CONFIGURED",
      )
    }
    if (!sessionSecret()) {
      throw new AppError(
        "已填写 Google 客户端，但缺少 SESSION_SECRET，无法保存登录状态。",
        500,
        "SESSION_SECRET_MISSING",
      )
    }

    let session = await readCalendarSession()
    if (!session) {
      throw new AppError("还没有连接 Google 日历。", 401, "CALENDAR_NOT_CONNECTED")
    }
    session = await ensureFreshSession(session)

    const results: CalendarSyncResult[] = []
    for (let index = 0; index < events.length; index += 1) {
      const outcome = await writeOne(session, events[index])
      session = outcome.session
      results.push(outcome.result)
      if (outcome.stop) {
        for (const rest of events.slice(index + 1)) {
          results.push({
            id: rest.id,
            ok: false,
            error: "授权已失效，这条没有提交。",
          })
        }
        break
      }
    }

    return Response.json({
      results,
      created: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

async function writeOne(session: CalendarSession, event: PlannedEvent) {
  let current = session
  let inserted = await insertGoogleEvent(current.accessToken, event)
  if (inserted.status === 401) {
    current = await refreshSession(current)
    inserted = await insertGoogleEvent(current.accessToken, event)
  }

  if (inserted.ok) {
    const body = inserted.body as { htmlLink?: string; id?: string }
    return {
      session: current,
      stop: false,
      result: {
        id: event.id,
        ok: true,
        htmlLink: body.htmlLink,
        eventId: body.id,
      } satisfies CalendarSyncResult,
    }
  }

  if (inserted.status === 401) {
    return {
      session: current,
      stop: true,
      result: {
        id: event.id,
        ok: false,
        error: "授权已失效，请重新连接 Google 日历。",
      } satisfies CalendarSyncResult,
    }
  }

  return {
    session: current,
    stop: false,
    result: {
      id: event.id,
      ok: false,
      error: googleErrorMessage(inserted.body),
    } satisfies CalendarSyncResult,
  }
}
