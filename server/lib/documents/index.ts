import { DEFAULT_LOCALE, type Locale } from '../../../shared/i18n'
import { kindOf } from '../../../shared/utils/search'
import { readDocx } from './docx'
import { readPdf } from './pdf'
import { readPptx } from './pptx'
import { documentHtml, sheetsHtml, slidesHtml } from './render'
import { decodeText, htmlToText } from './text'
import { readXlsx } from './xlsx'

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const THUMBNAIL_WIDTH = 640

export interface Derived {
  text?: string
  html?: string
  thumbnail?: Buffer
}

const isPlainText = (mimeType: string) => mimeType !== 'text/html' && (kindOf('file', mimeType) === 'text' || /^text\//.test(mimeType))

export const readsContent = (mimeType: string | null) =>
  !!mimeType && (mimeType === 'application/pdf' || mimeType === DOCX || mimeType === XLSX || mimeType === PPTX || mimeType === 'text/html' || isPlainText(mimeType))

/** What a stored file yields for search (text), previews (a standalone HTML page) and lists (a thumbnail). */
export async function deriveDocument(mimeType: string, title: string, data: Buffer, locale: Locale = DEFAULT_LOCALE): Promise<Derived> {
  if (mimeType === 'application/pdf') return readPdf(new Uint8Array(data), THUMBNAIL_WIDTH)
  if (mimeType === DOCX) {
    const { html, text } = await readDocx(data)
    return { html: documentHtml(title, html, locale), text }
  }
  if (mimeType === XLSX) {
    const sheets = await readXlsx(data)
    return { html: sheetsHtml(title, sheets, locale), text: sheets.flatMap(sheet => [sheet.name, ...sheet.rows.flat()]).join(' ') }
  }
  if (mimeType === PPTX) {
    const slides = await readPptx(data)
    return { html: slidesHtml(title, slides, locale), text: slides.flat().join('\n') }
  }
  if (mimeType === 'text/html') return { text: htmlToText(decodeText(data)) }
  if (isPlainText(mimeType)) return { text: decodeText(data) }
  return {}
}
