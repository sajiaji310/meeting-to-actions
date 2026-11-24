import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { requestOrigin } from "./env"

const previous = {
  APP_BASE_URL: process.env.APP_BASE_URL,
  VERCEL: process.env.VERCEL,
}

function restore() {
  if (previous.APP_BASE_URL === undefined) delete process.env.APP_BASE_URL
  else process.env.APP_BASE_URL = previous.APP_BASE_URL
  if (previous.VERCEL === undefined) delete process.env.VERCEL
  else process.env.VERCEL = previous.VERCEL
}

function request(headers: Record<string, string>) {
  return new Request("http://0.0.0.0:3847/api/auth/google", { headers })
}

describe("public origin", () => {
  afterEach(restore)

  it("prefers APP_BASE_URL and strips a trailing slash", () => {
    process.env.APP_BASE_URL = "https://notes.example.com/"
    assert.equal(requestOrigin(request({})), "https://notes.example.com")
  })

  it("builds an https origin from forwarded headers", () => {
    delete process.env.APP_BASE_URL
    delete process.env.VERCEL
    assert.equal(
      requestOrigin(
        request({
          host: "localhost:3847",
          "x-forwarded-host": "notes.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
      "https://notes.example.com",
    )
  })

  it("defaults to https on Vercel when the proto header is missing", () => {
    delete process.env.APP_BASE_URL
    process.env.VERCEL = "1"
    assert.equal(
      requestOrigin(request({ host: "meeting-to-actions.vercel.app" })),
      "https://meeting-to-actions.vercel.app",
    )
  })

  it("rewrites the local bind address and stays on http", () => {
    delete process.env.APP_BASE_URL
    delete process.env.VERCEL
    assert.equal(requestOrigin(request({ host: "0.0.0.0:3847" })), "http://127.0.0.1:3847")
  })
})
