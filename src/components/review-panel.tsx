"use client"

import { Plus, Trash2 } from "lucide-react"

import { ActionCard, type ClientAction } from "@/components/action-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatChineseDate } from "@/lib/dates"
import type { QuoteMark } from "@/lib/grounding"
import { cn } from "@/lib/utils"

export type ClientDecision = {
  id: string
  statement: string
  quote: string
  grounded: boolean
}

export function ReviewPanel({
  meetingTitle,
  meetingDate,
  summary,
  mode,
  model,
  warnings,
  notes,
  sourceDrift,
  decisions,
  actions,
  onMeetingTitle,
  onSummary,
  onDecision,
  onDeleteDecision,
  onAction,
  onDeleteAction,
  onAddAction,
  onLocate,
}: {
  meetingTitle: string
  meetingDate: string | null
  summary: string
  mode: "model" | "offline-demo"
  model: string | null
  warnings: string[]
  notes: string[]
  sourceDrift: boolean
  decisions: ClientDecision[]
  actions: ClientAction[]
  onMeetingTitle: (value: string) => void
  onSummary: (value: string) => void
  onDecision: (id: string, patch: Partial<ClientDecision>) => void
  onDeleteDecision: (id: string) => void
  onAction: (id: string, patch: Partial<ClientAction>) => void
  onDeleteAction: (id: string) => void
  onAddAction: () => void
  onLocate: (mark: QuoteMark) => void
}) {
  const selected = actions.filter((item) => item.selected).length

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5">
      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-sm leading-6",
          mode === "model" ? "border-pine/30 bg-pine/10 text-foreground" : "border-seal/25 bg-seal/10",
        )}
      >
        {mode === "model" ? (
          <>
            由 {model ?? "模型"} 按 JSON Schema 抽取。引用已在服务端与原文核对，日历还没有被修改。
          </>
        ) : (
          <>
            离线演示提取：没有配置模型 API，示例纪要用的是事先核对过的结果。配置
            OPENAI_API_KEY 后，同一条纪要会改走模型。
          </>
        )}
      </div>

      {sourceDrift ? (
        <p className="text-xs leading-5 text-muted-foreground">
          原文已经改过，引用状态已重新核对。要按新原文重抽，再点一次「提取行动项」。
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-seal/30 bg-seal/10 px-3 py-2 text-sm text-seal">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {notes.length > 0 ? (
        <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground" htmlFor="meeting-title">
          会议
          {meetingDate ? ` · 纪要日期 ${formatChineseDate(meetingDate)}` : " · 纪要未写明日期"}
        </label>
        <Input
          id="meeting-title"
          value={meetingTitle}
          onChange={(event) => onMeetingTitle(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground" htmlFor="summary">
          摘要
        </label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(event) => onSummary(event.target.value)}
          className="min-h-28 font-serif text-base leading-7"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-lg">决定</h3>
          <span className="text-xs text-muted-foreground">{decisions.length} 条</span>
        </div>
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">这次没有抽出已经拍板的决定。</p>
        ) : (
          decisions.map((decision) => (
            <div key={decision.id} className="rounded-xl border p-3">
              <div className="mb-2 flex items-start gap-2">
                <Textarea
                  value={decision.statement}
                  onChange={(event) =>
                    onDecision(decision.id, { statement: event.target.value })
                  }
                  aria-label="决定"
                  className="min-h-14"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteDecision(decision.id)}
                  aria-label="删除这条决定"
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={decision.grounded ? "secondary" : "destructive"}>
                  {decision.grounded ? "引用已核对" : "引用未定位"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    onLocate({ id: decision.id, quote: decision.quote, kind: "decision" })
                  }
                >
                  在原文中定位
                </Button>
              </div>
              <Textarea
                value={decision.quote}
                onChange={(event) => onDecision(decision.id, { quote: event.target.value })}
                aria-label="决定的原文引用"
                className="mt-2 min-h-14 text-sm"
              />
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-lg">行动项</h3>
          <span className="text-xs text-muted-foreground">
            已选 {selected} / {actions.length}
          </span>
        </div>
        {actions.map((item, index) => (
          <ActionCard
            key={item.id}
            item={item}
            index={index}
            onChange={(patch) => onAction(item.id, patch)}
            onDelete={() => onDeleteAction(item.id)}
            onLocate={() => onLocate({ id: item.id, quote: item.quote, kind: "action" })}
          />
        ))}
        <Button type="button" variant="outline" onClick={onAddAction}>
          <Plus />
          添加行动项
        </Button>
      </section>
    </div>
  )
}
