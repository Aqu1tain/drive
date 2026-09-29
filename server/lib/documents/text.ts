const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' }
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }

export const MAX_TEXT_LENGTH = 200_000
const MAX_TEXT_BYTES = 512 * 1024

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ESCAPES[char]!)

export function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match
    const code = entity[1] === 'x' || entity[1] === 'X' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match
  })
}

export function htmlToText(html: string) {
  const text = html
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(text)
}

export const decodeText = (data: Uint8Array) => new TextDecoder('utf-8').decode(data.subarray(0, MAX_TEXT_BYTES))
