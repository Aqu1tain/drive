import { fileTypeFromBuffer } from 'file-type'

const BY_EXTENSION: Record<string, string> = {
  txt: 'text/plain', log: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
  csv: 'text/csv', tsv: 'text/tab-separated-values', html: 'text/html', htm: 'text/html',
  css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', ts: 'text/plain', vue: 'text/plain',
  json: 'application/json', xml: 'application/xml', yaml: 'application/yaml', yml: 'application/yaml',
  toml: 'application/toml', sql: 'application/sql', sh: 'application/x-sh', py: 'text/x-python',
  svg: 'image/svg+xml', ics: 'text/calendar', vcf: 'text/vcard', srt: 'text/plain', vtt: 'text/vtt',
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', bmp: 'image/bmp', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', opus: 'audio/ogg',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf', epub: 'application/epub+zip',
  zip: 'application/zip', gz: 'application/gzip', 'tar.gz': 'application/gzip', tar: 'application/x-tar', '7z': 'application/x-7z-compressed', rar: 'application/vnd.rar',
}

/** Containers that file-type reports generically while the extension is more precise (docx, xlsx, epub... are zips). */
const GENERIC_SNIFFS = new Set(['application/zip', 'application/x-cfb', 'application/xml', 'application/octet-stream'])

/**
 * Binary signatures win over the extension: a renamed executable never becomes an "image".
 * Text formats have no signature, so the extension decides: they are always served inertly anyway.
 */
export async function detectMimeType(head: Uint8Array, extension: string | null) {
  const byExtension = extension ? BY_EXTENSION[extension] : undefined
  const sniffed = await fileTypeFromBuffer(head).catch(() => undefined)
  if (!sniffed) return byExtension ?? 'application/octet-stream'
  if (GENERIC_SNIFFS.has(sniffed.mime) && byExtension) {
    const container = sniffed.mime === 'application/zip' ? /zip|officedocument|opendocument|epub/ : /./
    return container.test(byExtension) ? byExtension : sniffed.mime
  }
  return sniffed.mime
}
