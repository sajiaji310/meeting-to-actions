import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { sealJson, unsealJson } from "./seal"

describe("session seal", () => {
  it("round-trips a calendar session and rejects the wrong secret", () => {
    const payload = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 1_800_000_000_000,
      email: "owner@example.com",
    }
    const token = sealJson(payload, "test-secret")
    assert.deepEqual(unsealJson(token, "test-secret"), payload)
    assert.equal(unsealJson(token, "other-secret"), null)
    assert.equal(unsealJson(`${token}x`, "test-secret"), null)
  })
})
