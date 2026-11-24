"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { ArrowLeft, Braces, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { ClientAction } from "@/components/action-card"
import { ReviewPanel, type ClientDecision } from "@/components/review-panel"
import { SyncPanel } from "@/components/sync-panel"
import { TranscriptPanel } from "@/components/transcript-panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { audioRejection, classifyUpload, PROVIDER_AUDIO_BYTES, UNSUPPORTED_UPLOAD_MESSAGE } from "@/lib/audio-file"
import { findQuoteSpan, type QuoteMark } from "@/lib/grounding"
import { buildConfirmedEvents, type UndatedChoice } from "@/lib/review"
import { SAMPLE_TRANSCRIPT } from "@/lib/sample"
import type {
  CalendarSyncResult,
  ExtractionResult,
  StatusResponse,
} from "@/lib/types"

type Stage = "edit" | "sync"

const EMPTY_STATUS: StatusResponse = {
  model: { configured: false, model: null, host: null },
  transcription: {
    configured: false,
    model: null,
    host: null,
    language: null,
    maxBytes: PROVIDER_AUDIO_BYTES,
    limitKind: "provider",
  },
  calendar: { configured: false, connected: false, email: null },
}

function withGrounding<T extends { quote: string; grounded: boolean }>(
  items: T[],
  transcript: string,
): T[] {
  return items.map((item) => ({
    ...item,
    grounded: item.quote.trim().length > 0 && findQuoteSpan(transcript, item.quote) !== null,
  }))
}

