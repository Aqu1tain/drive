export const TAG_COLORS = ['#8a6cff', '#3b82f6', '#0ea5a4', '#22a55a', '#d99a00', '#f06a28', '#e5484d', '#d6409f'] as const
export const MAX_TAG_LENGTH = 40

/** Quotes are dropped: they delimit tag names in search queries (`tag:"à relancer"`). */
export const cleanTagName = (raw: string) => raw.normalize('NFC').replace(/[\u0000-\u001F\u007F"]/g, '').replace(/\s+/g, ' ').trim()
