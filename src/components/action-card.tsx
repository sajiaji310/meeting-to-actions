"use client"

import { LocateFixed, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dateHint, type ReviewItem } from "@/lib/review"
import { cn } from "@/lib/utils"

export type ClientAction = ReviewItem & {
  grounded: boolean
}

export function ActionCard({
  item,
  index,
  onChange,
  onDelete,
  onLocate,
}: {
  item: ClientAction
  index: number
  onChange: (patch: Partial<ClientAction>) => void
  onDelete: () => void
  onLocate: () => void
}) {
  const hint = dateHint(item)

  return (
    <article
      id={`action-${item.id}`}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-[0_1px_0_rgba(60,40,20,0.03)] sm:p-4",
        !item.selected && "opacity-65",
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.selected}
          onCheckedChange={(checked) => onChange({ selected: checked })}
          aria-label={`选择「${item.title || "未命名行动"}」`}
          className="mt-2"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 w-7 shrink-0 font-serif text-sm text-seal">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Input
              value={item.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="行动标题，用动词开头"
              aria-label="行动标题"
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="删除这条行动"
            >
              <Trash2 />
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">负责人</span>
              <Input
                value={item.owner}
                onChange={(event) => onChange({ owner: event.target.value })}
                placeholder="纪要未指定"
                aria-label="负责人"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">日期</span>
              <Input
                type="date"
                value={item.dueDate}
                onChange={(event) =>
                  onChange({
                    dueDate: event.target.value,
                    dueTime: event.target.value ? item.dueTime : "",
                  })
                }
                aria-label="日期"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">钟点</span>
              <Input
                type="time"
                value={item.dueTime}
                disabled={!item.dueDate}
                onChange={(event) => onChange({ dueTime: event.target.value })}
                aria-label="钟点"
              />
            </label>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">{hint}</p>

          <div className="rounded-lg bg-muted/70 px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  "text-xs",
                  item.quote.trim()
                    ? item.grounded
                      ? "text-pine"
                      : "text-seal"
                    : "text-muted-foreground",
                )}
              >
                {!item.quote.trim()
                  ? "还没有原文引用"
                  : item.grounded
                    ? "引用已在原文中定位"
                    : "引用未在原文中定位"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!item.quote.trim()}
                onClick={onLocate}
              >
                <LocateFixed />
                在原文中定位
              </Button>
            </div>
            <Textarea
              value={item.quote}
              onChange={(event) => onChange({ quote: event.target.value })}
              placeholder="从纪要里贴一段原话"
              aria-label="原文引用"
              className="min-h-16 bg-card text-sm leading-6"
            />
          </div>
        </div>
      </div>
    </article>
  )
}
