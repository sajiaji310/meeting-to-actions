import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { addMinutes, formatChineseDate, isIsoDate, nextDate } from "./dates"

describe("dates", () => {
  it("rejects impossible calendar dates", () => {
    assert.equal(isIsoDate("2026-02-31"), false)
    assert.equal(isIsoDate("2026-03-18"), true)
  })

  it("rolls a timed event past midnight", () => {
    assert.deepEqual(addMinutes("2026-03-18", "23:30", 60), {
      date: "2026-03-19",
      time: "00:30",
    })
  })

  it("uses an exclusive next day for all-day events", () => {
    assert.equal(nextDate("2026-03-31"), "2026-04-01")
  })

  it("formats the sample meeting date as Wednesday", () => {
    assert.equal(formatChineseDate("2026-03-18"), "2026年3月18日 周三")
    assert.equal(formatChineseDate("2026-03-20"), "2026年3月20日 周五")
    assert.equal(formatChineseDate("2026-03-27"), "2026年3月27日 周五")
  })
})
