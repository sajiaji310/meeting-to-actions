import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AppError } from "./errors"
import { planCalendarRequest } from "./events"
import { buildIcs } from "./ics"

const meeting = {
  confirmed: true as const,
  meetingTitle: "澄镜发布准备会",
  summary: "首发范围已定，导出性能不纳入。",
  events: [
    {
      id: "a",
      title: "冻结审计日志字段",
      owner: "林知夏",
      quote: "接口文档周五下班前发到群里。",
      evidence: "周五下班前",
      date: "2026-03-20",
      time: null,
      allDay: true,
      dateSource: "transcript" as const,
    },
    {
      id: "b",
      title: "评审设计稿",
      owner: null,
      quote: "上午 10 点看设计稿",
      evidence: "上午 10 点",
      date: "2026-03-25",
      time: "10:00",
      allDay: false,
      dateSource: "transcript" as const,
    },
  ],
}

describe("calendar file", () => {
  const planned = planCalendarRequest(meeting).events
  const ics = buildIcs(planned, new Date("2026-03-18T02:00:00Z"))

  it("emits an all-day event and a Shanghai timed event", () => {
    assert.match(ics, /DTSTART;VALUE=DATE:20260320/)
    assert.match(ics, /DTEND;VALUE=DATE:20260321/)
    assert.match(ics, /DTSTART;TZID=Asia\/Shanghai:20260325T100000/)
    assert.match(ics, /DTEND;TZID=Asia\/Shanghai:20260325T110000/)
    assert.match(ics, /BEGIN:VTIMEZONE/)
    assert.equal(ics.includes("BEGIN:VEVENT"), true)
    assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2)
  })

  it("keeps the source quote and does not invent an owner", () => {
    const unfolded = ics.replace(/\r\n /g, "")
    assert.match(unfolded, /接口文档周五下班前发到群里/)
    assert.match(unfolded, /负责人：纪要未指定/)
    assert.match(unfolded, /负责人：林知夏/)
  })

  it("folds long lines on UTF-8 boundaries", () => {
    for (const line of ics.split("\r\n").filter(Boolean)) {
      assert.ok(Buffer.byteLength(line) <= 75, line)
    }
    assert.ok(ics.endsWith("\r\n"))
  })

  it("refuses to plan a write that was not confirmed", () => {
    assert.throws(
      () => planCalendarRequest({ ...meeting, confirmed: false }),
      (error: unknown) => error instanceof AppError && error.code === "NOT_CONFIRMED",
    )
  })

  it("refuses an impossible date", () => {
    assert.throws(
      () =>
        planCalendarRequest({
          ...meeting,
          events: [{ ...meeting.events[0], date: "2026-02-31" }],
        }),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_DATE",
    )
  })
})
