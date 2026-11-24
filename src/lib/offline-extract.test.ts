import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AppError } from "./errors"
import { extractOffline } from "./offline-extract"
import { QUOTE, SAMPLE_TRANSCRIPT } from "./sample"

describe("offline sample extraction", () => {
  const result = extractOffline(SAMPLE_TRANSCRIPT)

  it("grounds every quote in the sample transcript", () => {
    for (const decision of result.decisions) {
      assert.equal(decision.grounded, true, decision.statement)
      assert.ok(SAMPLE_TRANSCRIPT.includes(decision.quote))
    }
    for (const item of result.actionItems) {
      assert.equal(item.grounded, true, item.title)
      assert.ok(SAMPLE_TRANSCRIPT.includes(item.quote))
    }
  })

  it("keeps owners and dates that the notes actually support", () => {
    const byQuote = new Map(result.actionItems.map((item) => [item.quote, item]))
    assert.equal(byQuote.get(QUOTE.audit)?.owner, "林知夏")
    assert.equal(byQuote.get(QUOTE.audit)?.dueDate, "2026-03-20")
    assert.equal(byQuote.get(QUOTE.design)?.dueDate, "2026-03-25")
    assert.equal(byQuote.get(QUOTE.sales)?.dueDate, "2026-03-27")
    assert.equal(byQuote.get(QUOTE.handbook)?.dueDate, "2026-03-31")
    assert.equal(byQuote.get(QUOTE.legal)?.owner, "周衡")
    assert.equal(byQuote.get(QUOTE.legal)?.dueDate, null)
    assert.equal(byQuote.get(QUOTE.competitor)?.owner, null)
    assert.equal(byQuote.get(QUOTE.competitor)?.dueDate, null)
    assert.equal(byQuote.get(QUOTE.schedule)?.dueTime, null)
  })

  it("does not turn the conditional export remark into an action", () => {
    assert.equal(
      result.actionItems.some((item) => item.quote.includes(QUOTE.notAction)),
      false,
    )
    assert.equal(result.meetingDate, "2026-03-18")
    assert.equal(result.mode, "offline-demo")
  })

  it("refuses other transcripts when no model is configured", () => {
    assert.throws(
      () => extractOffline("这是另一场会议，请大家会后同步进展，负责人待定。"),
      (error: unknown) => error instanceof AppError && error.code === "LLM_NOT_CONFIGURED",
    )
  })
})
