import { createHash } from "node:crypto"

import { compactDate, compactTime, formatUtcStamp, TIME_ZONE } from "./dates"
import type { PlannedEvent } from "./events"

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
}

function fold(line: string) {
  const bytes = Buffer.from(line, "utf8")
  if (bytes.length <= 75) return line

  const parts: string[] = []
  let offset = 0
  let limit = 75
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length)
    while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1
    }
    if (end === offset) end = Math.min(offset + limit, bytes.length)
    parts.push(bytes.subarray(offset, end).toString("utf8"))
    offset = end
    limit = 74
  }

  return parts
    .map((part, index) => (index === 0 ? part : ` ${part}`))
    .join("\r\n")
}

function uidFor(event: PlannedEvent) {
  const hash = createHash("sha1")
    .update(`${event.id}|${event.summary}|${event.startDate}|${event.startTime ?? "all-day"}`)
    .digest("hex")
    .slice(0, 24)
  return `${hash}@meeting-notes.local`
}

function eventLines(event: PlannedEvent, stamp: string) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uidFor(event)}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
  ]

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`)
    lines.push(`DTEND;VALUE=DATE:${compactDate(event.endDate)}`)
  } else if (event.startTime && event.endTime) {
    lines.push(
      `DTSTART;TZID=${TIME_ZONE}:${compactDate(event.startDate)}T${compactTime(event.startTime)}`,
    )
    lines.push(
      `DTEND;TZID=${TIME_ZONE}:${compactDate(event.endDate)}T${compactTime(event.endTime)}`,
    )
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT")
  return lines
}

const SHANGHAI_ZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Shanghai",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0800",
  "TZOFFSETTO:+0800",
  "TZNAME:CST",
  "DTSTART:19700101T000000",
  "END:STANDARD",
  "END:VTIMEZONE",
]

export function buildIcs(events: PlannedEvent[], now = new Date()) {
  const stamp = formatUtcStamp(now)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//会议纪要转待办//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:会议行动项",
    `X-WR-TIMEZONE:${TIME_ZONE}`,
  ]

  if (events.some((event) => !event.allDay)) lines.push(...SHANGHAI_ZONE)
  for (const event of events) lines.push(...eventLines(event, stamp))
  lines.push("END:VCALENDAR")

  return `${lines.map(fold).join("\r\n")}\r\n`
}
