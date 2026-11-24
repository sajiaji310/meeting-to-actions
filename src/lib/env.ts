export function modelConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? ""
  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/$/, "")
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"

  let host: string | null = null
  try {
    host = new URL(baseUrl).host
  } catch {
    host = null
  }

  return {
    configured: apiKey.length > 0,
    apiKey,
    baseUrl,
    model,
    host,
  }
}

export function transcriptionConfig() {
  const apiKey =
    process.env.TRANSCRIPTION_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ""
  const baseUrl = (
    process.env.TRANSCRIPTION_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "")
  const model = process.env.TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe"
  const language = process.env.TRANSCRIPTION_LANGUAGE?.trim() || "zh"
  const separateKey = Boolean(process.env.TRANSCRIPTION_API_KEY?.trim())

  let host: string | null = null
  try {
    host = new URL(baseUrl).host
  } catch {
    host = null
  }

  return {
    configured: apiKey.length > 0,
    apiKey,
    baseUrl,
    model,
    language,
    host,
    separateKey,
  }
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ""
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() ?? ""

  return {
    configured: clientId.length > 0 && clientSecret.length > 0,
    clientId,
    clientSecret,
    redirectUri,
  }
}

export function sessionSecret() {
  return process.env.SESSION_SECRET?.trim() ?? ""
}

export function requestOrigin(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")

  const forwardedHost = request.headers.get("x-forwarded-host")
  let host = (forwardedHost || request.headers.get("host") || "").split(",")[0]?.trim() ?? ""
  if (!host) {
    return new URL(request.url).origin.replace("://0.0.0.0", "://127.0.0.1")
  }
  if (host.startsWith("0.0.0.0")) host = host.replace("0.0.0.0", "127.0.0.1")

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const proto =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : process.env.VERCEL === "1"
        ? "https"
        : "http"
  return `${proto}://${host}`
}

export function googleRedirectUri(request: Request) {
  const configured = googleConfig().redirectUri
  if (configured) return configured
  return `${requestOrigin(request)}/api/auth/google/callback`
}
