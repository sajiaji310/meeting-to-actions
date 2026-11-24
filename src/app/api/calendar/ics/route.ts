import { connection } from "next/server"

import { errorResponse } from "@/lib/errors"
import { planCalendarRequest } from "@/lib/events"
import { buildIcs } from "@/lib/ics"

export async function POST(request: Request) {
  try {
    await connection()
    const payload: unknown = await request.json().catch(() => null)
    const { events } = planCalendarRequest(payload)
    const ics = buildIcs(events)
    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=\"action-items.ics\"; filename*=UTF-8''%E4%BC%9A%E8%AE%AE%E8%A1%8C%E5%8A%A8%E9%A1%B9.ics",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
