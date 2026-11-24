export type QuoteKind = "action" | "decision"

export type QuoteMark = {
  id: string
  quote: string
  kind: QuoteKind
}

export type QuoteSpan = {
  start: number
  end: number
}

export type HighlightSegment = {
  text: string
  ids: string[]
  kind: QuoteKind | "mixed" | null
}

function whitespaceMap(source: string) {
  let text = ""
  const map: number[] = []
  for (let index = 0; index < source.length; index += 1) {
    if (/\s/u.test(source[index] ?? "")) continue
    text += source[index]
    map.push(index)
  }
  return { text, map }
}

export function findQuoteSpan(source: string, quote: string): QuoteSpan | null {
  const needle = quote.trim()
  if (!needle) return null

  const exact = source.indexOf(needle)
  if (exact >= 0) {
    return { start: exact, end: exact + needle.length }
  }

  const sourceMap = whitespaceMap(source)
  const collapsed = needle.replace(/\s+/gu, "")
  if (!collapsed) return null
  const found = sourceMap.text.indexOf(collapsed)
  if (found < 0) return null

  const start = sourceMap.map[found]
  const end = sourceMap.map[found + collapsed.length - 1]
  if (start === undefined || end === undefined) return null
  return { start, end: end + 1 }
}

export function highlightSegments(
  source: string,
  marks: QuoteMark[],
): HighlightSegment[] {
  const spans: Array<QuoteSpan & { id: string; kind: QuoteKind }> = []

  for (const mark of marks) {
    const found = findQuoteSpan(source, mark.quote)
    if (!found || found.end <= found.start) continue
    spans.push({ ...found, id: mark.id, kind: mark.kind })
  }

  if (spans.length === 0) {
    return source ? [{ text: source, ids: [], kind: null }] : []
  }

  type Edge = {
    pos: number
    delta: 1 | -1
    id: string
    kind: QuoteKind
  }

  const edges: Edge[] = []
  for (const span of spans) {
    edges.push({ pos: span.start, delta: 1, id: span.id, kind: span.kind })
    edges.push({ pos: span.end, delta: -1, id: span.id, kind: span.kind })
  }
  edges.sort((a, b) => a.pos - b.pos || a.delta - b.delta)

  const active = new Map<string, QuoteKind>()
  const segments: HighlightSegment[] = []
  let cursor = 0

  const push = (end: number) => {
    if (end <= cursor) return
    const ids = [...active.keys()]
    const kinds = new Set(active.values())
    const kind =
      ids.length === 0 ? null : kinds.size > 1 ? "mixed" : [...kinds][0]
    segments.push({ text: source.slice(cursor, end), ids, kind })
    cursor = end
  }

  for (const edge of edges) {
    push(edge.pos)
    if (edge.delta === 1) active.set(edge.id, edge.kind)
    else active.delete(edge.id)
  }
  push(source.length)

  return segments.filter((segment) => segment.text.length > 0)
}
