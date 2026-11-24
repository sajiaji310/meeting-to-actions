import { audioRejection } from "./audio-file"
import { transcriptionConfig } from "./env"
import { AppError } from "./errors"

const WHISPER_PROMPT = "简体中文商务会议，包含负责人、日期和决定。"

export function transcriptionFailure(status: number, body: unknown) {
  const message = upstreamText(body)
  const lowered = message.toLowerCase()

  if (status === 401 || status === 403) {
    return "转写接口拒绝了密钥。请检查 TRANSCRIPTION_API_KEY 或 OPENAI_API_KEY，以及对应的 BASE_URL。"
  }
  if (
    status === 413 ||
    lowered.includes("maximum content size") ||
    lowered.includes("too large") ||
    lowered.includes("too long") ||
    lowered.includes("duration")
  ) {
    return "录音太长或超过接口限制。请截到 25MB 以内再试。"
  }
  if (
    lowered.includes("could not be decoded") ||
    lowered.includes("invalid file format") ||
    lowered.includes("unsupported")
  ) {
    return "转写接口无法读取这个录音。请换成 mp3、m4a、wav 或 webm。"
  }
  if (
    status === 404 ||
    (lowered.includes("model") &&
      (lowered.includes("not found") || lowered.includes("does not exist")))
  ) {
    return "转写模型不存在。请检查 TRANSCRIPTION_MODEL 是否被该接口支持。"
  }
  if (message) return `转写接口返回 ${status}：${message.slice(0, 180)}`
  return `转写接口返回 ${status}。没有生成文字。`
}

function upstreamText(body: unknown) {
  if (!body || typeof body !== "object") return ""
  const record = body as Record<string, unknown>
  const error = record.error
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === "string" ? message : ""
  }
  return ""
}

function transcriptText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const text = (payload as { text?: unknown }).text
  return typeof text === "string" ? text.trim() : ""
}

export async function transcribeAudio(file: File, fetchImpl: typeof fetch = fetch) {
  const rejection = audioRejection(file)
  if (rejection) throw new AppError(rejection.message, rejection.status, rejection.code)

  const config = transcriptionConfig()
  if (!config.configured) {
    throw new AppError(
      "未配置转写接口。请设置 OPENAI_API_KEY，或单独设置 TRANSCRIPTION_API_KEY。这里不会编造转写稿。",
      409,
      "TRANSCRIPTION_NOT_CONFIGURED",
    )
  }

  const form = new FormData()
  form.append("file", file, file.name || "meeting.webm")
  form.append("model", config.model)
  form.append("language", config.language)
  form.append("response_format", "json")
  if (config.model.toLowerCase().includes("whisper")) {
    form.append("prompt", WHISPER_PROMPT)
  }

  let response: Response
  const timeoutMs = process.env.VERCEL === "1" ? 55_000 : 180_000
  try {
    response = await fetchImpl(`${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timedOut =
      (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) ||
      (error instanceof Error && error.name === "TimeoutError")
    if (timedOut) {
      throw new AppError(
        process.env.VERCEL === "1"
          ? "转写超时。这个部署单次大约只有 60 秒，请换更短的录音。"
          : "转写请求超时。请换更短的录音，或检查转写服务是否可到达。",
        504,
        "TRANSCRIPTION_TIMEOUT",
      )
    }
    throw new AppError("转写请求没有完成。请检查网络和 TRANSCRIPTION_BASE_URL。", 502, "TRANSCRIPTION_UPSTREAM")
  }

  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new AppError(
      transcriptionFailure(response.status, data),
      response.status === 401 || response.status === 403 ? 401 : 502,
      "TRANSCRIPTION_UPSTREAM",
    )
  }

  const text = transcriptText(data)
  if (!text) {
    throw new AppError(
      "没有从录音里识别出文字。请确认是中文会议，并且音量足够。",
      422,
      "TRANSCRIPTION_EMPTY",
    )
  }

  return { text, model: config.model }
}
