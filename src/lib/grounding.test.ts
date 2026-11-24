import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { findQuoteSpan, highlightSegments } from "./grounding"

describe("grounding", () => {
  const source = "甲乙丙丁。\n审计日志周五前冻结。"

  it("finds an exact quote", () => {
    assert.deepEqual(findQuoteSpan(source, "审计日志周五前冻结"), {
      start: source.indexOf("审计日志周五前冻结"),
      end: source.indexOf("审计日志周五前冻结") + "审计日志周五前冻结".length,
    })
  })

  it("finds a quote when whitespace differs", () => {
    const span = findQuoteSpan(source, "审计日志 周五前冻结")
    assert.ok(span)
    assert.equal(source.slice(span.start, span.end).replace(/\s/g, ""), "审计日志周五前冻结")
  })

  it("does not ground a quote that is not in the notes", () => {
    assert.equal(findQuoteSpan(source, "下周一之前必须上线"), null)
  })

  it("splits overlapping quotes without dropping characters", () => {
    const text = "abcdef"
    const segments = highlightSegments(text, [
      { id: "a", quote: "cd", kind: "action" },
      { id: "b", quote: "de", kind: "decision" },
    ])
    assert.equal(segments.map((segment) => segment.text).join(""), text)
    assert.deepEqual(
      segments.map((segment) => segment.ids),
      [[], ["a"], ["a", "b"], ["b"], []],
    )
  })
})
