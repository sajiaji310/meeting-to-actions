import { z } from "zod"

const nullableText = (description: string) =>
  z.string().nullable().describe(description)

export const extractionSchema = z.object({
  meetingTitle: z.string().describe("纪要中的会议名称。没有就根据主题概括，不要编造公司名。"),
  meetingDate: nullableText(
    "纪要正文写明的会议日期，YYYY-MM-DD。没有写明则为 null。不要填今天。",
  ),
  summary: z.string().describe("80 到 160 字的摘要，只转述纪要里的内容。"),
  decisions: z.array(
    z.object({
      statement: z.string().describe("已经拍板的决定，一句话。"),
      quote: z.string().describe("原文连续片段，必须能在纪要中逐字找到。"),
    }),
  ),
  actionItems: z.array(
    z.object({
      title: z.string().describe("动词开头的行动标题，40 字以内。"),
      owner: nullableText(
        "被点名的负责人姓名。未点名、或明确待认领时为 null。不要猜测。",
      ),
      dueDate: nullableText(
        "YYYY-MM-DD。只有原文给出公历日期，或能凭纪要里的会议日期唯一换算时才填。否则 null。",
      ),
      dueTime: nullableText("HH:mm。只有原文写到钟点，且这个钟点就是该行动的期限时才填。否则 null。"),
      dueDateEvidence: nullableText(
        "原文里表示时间的短语，例如「本周五」「尽快」。没有则为 null。",
      ),
      quote: z.string().describe("支撑这条行动的原文连续片段，不要改写，不要用省略号拼接。"),
    }),
  ),
})

export type RawExtraction = z.infer<typeof extractionSchema>

export function extractionJsonSchema() {
  const generated = z.toJSONSchema(extractionSchema) as {
    $schema?: string
  } & Record<string, unknown>
  const schema = { ...generated }
  delete schema.$schema
  return schema
}

const NULL_OWNERS = new Set([
  "未指定",
  "未定",
  "待定",
  "待认领",
  "无",
  "暂无",
  "没有",
  "未知",
  "某",
  "某人",
  "有人",
  "未分配",
  "待分配",
  "tbd",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
])

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null
  const trimmed = value.replace(/\s+/g, " ").trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export function normalizeOwner(value: unknown) {
  const text = cleanText(value, 40)
  if (!text) return null
  if (NULL_OWNERS.has(text.toLowerCase())) return null
  return text
}

export function salvageExtraction(payload: unknown) {
  const source =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {}

  const decisions = Array.isArray(source.decisions) ? source.decisions : []
  const actionItems = Array.isArray(source.actionItems) ? source.actionItems : []

  return {
    meetingTitle: cleanText(source.meetingTitle, 80) ?? "未命名会议",
    meetingDate: cleanText(source.meetingDate, 32),
    summary: cleanText(source.summary, 800) ?? "",
    decisions: decisions.slice(0, 20).map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      return {
        statement: cleanText(row.statement, 200) ?? "",
        quote: cleanText(row.quote, 500) ?? "",
      }
    }),
    actionItems: actionItems.slice(0, 30).map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      let dueDate = cleanText(row.dueDate, 40)
      let dueTime = cleanText(row.dueTime, 20)
      let dueDateEvidence = cleanText(row.dueDateEvidence, 80)
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        dueDateEvidence = dueDateEvidence ?? dueDate
        dueDate = null
      }
      if (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)) dueTime = null
      return {
        title: cleanText(row.title, 80) ?? "",
        owner: normalizeOwner(row.owner),
        dueDate,
        dueTime,
        dueDateEvidence,
        quote: cleanText(row.quote, 500) ?? "",
      }
    }),
    truncatedDecisions: decisions.length > 20,
    truncatedActions: actionItems.length > 30,
  }
}

export function parseExtraction(payload: unknown): RawExtraction {
  const direct = extractionSchema.safeParse(payload)
  if (direct.success) return direct.data

  const salvaged = salvageExtraction(payload)
  const second = extractionSchema.safeParse(salvaged)
  if (second.success) return second.data

  throw new Error("模型输出不符合提取结构")
}