export function Workspace() {
  const [transcript, setTranscript] = useState("")
  const [sourceTranscript, setSourceTranscript] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [fromAudio, setFromAudio] = useState(false)
  const [stage, setStage] = useState<Stage>("edit")
  const [focusQuoteId, setFocusQuoteId] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusResponse>(EMPTY_STATUS)
  const [statusReady, setStatusReady] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingDate, setMeetingDate] = useState<string | null>(null)
  const [summary, setSummary] = useState("")
  const [mode, setMode] = useState<ExtractionResult["mode"]>("offline-demo")
  const [model, setModel] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [decisions, setDecisions] = useState<ClientDecision[]>([])
  const [actions, setActions] = useState<ClientAction[]>([])
  const [hasResult, setHasResult] = useState(false)
  const [undated, setUndated] = useState<Record<string, UndatedChoice | undefined>>({})
  const [jsonOpen, setJsonOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [results, setResults] = useState<CalendarSyncResult[] | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const pageOrigin = usePageOrigin()

  async function loadStatus() {
    try {
      const response = await fetch("/api/status")
      if (!response.ok) return
      setStatus((await response.json()) as StatusResponse)
    } finally {
      setStatusReady(true)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendar = params.get("calendar")
    if (calendar === "connected") toast.success("已连接 Google 日历")
    if (calendar === "error" || calendar === "not-configured") {
      toast.error(params.get("message") || "Google 日历还不可用")
    }
    if (calendar) window.history.replaceState({}, "", window.location.pathname)
    void loadStatus()
  }, [])

  const visibleDecisions = useMemo(
    () => withGrounding(decisions, transcript),
    [decisions, transcript],
  )
  const visibleActions = useMemo(
    () => withGrounding(actions, transcript),
    [actions, transcript],
  )

  const marks = useMemo<QuoteMark[]>(
    () => [
      ...visibleDecisions
        .filter((item) => item.quote.trim())
        .map((item) => ({ id: item.id, quote: item.quote, kind: "decision" as const })),
      ...visibleActions
        .filter((item) => item.quote.trim())
        .map((item) => ({ id: item.id, quote: item.quote, kind: "action" as const })),
    ],
    [visibleActions, visibleDecisions],
  )

  const plan = useMemo(
    () =>
      buildConfirmedEvents({
        meetingTitle,
        summary,
        items: visibleActions,
        undated,
      }),
    [visibleActions, meetingTitle, summary, undated],
  )
  const eventCount = plan.events.length

  const skippedCount = visibleActions.filter((item) => {
    if (!item.selected || item.dueDate) return false
    const choice = undated[item.id]
    return !choice || choice.mode === "skip"
  }).length

  function applyResult(result: ExtractionResult, source: string) {
    setMeetingTitle(result.meetingTitle)
    setMeetingDate(result.meetingDate)
    setSummary(result.summary)
    setMode(result.mode)
    setModel(result.model)
    setWarnings(result.warnings)
    setNotes(result.notes)
    setDecisions(result.decisions)
    setActions(
      result.actionItems.map((item) => ({
        id: item.id,
        title: item.title,
        owner: item.owner ?? "",
        dueDate: item.dueDate ?? "",
        dueTime: item.dueTime ?? "",
        dueDateEvidence: item.dueDateEvidence,
        quote: item.quote,
        grounded: item.grounded,
        selected: true,
        origin: "extracted",
        transcriptDueDate: item.dueDate,
      })),
    )
    setSourceTranscript(source)
    setHasResult(true)
    setStage("edit")
    setUndated({})
    setResults(null)
    setFocusQuoteId(null)
  }

  async function extract() {
    if (transcript.trim().length < 40 || transcript.length > 20_000) return
    setExtracting(true)
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      })
      const data = (await response.json()) as ExtractionResult & { error?: string }
      if (!response.ok) {
        toast.error(data.error || "提取失败")
        return
      }
      applyResult(data, transcript)
      toast.success(data.mode === "model" ? "已按模型结果生成审阅稿" : "已用示例的离线结果生成审阅稿")
    } catch {
      toast.error("提取请求没有完成")
    } finally {
      setExtracting(false)
    }
  }

  function loadSample() {
    if (transcript.trim() && transcript !== SAMPLE_TRANSCRIPT) {
      const ok = window.confirm("载入示例会替换当前纪要。")
      if (!ok) return
    }
    setTranscript(SAMPLE_TRANSCRIPT)
    setFromAudio(false)
    setFocusQuoteId(null)
  }

  async function receiveFile(file: File) {
    const kind = classifyUpload(file)
    if (kind === "audio") {
      await transcribeFile(file)
      return
    }
    if (kind === "text") {
      await uploadText(file)
      return
    }
    toast.error(UNSUPPORTED_UPLOAD_MESSAGE)
  }

  async function uploadText(file: File) {
    if (file.size > 100_000) {
      toast.error("文稿超过 100KB")
      return
    }
    const text = await file.text()
    if (text.includes("\u0000")) {
      toast.error("这不是纯文本文件")
      return
    }
    setTranscript(text)
    setFromAudio(false)
    setFocusQuoteId(null)
  }

  async function transcribeFile(file: File) {
    const rejection = audioRejection(file, {
      bytes: status.transcription.maxBytes || PROVIDER_AUDIO_BYTES,
      kind: status.transcription.limitKind,
    })
    if (rejection) {
      toast.error(rejection.message)
      return
    }
    if (transcript.trim() && !window.confirm("转写结果会替换当前纪要。")) return
    setTranscribing(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const response = await fetch("/api/transcribe", { method: "POST", body })
      const data = (await response.json().catch(() => null)) as { text?: string; error?: string } | null
      if (!response.ok || !data?.text) {
        toast.error(data?.error || "转写失败，没有写入文字。")
        return
      }
      setTranscript(data.text)
      setFromAudio(true)
      setFocusQuoteId(null)
      toast.success(
        data.text.length > 20_000
          ? "转写完成，但超过 2 万字。请先删到这一次会议，再提取。"
          : "转写完成。请先核对文字，再提取行动项。",
      )
    } catch {
      toast.error("转写请求没有完成，没有写入文字。")
    } finally {
      setTranscribing(false)
    }
  }

  function patchAction(id: string, patch: Partial<ClientAction>) {
    setActions((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        if ("quote" in patch) {
          next.grounded =
            next.quote.trim().length > 0 && findQuoteSpan(transcript, next.quote) !== null
        }
        return next
      }),
    )
    setResults(null)
  }

  function addAction() {
    const id = `act_${crypto.randomUUID()}`
    setActions((current) => [
      ...current,
      {
        id,
        title: "",
        owner: "",
        dueDate: "",
        dueTime: "",
        dueDateEvidence: null,
        quote: "",
        grounded: false,
        selected: true,
        origin: "manual",
        transcriptDueDate: null,
      },
    ])
    setStage("edit")
    window.setTimeout(() => {
      document.getElementById(`action-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 30)
  }

  async function downloadIcs() {
    if ("error" in plan) {
      toast.error(plan.error)
      return
    }
    setExporting(true)
    try {
      const response = await fetch("/api/calendar/ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan.request),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "导出失败")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "会议行动项.ics"
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("已下载 .ics。这只是文件，没有写入 Google 日历。")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  async function syncCalendar() {
    if ("error" in plan) {
      toast.error(plan.error)
      return
    }
    setSyncing(true)
    try {
      const response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan.request),
      })
      const data = (await response.json()) as {
        error?: string
        results?: CalendarSyncResult[]
        created?: number
        failed?: number
      }
      if (!response.ok || !data.results) {
        toast.error(data.error || "没有写入 Google 日历")
        return
      }
      setResults(data.results)
      if ((data.created ?? 0) > 0 && (data.failed ?? 0) === 0) {
        toast.success(`已写入 ${data.created} 条 Google 日历事件`)
      } else if ((data.created ?? 0) > 0) {
        toast.error(`写入了 ${data.created} 条，${data.failed} 条失败`)
      } else {
        toast.error("Google 日历没有接受这些事件")
      }
    } catch {
      toast.error("写入请求没有完成，不能视为已同步")
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    await fetch("/api/auth/google/logout", { method: "POST" })
    await loadStatus()
    toast.success("已断开 Google 日历")
  }

  const jsonText = JSON.stringify(
    {
      meetingTitle,
      meetingDate,
      summary,
      decisions: visibleDecisions.map(({ statement, quote, grounded }) => ({ statement, quote, grounded })),
      actionItems: visibleActions.map((item) => ({
        title: item.title,
        owner: item.owner.trim() || null,
        dueDate: item.dueDate || null,
        dueTime: item.dueTime || null,
        dueDateEvidence: item.dueDateEvidence,
        quote: item.quote,
        grounded: item.grounded,
        selected: item.selected,
      })),
    },
    null,
    2,
  )

  const selectedCount = visibleActions.filter((item) => item.selected).length

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="shrink-0 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center bg-seal font-serif text-lg text-primary-foreground shadow-[inset_0_0_0_2px_rgba(255,248,240,0.35)]">
              纪
            </div>
            <div>
              <h1 className="font-serif text-xl leading-none">会议纪要转待办</h1>
              <p className="mt-1 text-xs text-muted-foreground">审阅之后，才写入日历</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              className="rounded-full border px-2.5 py-1 text-xs"
              onClick={() => setHelpOpen(true)}
            >
              {statusReady
                ? status.model.configured
                  ? `模型 · ${status.model.model}`
                  : "模型 · 离线演示"
                : "模型 · 检查中"}
            </button>
            <button
              type="button"
              className="rounded-full border px-2.5 py-1 text-xs"
              onClick={() => setHelpOpen(true)}
            >
              {statusReady
                ? status.transcription.configured
                  ? `转写 · ${status.transcription.model}`
                  : "转写 · 未配置"
                : "转写 · 检查中"}
            </button>
            {status.calendar.connected ? (
              <button
                type="button"
                className="rounded-full border border-pine/30 bg-pine/10 px-2.5 py-1 text-xs text-pine"
                onClick={() => void disconnect()}
              >
                日历 · {status.calendar.email || "已连接"} · 断开
              </button>
            ) : status.calendar.configured ? (
              <a
                href="/api/auth/google"
                className="rounded-full border px-2.5 py-1 text-xs"
              >
                连接 Google 日历
              </a>
            ) : (
              <button
                type="button"
                className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
                onClick={() => setHelpOpen(true)}
              >
                日历 · 未配置
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-3 p-3 lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:overflow-hidden">
        <TranscriptPanel
          transcript={transcript}
          onTranscript={setTranscript}
          marks={marks}
          focusQuoteId={focusQuoteId}
          onClearFocus={() => setFocusQuoteId(null)}
          onLoadSample={loadSample}
          onFile={(file) => void receiveFile(file)}
          onExtract={() => void extract()}
          extracting={extracting}
          transcribing={transcribing}
          fromAudio={fromAudio}
        />

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border bg-card shadow-[0_12px_40px_-32px_rgba(70,40,20,0.45)] lg:min-h-0">
          <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
            <h2 className="font-serif text-base">{stage === "sync" ? "写入日历" : "审阅"}</h2>
            {hasResult ? (
              <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => setJsonOpen(true)}>
                <Braces />
                结构化结果
              </Button>
            ) : null}
          </header>

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-auto">
            {!hasResult && !extracting ? (
              <EmptyReview />
            ) : extracting && !hasResult ? (
              <Extracting />
            ) : stage === "sync" ? (
              <SyncPanel
                actions={visibleActions}
                undated={undated}
                onUndated={(id, choice) => {
                  setUndated((current) => ({ ...current, [id]: choice }))
                  setResults(null)
                }}
                onSelected={(id, selected) => patchAction(id, { selected })}
                planError={"error" in plan ? plan.error : null}
                eventCount={eventCount}
                skipped={skippedCount}
                calendar={status.calendar}
                results={results}
              />
            ) : (
              <ReviewPanel
                meetingTitle={meetingTitle}
                meetingDate={meetingDate}
                summary={summary}
                mode={mode}
                model={model}
                warnings={warnings}
                notes={notes}
                sourceDrift={Boolean(sourceTranscript) && sourceTranscript !== transcript}
                decisions={visibleDecisions}
                actions={visibleActions}
                onMeetingTitle={setMeetingTitle}
                onSummary={setSummary}
                onDecision={(id, patch) =>
                  setDecisions((current) =>
                    withGrounding(
                      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
                      transcript,
                    ),
                  )
                }
                onDeleteDecision={(id) => setDecisions((current) => current.filter((item) => item.id !== id))}
                onAction={patchAction}
                onDeleteAction={(id) => setActions((current) => current.filter((item) => item.id !== id))}
                onAddAction={addAction}
                onLocate={(mark) => setFocusQuoteId(mark.id)}
              />
            )}
          </div>

          {hasResult ? (
            <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3">
              {stage === "sync" ? (
                <Button type="button" variant="outline" onClick={() => setStage("edit")}>
                  <ArrowLeft />
                  返回修改
                </Button>
              ) : (
                <p className="mr-auto text-xs text-muted-foreground">已选 {selectedCount} 条</p>
              )}
              {stage === "edit" ? (
                <Button
                  type="button"
                  className="ml-auto h-10"
                  disabled={selectedCount === 0}
                  onClick={() => {
                    setResults(null)
                    setStage("sync")
                  }}
                >
                  确认所选，准备写入
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={exporting || eventCount === 0 || "error" in plan}
                    onClick={() => void downloadIcs()}
                  >
                    {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                    下载 .ics
                  </Button>
                  {status.calendar.configured && status.calendar.connected ? (
                    <Button
                      type="button"
                      className="h-10"
                      disabled={syncing || eventCount === 0 || "error" in plan}
                      onClick={() => void syncCalendar()}
                    >
                      {syncing ? <Loader2 className="animate-spin" /> : null}
                      写入 Google 日历
                    </Button>
                  ) : status.calendar.configured ? (
                    <Button render={<a href="/api/auth/google" />} className="h-10">
                      连接后写入
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" className="h-10" onClick={() => setHelpOpen(true)}>
                      日历未配置
                    </Button>
                  )}
                </>
              )}
            </footer>
          ) : null}
        </section>
      </main>

      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>当前审阅稿</DialogTitle>
            <DialogDescription>
              这是页面上的结构，包含你改过的字段。它还不是日历事件。
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-3 text-xs leading-5">
            {jsonText}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>模型、转写与日历</DialogTitle>
            <DialogDescription>
              没有密钥时，示例纪要仍可走完审阅和 .ics 导出。未配置转写时不会编造录音文字，未配置的日历也不会被伪装成已同步。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6">
            <p>
              模型：{status.model.configured ? `${status.model.model} @ ${status.model.host}` : "未配置，示例走离线提取。"}
            </p>
            <p>
              转写：
              {status.transcription.configured
                ? `${status.transcription.model} @ ${status.transcription.host}，语言 ${status.transcription.language}`
                : "未配置。设置 OPENAI_API_KEY，或单独的 TRANSCRIPTION_API_KEY。上传录音会得到说明，不会出现假稿。"}
            </p>
            <p>
              Google 日历：
              {status.calendar.connected
                ? `已连接 ${status.calendar.email || "账号"}`
                : status.calendar.configured
                  ? "已配置 OAuth，尚未授权。"
                  : "未配置。设置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 SESSION_SECRET 后重启。"}
            </p>
            <p className="break-all text-muted-foreground">
              Google 重定向 URI 必须与控制台完全一致：
              {pageOrigin ? `${pageOrigin}/api/auth/google/callback` : "/api/auth/google/callback"}
              。线上把它写成 https 地址，填进 GOOGLE_REDIRECT_URI。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function usePageOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  )
}

function EmptyReview() {
  return (
    <div className="space-y-6 px-5 py-8 sm:px-8">
      <div>
        <p className="font-serif text-2xl leading-snug">先有纪要，再谈待办。</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          贴上记录、上传文稿，或在配置转写后上传录音。转写结果先出现在左侧，改完再提取。确认之前不会碰日历。
        </p>
      </div>
      <ol className="space-y-4">
        {[
          ["结构化抽取", "模型按固定 JSON Schema 输出摘要、决定和行动项，而不是一段自由聊天。"],
          ["引用可回溯", "每条行动都带着原文。服务端会核对这段话是不是真的出现在纪要里。"],
          ["确认后再写", "缺负责人和缺日期会留空。你选定要写入的条目之后，才生成日历事件。"],
        ].map(([title, body], index) => (
          <li key={title} className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-serif text-seal">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Extracting() {
  return (
    <div className="space-y-3 px-5 py-8">
      <p className="font-serif text-xl">正在对照原文抽取</p>
      <p className="text-sm text-muted-foreground">这一步只读取纪要，不会创建日历事件。</p>
      <div className="space-y-2 pt-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}
