import { cookies } from "next/headers"

import { resolveAudioLimit } from "@/lib/audio-file"
import { errorResponse } from "@/lib/errors"
import { googleConfig, modelConfig, transcriptionConfig } from "@/lib/env"
import { readCalendarSession } from "@/lib/session"
import type { StatusResponse } from "@/lib/types"

export async function GET() {
  await cookies()
  try {
    const model = modelConfig()
    const speech = transcriptionConfig()
    const audioLimit = resolveAudioLimit()
    const google = googleConfig()
    const session = google.configured ? await readCalendarSession() : null
    const body: StatusResponse = {
      model: {
        configured: model.configured,
        model: model.configured ? model.model : null,
        host: model.configured ? model.host : null,
      },
      transcription: {
        configured: speech.configured,
        model: speech.configured ? speech.model : null,
        host: speech.configured ? speech.host : null,
        language: speech.configured ? speech.language : null,
        maxBytes: audioLimit.bytes,
        limitKind: audioLimit.kind,
      },
      calendar: {
        configured: google.configured,
        connected: Boolean(session),
        email: session?.email ?? null,
      },
    }
    return Response.json(body)
  } catch (error) {
    return errorResponse(error)
  }
}
