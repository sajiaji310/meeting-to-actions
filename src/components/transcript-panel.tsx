"use client"

import { useEffect, useRef } from "react"
import { AudioLines, FileUp, Loader2, ScrollText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { highlightSegments, type QuoteMark } from "@/lib/grounding"

const MAX_LENGTH = 20_000

export function TranscriptPanel({
  transcript,
  onTranscript,
  marks,
  focusQuoteId,
  onClearFocus,
  onLoadSample,
  onFile,
  onExtract,
  extracting,
  transcribing,
  fromAudio,
}: {
  transcript: string
  onTranscript: (value: string) => void
  marks: QuoteMark[]
  focusQuoteId: string | null
  onClearFocus: () => void
  onLoadSample: () => void
  onFile: (file: File) => void
  onExtract: () => void
  extracting: boolean
  transcribing: boolean
  fromAudio: boolean
}) {
  const textRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const tooLong = transcript.length > MAX_LENGTH
  const tooShort = transcript.trim().length < 40
  const segments = highlightSegments(transcript, marks)

  useEffect(() => {
    if (!focusQuoteId || !viewRef.current) return
    const target = viewRef.current.querySelector(
      `[data-quotes~="${CSS.escape(focusQuoteId)}"]`,
    )
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusQuoteId, transcript, segments.length])

  return (
    <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border bg-card shadow-[0_12px_40px_-32px_rgba(70,40,20,0.45)] lg:min-h-0">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <ScrollText className="size-4 text-seal" />
        <h2 className="font-serif text-base">纪要原文</h2>
        <span className="text-xs text-muted-foreground">{transcript.length} 字</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onLoadSample} disabled={transcribing}>
            载入示例
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={transcribing}
            onClick={() => textRef.current?.click()}
          >
            <FileUp />
            上传文稿
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={transcribing}
            onClick={() => audioRef.current?.click()}
          >
            <AudioLines />
            上传录音
          </Button>
          <input
            ref={textRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) onFile(file)
            }}
          />
          <input
            ref={audioRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.webm"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) onFile(file)
            }}
          />
        </div>
      </header>

      <div
        className="lg:min-h-0 lg:flex-1 lg:overflow-auto"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file && !transcribing) onFile(file)
        }}
      >
        {focusQuoteId ? (
          <div>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-2 text-xs backdrop-blur">
              <span className="text-muted-foreground">
                行动项为朱色，决定为青色。正在对照的片段颜色更深。
              </span>
              <Button type="button" variant="outline" size="xs" onClick={onClearFocus}>
                返回编辑
              </Button>
            </div>
            <div ref={viewRef} className="transcript-read">
              {segments.map((segment, index) => {
                if (!segment.kind) return <span key={index}>{segment.text}</span>
                const active = segment.ids.includes(focusQuoteId)
                return (
                  <mark
                    key={index}
                    data-kind={segment.kind}
                    data-quotes={segment.ids.join(" ")}
                    data-active={active ? "true" : "false"}
                  >
                    {segment.text}
                  </mark>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            {transcribing ? (
              <div className="flex items-center gap-2 border-b bg-muted/80 px-4 py-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                正在转写。完成前不会改动现有文字，也不会编造一份稿子。
              </div>
            ) : null}
            <textarea
              value={transcript}
              onChange={(event) => onTranscript(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !transcribing) {
                  event.preventDefault()
                  onExtract()
                }
              }}
              readOnly={transcribing}
              placeholder="在这里粘贴会议纪要，或拖入 .txt / .md。录音用 mp3、m4a、wav 或 webm，转写后再改。"
              className="transcript-editor min-h-[62vh] lg:h-full"
              spellCheck={false}
              aria-label="会议纪要原文"
            />
          </div>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t px-4 py-3">
        {tooLong ? (
          <p className="text-xs text-seal">超过 2 万字。请先截取这一次会议的内容。</p>
        ) : fromAudio ? (
          <p className="text-xs text-muted-foreground">
            这是转写稿，可以修改。提取和原文引用只对照这里的文字。
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            提取只读取纪要，不会创建日历事件。Ctrl 或 ⌘ 加 Enter 也可以提取。
          </p>
        )}
        <Button
          type="button"
          className="h-10 w-full"
          disabled={extracting || transcribing || tooShort || tooLong}
          onClick={onExtract}
        >
          {extracting ? <Loader2 className="animate-spin" /> : null}
          {extracting ? "正在抽取摘要、决定和行动项" : "提取行动项"}
        </Button>
      </footer>
    </section>
  )
}
