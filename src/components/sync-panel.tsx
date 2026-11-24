"use client"

import { ExternalLink } from "lucide-react"

import type { ClientAction } from "@/components/action-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatChineseDate } from "@/lib/dates"
import type { UndatedChoice } from "@/lib/review"
import type { CalendarSyncResult } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SyncPanel({
  actions,
  undated,
  onUndated,
  onSelected,
  planError,
  eventCount,
  skipped,
  calendar,
  results,
}: {
  actions: ClientAction[]
  undated: Record<string, UndatedChoice | undefined>
  onUndated: (id: string, choice: UndatedChoice) => void
  onSelected: (id: string, selected: boolean) => void
  planError: string | null
  eventCount: number
  skipped: number
  calendar: { configured: boolean; connected: boolean; email: string | null }
  results: CalendarSyncResult[] | null
}) {
  const selected = actions.filter((item) => item.selected)

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div>
        <h3 className="font-serif text-lg">确认后写入</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          到这一步为止，没有任何日历被修改。没有日期的行动默认跳过，避免把「尽快」写成某一天。
        </p>
      </div>

      {selected.length === 0 ? (
        <p className="rounded-lg border px-3 py-3 text-sm">没有勾选行动项。</p>
      ) : (
        <ul className="space-y-3">
          {selected.map((item) => {
            const choice = undated[item.id] ?? { mode: "skip" as const }
            return (
              <li key={item.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title || "未命名行动"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.owner.trim() ? `负责人 ${item.owner.trim()}` : "纪要未指定负责人"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onSelected(item.id, false)}
                  >
                    不写入
                  </Button>
                </div>

                {item.dueDate ? (
                  <p className="mt-3 text-sm">
                    {item.dueTime
                      ? `${formatChineseDate(item.dueDate)} ${item.dueTime}，默认 1 小时`
                      : `${formatChineseDate(item.dueDate)}，全天`}
                  </p>
                ) : (
                  <fieldset className="mt-3 space-y-2">
                    <legend className="text-xs text-muted-foreground">
                      纪要没有可写入日历的日期
                    </legend>
                    <label
                      className={cn(
                        "flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-sm",
                        choice.mode === "skip" && "border-seal/40 bg-seal/5",
                      )}
                    >
                      <input
                        type="radio"
                        name={`undated-${item.id}`}
                        checked={choice.mode === "skip"}
                        onChange={() => onUndated(item.id, { mode: "skip" })}
                      />
                      <span>不写入日历</span>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        choice.mode === "all-day" && "border-pine/40 bg-pine/5",
                      )}
                    >
                      <input
                        type="radio"
                        name={`undated-${item.id}`}
                        checked={choice.mode === "all-day"}
                        onChange={() =>
                          onUndated(item.id, {
                            mode: "all-day",
                            date: choice.mode === "all-day" ? choice.date : "",
                          })
                        }
                      />
                      <span>指定日期，记为全天事件</span>
                      {choice.mode === "all-day" ? (
                        <Input
                          type="date"
                          value={choice.date}
                          onChange={(event) =>
                            onUndated(item.id, { mode: "all-day", date: event.target.value })
                          }
                          aria-label={`${item.title}的全天日期`}
                          className="h-8 w-40"
                        />
                      ) : null}
                    </label>
                  </fieldset>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-sm">
        已备好 <span className="font-medium">{eventCount}</span> 条
        {skipped > 0 ? `，另有 ${skipped} 条因为没有日期而跳过` : ""}。
      </p>
      {planError ? <p className="text-sm text-seal">{planError}</p> : null}

      {!calendar.configured ? (
        <p className="rounded-lg border border-dashed px-3 py-3 text-sm leading-6 text-muted-foreground">
          Google 日历未配置，所以这里不会出现「已同步」之类的结果。下载的 .ics
          可以用系统日历，或 Google 日历的导入功能打开。
        </p>
      ) : calendar.connected ? (
        <p className="text-sm text-muted-foreground">
          将写入 {calendar.email || "已连接的 Google 账号"} 的主日历。
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          OAuth 已配置，但这个浏览器还没有授权。连接之后才能写入 Google 日历。
        </p>
      )}

      {results ? (
        <ul className="space-y-2">
          {results.map((result) => (
            <li key={result.id} className="rounded-lg border px-3 py-2 text-sm">
              {result.ok ? (
                result.htmlLink ? (
                  <a
                    href={result.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-pine underline-offset-4 hover:underline"
                  >
                    已写入 Google 日历
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  "已写入 Google 日历"
                )
              ) : (
                <span className="text-seal">{result.error || "没有写入"}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
