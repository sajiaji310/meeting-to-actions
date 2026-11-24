import { isIsoDate, isIsoTime } from "./dates"
import type { CalendarEventInput, CalendarSyncRequest, DateSource } from "./types"

export type ReviewItem = {
  id: string
  title: string
  owner: string
  dueDate: string
  dueTime: string
  dueDateEvidence: string | null
  quote: string
  selected: boolean
  origin: "extracted" | "manual"
  transcriptDueDate: string | null
}

export type UndatedChoice = { mode: "skip" } | { mode: "all-day"; date: string }

export function dateHint(item: ReviewItem) {
  if (item.origin === "manual") {
    return item.dueDate
      ? "这是手工添加的行动，日期由你填写。"
      : "这是手工添加的行动，还没有日期。"
  }
  if (item.transcriptDueDate && item.dueDate === item.transcriptDueDate) {
    return item.dueDateEvidence
      ? `纪要中的时间依据：「${item.dueDateEvidence}」。`
      : "提取结果给了日期，但没有摘出原文里的时间短语，请核对。"
  }
  if (item.transcriptDueDate && item.dueDate && item.dueDate !== item.transcriptDueDate) {
    return `你改过日期。纪要原先对应 ${item.transcriptDueDate}。`
  }
  if (item.transcriptDueDate && !item.dueDate) {
    return `你清空了日期。纪要原先对应 ${item.transcriptDueDate}。`
  }
  if (!item.transcriptDueDate && item.dueDate) {
    return "这个日期是审阅时补上的，纪要里没有可确定的日期。"
  }
  if (item.dueDateEvidence) {
    return `纪要写了「${item.dueDateEvidence}」，但没有唯一日期，所以留空。`
  }
  return "纪要没有写明日期。"
}

function dateSourceFor(item: ReviewItem, date: string): DateSource {
  if (item.origin === "extracted" && item.transcriptDueDate && item.transcriptDueDate === date) {
    return "transcript"
  }
  return "reviewer"
}

export function buildConfirmedEvents(input: {
  meetingTitle: string
  summary: string
  items: ReviewItem[]
  undated: Record<string, UndatedChoice | undefined>
}): { error: string; events: CalendarEventInput[] } | { request: CalendarSyncRequest; events: CalendarEventInput[] } {
  const events: CalendarEventInput[] = []
  const problems: string[] = []

  for (const item of input.items) {
    if (!item.selected) continue
    const title = item.title.trim()
    if (!title) {
      problems.push("有一条已勾选的行动还没有标题。")
      continue
    }

    const owner = item.owner.trim() || null
    const evidence = item.dueDateEvidence

    if (item.dueDate) {
      if (!isIsoDate(item.dueDate)) {
        problems.push(`「${title}」的日期无效。`)
        continue
      }
      if (item.dueTime && !isIsoTime(item.dueTime)) {
        problems.push(`「${title}」的时间无效。`)
        continue
      }
      events.push({
        id: item.id,
        title,
        owner,
        quote: item.quote,
        evidence,
        date: item.dueDate,
        time: item.dueTime || null,
        allDay: !item.dueTime,
        dateSource: dateSourceFor(item, item.dueDate),
      })
      continue
    }

    const choice = input.undated[item.id] ?? { mode: "skip" }
    if (choice.mode === "skip") continue
    if (!choice.date || !isIsoDate(choice.date)) {
      problems.push(`「${title}」要记为全天事件，请先选一个日期。`)
      continue
    }
    events.push({
      id: item.id,
      title,
      owner,
      quote: item.quote,
      evidence,
      date: choice.date,
      time: null,
      allDay: true,
      dateSource: "reviewer",
    })
  }

  if (problems.length > 0) {
    return { error: problems[0], events }
  }

  if (events.length === 0) {
    return {
      error: "没有可写入的事件。未写明日期的行动默认跳过，你可以为它指定一个全天日期。",
      events,
    }
  }

  return {
    request: {
      confirmed: true,
      meetingTitle: input.meetingTitle.trim(),
      summary: input.summary.trim(),
      events,
    },
    events,
  }
}
