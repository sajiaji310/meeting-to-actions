export const PROVIDER_AUDIO_BYTES = 25 * 1024 * 1024
export const MAX_AUDIO_BYTES = PROVIDER_AUDIO_BYTES
/** Vercel serverless request bodies are capped at 4.5MB, including multipart framing. */
export const VERCEL_PLATFORM_BODY_BYTES = Math.floor(4.5 * 1024 * 1024)
export const VERCEL_AUDIO_BYTES = 4 * 1024 * 1024

export type AudioLimitKind = "provider" | "vercel" | "configured"

export type AudioLimit = {
  bytes: number
  kind: AudioLimitKind
}

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown"])
const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "wav",
  "webm",
  "mp4",
  "mpeg",
  "mpga",
  "ogg",
  "oga",
  "flac",
])

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "video/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
])

export type UploadKind = "audio" | "text" | "unsupported"

export type AudioRejection = {
  message: string
  status: number
  code: string
}

export function fileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  return match?.[1]?.toLowerCase() ?? ""
}

export function classifyUpload(file: { name: string; type: string }): UploadKind {
  const extension = fileExtension(file.name)
  const type = file.type.toLowerCase().split(";")[0]?.trim() ?? ""
  if (
    TEXT_EXTENSIONS.has(extension) ||
    type === "text/plain" ||
    type === "text/markdown"
  ) {
    return "text"
  }
  if (AUDIO_EXTENSIONS.has(extension) || AUDIO_MIME_TYPES.has(type)) return "audio"
  return "unsupported"
}

export function resolveAudioLimit(env?: {
  VERCEL?: string
  AUDIO_MAX_BYTES?: string
}): AudioLimit {
  const source = env ?? {
    VERCEL: process.env.VERCEL,
    AUDIO_MAX_BYTES: process.env.AUDIO_MAX_BYTES,
  }
  const raw = source.AUDIO_MAX_BYTES?.trim()
  if (raw) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 0) {
      return {
        bytes: Math.min(Math.floor(parsed), PROVIDER_AUDIO_BYTES),
        kind: "configured",
      }
    }
  }
  if (source.VERCEL === "1") return { bytes: VERCEL_AUDIO_BYTES, kind: "vercel" }
  return { bytes: PROVIDER_AUDIO_BYTES, kind: "provider" }
}

function formatMb(bytes: number) {
  const mb = bytes / (1024 * 1024)
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`
}

export function audioTooLargeMessage(limit: AudioLimit) {
  if (limit.kind === "vercel") {
    return `录音超过当前部署的单次请求上限 ${formatMb(limit.bytes)}。Vercel Serverless 的请求体上限是 4.5MB，应用留出分段编码的余量后按 ${formatMb(limit.bytes)} 拒绝，避免请求被平台截断。请压缩或截短。转写服务本身可以到 25MB，本地运行时用的是这个上限。`
  }
  if (limit.kind === "configured") {
    return `录音超过当前配置的上限 ${formatMb(limit.bytes)}（AUDIO_MAX_BYTES）。请压缩或截短。转写服务本身不超过 25MB。`
  }
  return "录音超过 25MB。转写接口不接受更大的文件。"
}

export function audioRejection(
  file: { name: string; type: string; size: number },
  limit: AudioLimit = resolveAudioLimit(),
): AudioRejection | null {
  if (classifyUpload(file) !== "audio") {
    return {
      message: "不支持这个格式。录音请用 mp3、m4a、wav 或 webm。",
      status: 415,
      code: "AUDIO_UNSUPPORTED",
    }
  }
  if (file.size <= 0) {
    return {
      message: "录音文件是空的。",
      status: 400,
      code: "AUDIO_EMPTY",
    }
  }
  if (file.size > limit.bytes) {
    return {
      message: audioTooLargeMessage(limit),
      status: 413,
      code: "AUDIO_TOO_LARGE",
    }
  }
  return null
}

export const UNSUPPORTED_UPLOAD_MESSAGE =
  "不支持这个格式。文稿请用 .txt 或 .md，录音请用 mp3、m4a、wav 或 webm。"
