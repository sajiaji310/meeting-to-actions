import { isIsoDate, isIsoTime } from "./dates"
import { findQuoteSpan } from "./grounding"
import { normalizeOwner, type RawExtraction } from "./schema"
import type { ActionItem, Decision, ExtractionMode, ExtractionResult } from "./types"

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function postprocess(
  transcript: string,
  raw: RawExtraction,
  meta: { mode: ExtractionMode; model: string | null },
  flags?: { truncatedDecisions?: boolean; truncatedActions?: boolean },
): ExtractionResult {
  const warnings: string[] = []
  const notes: string[] = []

  const meetingDate =
    raw.meetingDate && isIsoDate(raw.meetingDate) ? raw.meetingDate : null
  if (raw.meetingDate && !meetingDate) {
    warnings.push("模型给出的会议日期格式无效，已留空。")
  }

  const decisions: Decision[] = []
  let droppedDecisions = 0
  const decisionRows = raw.decisions.slice(0, 20)
  if (raw.decisions.length > 20 || flags?.truncatedDecisions) {
    warnings.push("决定超过 20 条，只保留了前 20 条。")
  }
  for (const decision of decisionRows) {
    const statement = decision.statement.trim()
    const quote = decision.quote.trim()
    if (!statement || !quote) {
      droppedDecisions += 1
      continue
    }
    decisions.push({
      id: newId("dec"),
      statement,
      quote,
      grounded: findQuoteSpan(transcript, quote) !== null,
    })
  }

  const actionItems: ActionItem[] = []
  let droppedActions = 0
  const actionRows = raw.actionItems.slice(0, 30)
  if (raw.actionItems.length > 30 || flags?.truncatedActions) {
    warnings.push("行动项超过 30 条，只保留了前 30 条。")
  }
  for (const item of actionRows) {
    const title = item.title.trim()
    const quote = item.quote.trim()
    if (!title || !quote) {
      droppedActions += 1
      continue
    }

    let dueDate = item.dueDate?.trim() || null
    let dueTime = item.dueTime?.trim() || null
    let dueDateEvidence = item.dueDateEvidence?.trim() || null
    if (dueDate && !isIsoDate(dueDate)) {
      dueDateEvidence = dueDateEvidence || dueDate
      dueDate = null
    }
    if (dueTime && !isIsoTime(dueTime)) dueTime = null
    if (dueTime && !dueDate) dueTime = null

    actionItems.push({
      id: newId("act"),
      title,
      owner: normalizeOwner(item.owner),
      dueDate,
      dueTime,
      dueDateEvidence,
      quote,
      grounded: findQuoteSpan(transcript, quote) !== null,
    })
  }

  const ungroundedDecisions = decisions.filter((item) => !item.grounded).length
  const ungroundedActions = actionItems.filter((item) => !item.grounded).length
  if (ungroundedDecisions > 0) {
    warnings.push(
      `${ungroundedDecisions} 条决定的引用没有在原文中定位到，请改引用或删除。`,
    )
  }
  if (ungroundedActions > 0) {
    warnings.push(
      `${ungroundedActions} 条行动项的引用没有在原文中定位到，请改引用或删除。`,
    )
  }
  if (droppedDecisions > 0) {
    warnings.push(`${droppedDecisions} 条决定因缺少表述或引用被丢弃。`)
  }
  if (droppedActions > 0) {
    warnings.push(`${droppedActions} 条行动项因缺少标题或引用被丢弃。`)
  }
  const missingOwner = actionItems.filter((item) => !item.owner).length
  const missingDate = actionItems.filter((item) => !item.dueDate).length
  if (missingOwner > 0) {
    notes.push(`${missingOwner} 条行动项没有负责人。同步说明里会写「纪要未指定」，不会猜一个名字。`)
  }
  if (missingDate > 0) {
    notes.push(`${missingDate} 条行动项没有可确定的日期。默认不写入日历，除非你指定一个全天日期。`)
  }

  const summary = raw.summary.trim()
  if (!summary) warnings.push("模型没有给出摘要，请在审阅时补上。")

  return {
    mode: meta.mode,
    model: meta.model,
    meetingTitle: raw.meetingTitle.trim() || "未命名会议",
    meetingDate,
    summary,
    decisions,
    actionItems,
    warnings,
    notes,
  }
}
