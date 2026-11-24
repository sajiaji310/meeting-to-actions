import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildConfirmedEvents, type ReviewItem } from "./review"

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: "act-1",
    title: "跟踪补充条款",
    owner: "周衡",
    dueDate: "",
    dueTime: "",
    dueDateEvidence: "尽快",
    quote: "这件事我来盯。",
    selected: true,
    origin: "extracted",
    transcriptDueDate: null,
    ...overrides,
  }
}

describe("confirmed events", () => {
  it("skips undated items unless the reviewer picks an all-day date", () => {
    const onlySkip = buildConfirmedEvents({
      meetingTitle: "例会",
      summary: "摘要",
      items: [item()],
      undated: { "act-1": { mode: "skip" } },
    })
    assert.ok("error" in onlySkip)
    assert.equal(onlySkip.events.length, 0)

    const skipped = buildConfirmedEvents({
      meetingTitle: "例会",
      summary: "摘要",
      items: [item(), item({ id: "act-2", title: "冻结字段", dueDate: "2026-03-20", transcriptDueDate: "2026-03-20" })],
      undated: { "act-1": { mode: "all-day", date: "" } },
    })
    assert.ok("error" in skipped)
    assert.equal(skipped.events.length, 1)
    assert.equal("request" in skipped, false)

    const dated = buildConfirmedEvents({
      meetingTitle: "例会",
      summary: "摘要",
      items: [item()],
      undated: { "act-1": { mode: "all-day", date: "2026-04-02" } },
    })
    assert.ok("request" in dated)
    assert.equal(dated.request.events[0]?.allDay, true)
    assert.equal(dated.request.events[0]?.dateSource, "reviewer")
    assert.equal(dated.request.confirmed, true)
  })

  it("keeps a transcript date and marks an edited date as reviewer-supplied", () => {
    const kept = buildConfirmedEvents({
      meetingTitle: "例会",
      summary: "摘要",
      items: [
        item({
          dueDate: "2026-03-20",
          transcriptDueDate: "2026-03-20",
          dueTime: "",
        }),
      ],
      undated: {},
    })
    assert.ok("request" in kept)
    assert.equal(kept.request.events[0]?.dateSource, "transcript")
    assert.equal(kept.request.events[0]?.allDay, true)

    const edited = buildConfirmedEvents({
      meetingTitle: "例会",
      summary: "摘要",
      items: [
        item({
          dueDate: "2026-03-21",
          dueTime: "09:30",
          transcriptDueDate: "2026-03-20",
        }),
      ],
      undated: {},
    })
    assert.ok("request" in edited)
    assert.equal(edited.request.events[0]?.dateSource, "reviewer")
    assert.equal(edited.request.events[0]?.allDay, false)
    assert.equal(edited.request.events[0]?.time, "09:30")
  })
})
