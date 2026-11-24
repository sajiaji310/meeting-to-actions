import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { postprocess } from "./postprocess"
import { extractionJsonSchema, parseExtraction } from "./schema"

describe("extraction schema", () => {
  it("publishes a closed JSON schema", () => {
    const schema = extractionJsonSchema()
    assert.equal(schema.additionalProperties, false)
    assert.equal("$schema" in schema, false)
    const required = schema.required as string[]
    assert.ok(required.includes("actionItems"))
    assert.ok(required.includes("decisions"))
  })

  it("turns placeholder owners and unresolvable dates into null", () => {
    const parsed = parseExtraction({
      meetingTitle: "周会",
      meetingDate: "2026-02-31",
      summary: "只讨论了一件事。",
      decisions: [],
      actionItems: [
        {
          title: "整理材料",
          owner: "待定",
          dueDate: "尽快",
          dueTime: null,
          dueDateEvidence: null,
          quote: "整理材料这件事尽快做。",
        },
      ],
    })
    const result = postprocess("整理材料这件事尽快做。", parsed, {
      mode: "model",
      model: "test",
    })
    assert.equal(result.meetingDate, null)
    assert.equal(result.actionItems[0]?.owner, null)
    assert.equal(result.actionItems[0]?.dueDate, null)
    assert.equal(result.actionItems[0]?.dueDateEvidence, "尽快")
    assert.equal(result.actionItems[0]?.grounded, true)
  })

  it("flags a quote the model invented", () => {
    const parsed = parseExtraction({
      meetingTitle: "周会",
      meetingDate: null,
      summary: "讨论了进度。",
      decisions: [],
      actionItems: [
        {
          title: "完成不存在的任务",
          owner: "张三",
          dueDate: null,
          dueTime: null,
          dueDateEvidence: null,
          quote: "这段话纪要里根本没有。",
        },
      ],
    })
    const result = postprocess("今天只对齐了进度。", parsed, {
      mode: "model",
      model: "test",
    })
    assert.equal(result.actionItems[0]?.grounded, false)
    assert.ok(result.warnings.some((warning) => warning.includes("没有在原文中定位")))
  })
})
