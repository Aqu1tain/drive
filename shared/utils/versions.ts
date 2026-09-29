export const MAX_VERSIONS = 100
export const MAX_LABEL_LENGTH = 100

const DAY = 86_400_000
const WEEK = 7 * DAY

interface Version {
  id: string
  savedAt: Date
  label: string | null
}

/**
 * The versions automatic cleanup removes. Everything from the last day stays, then the latest of each day for a
 * month, then the latest of each week; named versions always stay, and a file keeps at most MAX_VERSIONS.
 * The value of an old version is in the state it captures, not in every save that led to it.
 */
export function versionsToPrune(versions: Version[], now = new Date()) {
  const newestFirst = versions.toSorted((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
  const seen = new Set<string>()
  const kept: Version[] = []
  const pruned: string[] = []
  for (const version of newestFirst) {
    if (version.label) continue
    const at = version.savedAt.getTime()
    const age = now.getTime() - at
    const slot = age < DAY ? version.id : age < 30 * DAY ? `day:${Math.floor(at / DAY)}` : `week:${Math.floor(at / WEEK)}`
    if (seen.has(slot)) pruned.push(version.id)
    else {
      seen.add(slot)
      kept.push(version)
    }
  }
  const room = Math.max(0, MAX_VERSIONS - (newestFirst.length - kept.length - pruned.length))
  return [...pruned, ...kept.slice(room).map(version => version.id)]
}

export const cleanVersionLabel = (raw: string) => raw.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH)
