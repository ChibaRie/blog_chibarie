export function formatDate(
  input?: string | null,
  withTime = false,
): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '-'

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (!withTime) return `${y}-${m}-${day}`

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

export function formatNumber(n?: number | null): string {
  const value = n ?? 0
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

/**
 * 把后端返回的时间字符串转成 Date，供日期选择器使用。
 * 后端存的是带时区的 RFC3339，new Date 会自动按浏览器所在时区呈现。
 */
export function toDate(input?: string | null): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 把日期转成**带本地时区偏移**的 RFC3339 字符串，如 2026-07-11T10:00:00+08:00。
 *
 * 必须显式带上偏移量：Go 的 time.Time 只认 RFC3339，不带偏移量的
 * "2026-07-11T10:00:00" 会直接解析失败。也不能用 UTC 的 "…Z"——
 * 那样 +08:00 时区的人把时间设成 10:00，存进去成了 UTC 10:00，
 * 前台读出来会显示 18:00，日期甚至可能串到第二天。
 */
export function toRfc3339(value?: Date | string | null): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}
