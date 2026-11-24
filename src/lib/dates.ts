export const TIME_ZONE = "Asia/Shanghai"
export const DEFAULT_DURATION_MINUTES = 60

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function isIsoTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

export function addMinutes(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes))
  const pad = (value: number) => String(value).padStart(2, "0")
  return {
    date: `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`,
    time: `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}`,
  }
}

export function nextDate(date: string) {
  return addMinutes(date, "00:00", 24 * 60).date
}

export function formatChineseDate(iso: string) {
  if (!isIsoDate(iso)) return iso
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = "日一二三四五六"[date.getUTCDay()]
  return `${year}年${month}月${day}日 周${weekday}`
}

export function compactDate(iso: string) {
  return iso.replaceAll("-", "")
}

export function compactTime(time: string) {
  return time.replace(":", "") + "00"
}

export function formatUtcStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}
