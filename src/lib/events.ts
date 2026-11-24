import { z } from "zod"

import {
  addMinutes,
  DEFAULT_DURATION_MINUTES,
  isIsoDate,
  isIsoTime,
  nextDate,
  TIME_ZONE,
} from "./dates"
import { AppError } from "./errors"
import type { CalendarEventInput, CalendarSyncRequest } from "./types"

const eventSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  owner: z.string().trim().max(40).nullable(),
  quote: z.string().max(800),
  evidence: z.string().max(120).nullable(),
  date: z.string(),
  time: z.string().nullable(),
  allDay: z.boolean(),
  dateSource: z.enum(["transcript", "reviewer"]),
})

const requestSchema = z.object({
  confirmed: z.literal(true),
  meetingTitle: z.string().max(120),
  summary: z.string().max(1000),
  events: z.array(eventSchema).min(1).max(30),
})

export type PlannedEvent = {
  id: string
  summary: string
  description: string
  allDay: boolean
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  timeZone: string
}

export function buildDescription(input: {
  meetingTitle: string
  summary: string
  owner: string | null
  quote: string
  evidence: string | null
  allDay: boolean
  dateSource: "transcript" | "reviewer"
}) {
  const lines = [
    "由「会议纪要转待办」写入。此事件对应一条已经人工确认的行动项。",
    input.meetingTitle.trim() ? `会议：${input.meetingTitle.trim()}` : "",
    `负责人：${input.owner?.trim() || "纪要未指定"}`,
    input.evidence?.trim()
      ? `时间依据：${input.evidence.trim()}`
      : "时间依据：纪要未给出可确定的日期或钟点",
    input.dateSource === "reviewer"
      ? "日期来源：审阅时由人填写，不是从纪要直接判定的。"
      : "日期来源：纪要原文。",
    input.allDay ? "形式：全天事件。" : "时长：默认 1 小时，可在日历中修改。",
    input.quote.trim() ? `原文：${input.quote.trim()}` : "",
    input.summary.trim() ? `会议摘要：${input.summary.trim()}` : "",
  ]
  return lines.filter(Boolean).join("\n")
}

export function planCalendarRequest(payload: unknown): {
  request: CalendarSyncRequest
  events: PlannedEvent[]
} {
  if (!payload || typeof payload !== "object" || (payload as { confirmed?: unknown }).confirmed !== true) {
    throw new AppError(
      "未确认的行动项不能写入日历。请先在页面上完成审阅，再确认。",
      400,
      "NOT_CONFIRMED",
    )
  }

  const events = (payload as { events?: unknown }).events
  if (Array.isArray(events) && events.length === 0) {
    throw new AppError(
      "没有可写入的事件。没有日期的行动默认跳过，除非你为它指定全天日期。",
      400,
      "NO_EVENTS",
    )
  }

  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AppError("日历事件缺少标题、日期，或格式不正确。", 400, "INVALID_EVENTS")
  }

  const planned = parsed.data.events.map((event) => planEvent(parsed.data, event))
  return {
    request: parsed.data,
    events: planned,
  }
}

function planEvent(
  request: { meetingTitle: string; summary: string },
  event: CalendarEventInput,
): PlannedEvent {
  if (!isIsoDate(event.date)) {
    throw new AppError(`「${event.title}」的日期无效。`, 400, "INVALID_DATE")
  }

  const description = buildDescription({
    meetingTitle: request.meetingTitle,
    summary: request.summary,
    owner: event.owner,
    quote: event.quote,
    evidence: event.evidence,
    allDay: event.allDay || !event.time,
    dateSource: event.dateSource,
  })

  if (event.allDay || !event.time) {
    return {
      id: event.id,
      summary: event.title.trim(),
      description,
      allDay: true,
      startDate: event.date,
      endDate: nextDate(event.date),
      startTime: null,
      endTime: null,
      timeZone: TIME_ZONE,
    }
  }

  if (!isIsoTime(event.time)) {
    throw new AppError(`「${event.title}」的时间无效。`, 400, "INVALID_TIME")
  }

  const end = addMinutes(event.date, event.time, DEFAULT_DURATION_MINUTES)
  return {
    id: event.id,
    summary: event.title.trim(),
    description,
    allDay: false,
    startDate: event.date,
    endDate: end.date,
    startTime: event.time,
    endTime: end.time,
    timeZone: TIME_ZONE,
  }
}
