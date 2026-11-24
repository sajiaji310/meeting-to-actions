import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import {
  audioRejection,
  classifyUpload,
  PROVIDER_AUDIO_BYTES,
  resolveAudioLimit,
  VERCEL_AUDIO_BYTES,
} from "./audio-file"
import { AppError } from "./errors"
import { postprocess } from "./postprocess"
import { parseExtraction } from "./schema"
import { transcribeAudio, transcriptionFailure } from "./transcription"

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "TRANSCRIPTION_API_KEY",
  "TRANSCRIPTION_BASE_URL",
  "TRANSCRIPTION_MODEL",
  "TRANSCRIPTION_LANGUAGE",
] as const

const previous = new Map<string, string | undefined>()

function rememberEnv() {
  for (const key of ENV_KEYS) previous.set(key, process.env[key])
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = previous.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe("audio uploads", () => {
  it("accepts common recording formats and text notes", () => {
    assert.equal(classifyUpload({ name: "standup.mp3", type: "" }), "audio")
    assert.equal(classifyUpload({ name: "room.m4a", type: "application/octet-stream" }), "audio")
    assert.equal(classifyUpload({ name: "clip.wav", type: "audio/wav" }), "audio")
    assert.equal(classifyUpload({ name: "browser.webm", type: "video/webm" }), "audio")
    assert.equal(classifyUpload({ name: "notes.md", type: "" }), "text")
    assert.equal(classifyUpload({ name: "notes.txt", type: "text/plain" }), "text")
    assert.equal(classifyUpload({ name: "slides.pdf", type: "application/pdf" }), "unsupported")
  })

  it("rejects empty and oversized recordings before any API call", () => {
    const provider = { bytes: PROVIDER_AUDIO_BYTES, kind: "provider" as const }
    assert.equal(audioRejection({ name: "a.mp3", type: "audio/mpeg", size: 0 }, provider)?.code, "AUDIO_EMPTY")
    assert.equal(
      audioRejection({ name: "a.wav", type: "audio/wav", size: PROVIDER_AUDIO_BYTES + 1 }, provider)?.code,
      "AUDIO_TOO_LARGE",
    )
    assert.equal(audioRejection({ name: "a.mp3", type: "audio/mpeg", size: 32 }, provider), null)
  })

  it("uses a lower cap on Vercel so the request fits the 4.5MB body limit", () => {
    assert.deepEqual(resolveAudioLimit({ VERCEL: "1" }), {
      bytes: VERCEL_AUDIO_BYTES,
      kind: "vercel",
    })
    const rejection = audioRejection(
      { name: "long.mp3", type: "audio/mpeg", size: 5 * 1024 * 1024 },
      resolveAudioLimit({ VERCEL: "1" }),
    )
    assert.equal(rejection?.code, "AUDIO_TOO_LARGE")
    assert.match(rejection?.message ?? "", /4MB/)
    assert.match(rejection?.message ?? "", /4\.5MB/)
    assert.equal(
      audioRejection(
        { name: "short.mp3", type: "audio/mpeg", size: 1024 },
        resolveAudioLimit({ VERCEL: "1" }),
      ),
      null,
    )
    assert.equal(resolveAudioLimit({ AUDIO_MAX_BYTES: "1048576" }).kind, "configured")
    assert.equal(resolveAudioLimit({ AUDIO_MAX_BYTES: String(30 * 1024 * 1024) }).bytes, PROVIDER_AUDIO_BYTES)
  })

  it("turns provider duration and format errors into Chinese", () => {
    assert.match(transcriptionFailure(413, { error: { message: "Maximum content size limit exceeded" } }), /25MB/)
    assert.match(transcriptionFailure(400, { error: { message: "The audio file could not be decoded" } }), /无法读取/)
    assert.match(transcriptionFailure(401, {}), /拒绝了密钥/)
  })
})

describe("transcription request", () => {
  afterEach(() => {
    restoreEnv()
  })

  it("refuses to invent a transcript when no key is configured", async () => {
    rememberEnv()
    for (const key of ENV_KEYS) delete process.env[key]
    const file = new File([Uint8Array.from([1, 2, 3, 4])], "meeting.m4a", { type: "audio/mp4" })
    let called = false
    await assert.rejects(
      () =>
        transcribeAudio(file, async () => {
          called = true
          return new Response("{}")
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "TRANSCRIPTION_NOT_CONFIGURED",
    )
    assert.equal(called, false)
  })

  it("posts language zh to the transcriptions endpoint and returns the text", async () => {
    rememberEnv()
    process.env.OPENAI_API_KEY = "test-key"
    process.env.OPENAI_BASE_URL = "https://example.test/v1"
    process.env.TRANSCRIPTION_MODEL = "whisper-1"
    delete process.env.TRANSCRIPTION_API_KEY
    delete process.env.TRANSCRIPTION_BASE_URL

    const file = new File([Uint8Array.from([1, 2, 3, 4])], "meeting.wav", { type: "audio/wav" })
    const captured: { form: FormData | null; url: string } = { form: null, url: "" }
    const result = await transcribeAudio(file, async (input, init) => {
      captured.url = String(input)
      captured.form = init?.body instanceof FormData ? init.body : null
      return Response.json({ text: "林知夏周五前冻结接口。" })
    })

    assert.equal(captured.url, "https://example.test/v1/audio/transcriptions")
    assert.equal(captured.form?.get("model"), "whisper-1")
    assert.equal(captured.form?.get("language"), "zh")
    assert.equal(captured.form?.get("prompt"), "简体中文商务会议，包含负责人、日期和决定。")
    assert.equal(result.text, "林知夏周五前冻结接口。")
  })

  it("grounds quotes against the edited transcript, not an earlier draft", () => {
    const parsed = parseExtraction({
      meetingTitle: "转写会",
      meetingDate: null,
      summary: "林知夏承诺周五前冻结接口。",
      decisions: [],
      actionItems: [
        {
          title: "冻结接口",
          owner: "林知夏",
          dueDate: null,
          dueTime: null,
          dueDateEvidence: "周五前",
          quote: "周五前冻结接口",
        },
      ],
    })
    const edited = "林知夏：周五前冻结接口。"
    const current = postprocess(edited, parsed, { mode: "model", model: "test" })
    assert.equal(current.actionItems[0]?.grounded, true)

    const discardedDraft = "这段是转写初稿，后来被用户删掉了。"
    const stale = postprocess(discardedDraft, parsed, { mode: "model", model: "test" })
    assert.equal(stale.actionItems[0]?.grounded, false)
  })
})
