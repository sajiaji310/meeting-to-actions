import { connection } from "next/server"

import { AppError, errorResponse } from "@/lib/errors"
import { transcribeAudio } from "@/lib/transcription"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await connection()
    const form = await request.formData().catch(() => null)
    if (!form) {
      throw new AppError(
      "没有读到完整的上传内容。录音可能超过了当前部署的请求体上限，请压缩或截短后再试。",
      400,
      "AUDIO_BODY",
    )
    }
    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new AppError("请上传录音文件。", 400, "AUDIO_MISSING")
    }
    const result = await transcribeAudio(file)
    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
