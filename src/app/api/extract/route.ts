import { connection } from "next/server"

import { errorResponse } from "@/lib/errors"
import { extractMeeting } from "@/lib/extract"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await connection()
    const payload: unknown = await request.json().catch(() => null)
    const transcript =
      payload && typeof payload === "object" && "transcript" in payload
        ? (payload as { transcript?: unknown }).transcript
        : undefined
    if (typeof transcript !== "string") {
      return Response.json(
        { error: "请提交会议纪要正文。", code: "BAD_JSON" },
        { status: 400 },
      )
    }
    const result = await extractMeeting(transcript)
    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
