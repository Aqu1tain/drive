const UNITS = ['format.kb', 'format.mb', 'format.gb', 'format.tb'] as const

export function formatSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return say('format.bytes', { count: bytes })
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString(currentLocale(), { maximumFractionDigits: value < 10 ? 1 : 0 })} ${say(UNITS[unit]!)}`
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function dateFormat(style: 'time' | 'dayMonth' | 'full' | 'long' | 'weekday') {
  const locale = currentLocale()
  const key = `${locale}:${style}`
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    time: { hour: '2-digit', minute: '2-digit' },
    dayMonth: { day: 'numeric', month: 'short' },
    full: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    weekday: { weekday: 'long' },
  }
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale, options[style]))
  return formatters.get(key)!
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
const daysAgo = (date: Date) => Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)

/** Compact date for lists: "11:42", "Yesterday", "Sep 12", "Sep 12, 2025". */
export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const days = daysAgo(date)
  if (days === 0) return dateFormat('time').format(date)
  if (days === 1) return say('format.yesterday')
  return dateFormat(date.getFullYear() === new Date().getFullYear() ? 'dayMonth' : 'full').format(date)
}

/** Readable date with time: "Today, 11:42", "Yesterday, 21:17", "September 12, 2026, 09:05". */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const time = dateFormat('time').format(date)
  const days = daysAgo(date)
  if (days === 0) return say('format.todayAt', { time })
  if (days === 1) return say('format.yesterdayAt', { time })
  return say('format.dateAt', { date: dateFormat('long').format(date), time })
}

export const formatLongDate = (value: string | Date) => dateFormat('long').format(new Date(value))
export const formatTime = (value: string | Date) => dateFormat('time').format(new Date(value))

/** Day heading for activity feeds: "Today", "Yesterday", "Monday", "September 12, 2026". */
export function formatDay(value: string | Date) {
  const date = new Date(value)
  const days = daysAgo(date)
  if (days === 0) return say('format.today')
  if (days === 1) return say('format.yesterday')
  if (days < 7) return dateFormat('weekday').format(date).replace(/^./, c => c.toUpperCase())
  return formatLongDate(date)
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('fr-FR')} ${count > 1 ? pluralForm : singular}`
}

export function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}
