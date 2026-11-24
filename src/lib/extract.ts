import "server-only"

import { AppError } from "./errors"
import { modelConfig } from "./env"
import { extractOffline } from "./offline-extract"
import { postprocess } from "./postprocess"
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from "./prompt"
import {
  extractionJsonSchema,
  parseExtraction,
  salvageExtraction,
} from "./schema"
import type { ExtractionResult } from "./types"

const TRANSCRIPT_MIN = 40
const TRANSCRIPT_MAX = 20_000

type ChatMessage = {
  content?: unknown
  parsed?: unknown
}

function messageText(content: unknown) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text
        return typeof text === "string" ? text : ""
      }
      return ""
    })
    .join("")
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/u, "")
  try {
    return JSON.parse(unfenced)
  } catch {
    const start = unfenced.indexOf("{")
    const end = unfenced.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1))
    }
    throw new Error("模型没有返回 JSON")
  }
}

function upstreamMessage(status: number, body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const error = record.error
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : ""

  if (status === 401 || status === 403) {
    return "模型 API 拒绝了密钥。请检查 OPENAI_API_KEY 和 OPENAI_BASE_URL。"
  }
  if (status === 404) {
    return "模型不存在。请检查 OPENAI_MODEL 是否与该 API 匹配。"
  }
  if (message) return `模型 API 返回 ${status}：${message.slice(0, 180)}`
  return `模型 API 返回 ${status}。`
}

async function complete(body: Record<string, unknown>) {
  const config = modelConfig()
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50_000),
  })

  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new AppError(
      upstreamMessage(response.status, data),
      response.status === 400 || response.status === 422 ? response.status : 502,
      response.status === 400 || response.status === 422
        ? "LLM_BAD_REQUEST"
        : "LLM_UPSTREAM",
    )
  }

  const choice = (data as { choices?: Array<{ message?: ChatMessage; finish_reason?: string }> })
    .choices?.[0]
  const message = choice?.message
  if (message?.parsed && typeof message.parsed === "object") return message.parsed
  const text = messageText(message?.content)
  if (!text.trim()) throw new Error("模型返回了空内容")
  return parseModelJson(text)
}

function requestBody(
  transcript: string,
  responseFormat: Record<string, unknown>,
  repairHint?: string,
) {
  const config = modelConfig()
  return {
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: extractionUserPrompt(transcript, repairHint) },
    ],
    response_format: responseFormat,
  }
}

async function extractWithModel(transcript: string): Promise<ExtractionResult> {
  const config = modelConfig()
  const schemaFormat = {
    type: "json_schema",
    json_schema: {
      name: "meeting_extraction",
      strict: true,
      schema: extractionJsonSchema(),
    },
  }
  const jsonFormat = { type: "json_object" }
  const attempts: Array<Record<string, unknown>> = [schemaFormat, jsonFormat, jsonFormat]
  let lastError = "模型输出无法解析"

  for (let index = 0; index < attempts.length; index += 1) {
    try {
      const payload = await complete(
        requestBody(transcript, attempts[index], index === 2 ? lastError : undefined),
      )
      const salvaged = salvageExtraction(payload)
      const parsed = parseExtraction(payload)
      const result = postprocess(transcript, parsed, {
        mode: "model",
        model: config.model,
      }, {
        truncatedActions: salvaged.truncatedActions,
        truncatedDecisions: salvaged.truncatedDecisions,
      })
      if (!result.summary && result.decisions.length === 0 && result.actionItems.length === 0) {
        throw new Error("提取结果为空")
      }
      return result
    } catch (error) {
      if (error instanceof AppError && error.code === "LLM_UPSTREAM") throw error
      if (error instanceof AppError && error.code === "LLM_BAD_REQUEST" && index === 0) {
        lastError = error.message
        continue
      }
      lastError = error instanceof Error ? error.message : lastError
      if (index === attempts.length - 1) {
        throw new AppError(
          `模型没有返回可用的结构化结果。${lastError}`,
          422,
          "LLM_INVALID_OUTPUT",
        )
      }
    }
  }

  throw new AppError("模型没有返回可用的结构化结果。", 422, "LLM_INVALID_OUTPUT")
}

export async function extractMeeting(transcript: string): Promise<ExtractionResult> {
  const text = transcript.replace(/\u0000/g, "")
  if (text.trim().length < TRANSCRIPT_MIN) {
    throw new AppError(
      "纪要太短。请贴上完整记录，或先载入示例。",
      400,
      "TRANSCRIPT_TOO_SHORT",
    )
  }
  if (text.length > TRANSCRIPT_MAX) {
    throw new AppError("纪要超过 2 万字，请先截取这一次会议的内容。", 413, "TRANSCRIPT_TOO_LONG")
  }

  if (!modelConfig().configured) return extractOffline(text)
  return extractWithModel(text)
}
