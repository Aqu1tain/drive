const UNITS = ['octets', 'Ko', 'Mo', 'Go', 'To']

export function formatSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} ${bytes > 1 ? 'octets' : 'octet'}`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${UNITS[unit]}`
}

const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const full = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const long = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' })

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
const daysAgo = (date: Date) => Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)

/** Compact date for lists: "11:42", "Hier", "12 sept.", "12 sept. 2025". */
export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const days = daysAgo(date)
  if (days === 0) return time.format(date)
  if (days === 1) return 'Hier'
  return date.getFullYear() === new Date().getFullYear() ? dayMonth.format(date) : full.format(date)
}

/** Readable date with time: "Aujourd'hui, 11:42", "Hier, 21:17", "12 septembre 2026". */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const days = daysAgo(date)
  if (days === 0) return `Aujourd’hui, ${time.format(date)}`
  if (days === 1) return `Hier, ${time.format(date)}`
  return `${long.format(date)}, ${time.format(date)}`
}

export const formatLongDate = (value: string | Date) => long.format(new Date(value))
export const formatTime = (value: string | Date) => time.format(new Date(value))

/** Day heading for activity feeds: "Aujourd'hui", "Hier", "Lundi", "12 septembre 2026". */
export function formatDay(value: string | Date) {
  const date = new Date(value)
  const days = daysAgo(date)
  if (days === 0) return 'Aujourd’hui'
  if (days === 1) return 'Hier'
  if (days < 7) return weekday.format(date).replace(/^./, c => c.toUpperCase())
  return long.format(date)
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('fr-FR')} ${count > 1 ? pluralForm : singular}`
}

export function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}
