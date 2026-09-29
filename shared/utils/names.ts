export const MAX_NAME_LENGTH = 255

const COMPOUND_EXTENSIONS = ['tar.gz', 'tar.bz2', 'tar.xz', 'tar.zst']
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F/\\]/g

export class InvalidNameError extends Error {}

export function sanitizeName(raw: string) {
  const name = raw.normalize('NFC').replace(FORBIDDEN_CHARS, '-').trim()
  if (!name || name === '.' || name === '..') throw new InvalidNameError('Nom invalide')
  if (name.length > MAX_NAME_LENGTH) throw new InvalidNameError(`Le nom ne peut pas dépasser ${MAX_NAME_LENGTH} caractères`)
  return name
}

export function splitName(name: string) {
  const lower = name.toLowerCase()
  const compound = COMPOUND_EXTENSIONS.find(ext => lower.endsWith(`.${ext}`) && lower.length > ext.length + 1)
  if (compound) return { base: name.slice(0, -compound.length - 1), extension: name.slice(-compound.length) }

  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return { base: name, extension: '' }
  return { base: name.slice(0, dot), extension: name.slice(dot + 1) }
}

export function extensionOf(name: string) {
  return splitName(name).extension.toLowerCase() || null
}

export function searchKeyOf(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export const searchWordsOf = (value: string) => searchKeyOf(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** "rapport.pdf" -> "rapport (1).pdf", skipping names already taken (compared case-insensitively). */
export function keepBothName(name: string, taken: Iterable<string>) {
  const takenLower = new Set([...taken].map(n => n.toLowerCase()))
  if (!takenLower.has(name.toLowerCase())) return name

  const { base, extension } = splitName(name)
  const cleanBase = base.replace(/ \(\d+\)$/, '')
  const suffix = extension ? `.${extension}` : ''
  for (let i = 1; ; i++) {
    const candidate = `${cleanBase} (${i})${suffix}`
    if (!takenLower.has(candidate.toLowerCase())) return candidate
  }
}
