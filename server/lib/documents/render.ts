import { DEFAULT_LOCALE, translate, type Locale } from '../../../shared/i18n'
import { escapeHtml } from './text'
import type { Book } from './epub'
import type { Sheet } from './xlsx'

const STYLE = `
:root { color-scheme: light dark; --bg: #f1f0f5; --paper: #fff; --ink: #0c0c14; --weak: #5c5958; --line: #e3e1ea; --head: #f7f6fa; --accent: #6d4aff }
@media (prefers-color-scheme: dark) { :root { --bg: #16141c; --paper: #22202b; --ink: #f0eef5; --weak: #a7a4b5; --line: #3a3746; --head: #2a2834; --accent: #9e87ff } }
* { box-sizing: border-box }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif }
a { color: var(--accent) }
img { max-width: 100%; height: auto }
.paper { max-width: 816px; margin: 24px auto; padding: 56px 64px; background: var(--paper); border-radius: 8px; box-shadow: 0 1px 3px rgb(0 0 0 / .1); overflow-wrap: anywhere }
.paper table { border-collapse: collapse; margin: 1em 0 }
.paper td, .paper th { border: 1px solid var(--line); padding: 4px 8px; vertical-align: top }
.note { max-width: 816px; margin: 16px auto 0; padding: 0 16px; color: var(--weak); font-size: 13px }
nav { display: flex; gap: 4px; overflow-x: auto; padding: 12px 16px; background: var(--paper); border-bottom: 1px solid var(--line) }
nav a { flex: none; padding: 4px 12px; border-radius: 6px; color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 600 }
nav a:hover { background: var(--head) }
.sheet { padding: 16px }
.sheet h2 { margin: 8px 0 12px; font-size: 16px }
.scroll { width: fit-content; max-width: 100%; overflow-x: auto; background: var(--paper); border: 1px solid var(--line); border-radius: 8px }
.sheet table { border-collapse: collapse; font-size: 13px; line-height: 1.4 }
.sheet th, .sheet td { border: 1px solid var(--line); padding: 4px 8px; white-space: pre-wrap; min-width: 64px; max-width: 360px; text-align: left; vertical-align: top }
.sheet th { background: var(--head); color: var(--weak); font-weight: 600; text-align: center }
.sheet tr > th:first-child { min-width: 40px }
.empty { color: var(--weak); padding: 8px 0 }
.slide { position: relative; max-width: 960px; aspect-ratio: 16 / 9; margin: 24px auto; padding: 48px 64px; background: var(--paper); border-radius: 8px; box-shadow: 0 1px 3px rgb(0 0 0 / .1); overflow: hidden }
.slide h2 { margin: 0 0 16px; font-size: 28px; line-height: 1.25 }
.slide p { margin: 0 0 8px; font-size: 18px }
.slide .number { position: absolute; right: 16px; bottom: 12px; color: var(--weak); font-size: 12px }
.book { max-width: 680px; margin: 0 auto; padding: 32px 24px 96px; font: 18px/1.7 Charter, "Iowan Old Style", Georgia, Cambria, serif }
.book header { text-align: center; margin: 24px 0 40px }
.book header img { width: 180px; border-radius: 4px; box-shadow: 0 4px 16px rgb(0 0 0 / .2) }
.book header h1 { margin: 24px 0 4px; font-size: 30px; line-height: 1.2 }
.book header p { margin: 0; color: var(--weak); font: 15px/1.5 system-ui, sans-serif }
.toc { margin: 0 0 48px; padding: 12px 16px; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; font: 15px/1.5 system-ui, sans-serif }
.toc summary { cursor: pointer; font-weight: 600 }
.toc ol { margin: 8px 0 0; padding-left: 20px }
.toc a { color: var(--ink); text-decoration: none }
.toc a:hover { color: var(--accent) }
.chapter { padding-bottom: 32px; margin-bottom: 32px; border-bottom: 1px solid var(--line) }
.chapter:last-child { border-bottom: 0 }
.chapter h1, .chapter h2, .chapter h3 { line-height: 1.25 }
.chapter img { display: block; max-height: 80vh; width: auto; margin: 16px auto }
.chapter table { border-collapse: collapse }
.chapter td, .chapter th { border: 1px solid var(--line); padding: 4px 8px }
@media (max-width: 640px) { .book { padding: 16px 16px 64px; font-size: 17px } }
@media (max-width: 640px) { .paper { margin: 0; padding: 24px 16px; border-radius: 0 } .slide { aspect-ratio: auto; margin: 12px; padding: 24px } .slide h2 { font-size: 20px } .slide p { font-size: 15px } }
`

function page(title: string, body: string, locale: Locale) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`
}

const multiline = (value: string) => escapeHtml(value).replace(/\n/g, '<br>')

export const documentHtml = (title: string, html: string, locale: Locale = DEFAULT_LOCALE) => page(title, `<article class="paper">${html}</article>`, locale)

function columnName(index: number): string {
  return (index >= 26 ? columnName(Math.floor(index / 26) - 1) : '') + String.fromCharCode(65 + index % 26)
}

function sheetTable(sheet: Sheet, locale: Locale) {
  const width = Math.max(0, ...sheet.rows.map(row => row.length))
  if (width === 0) return `<p class="empty">${translate(locale, 'documents.emptySheet')}</p>`
  const head = `<tr><th></th>${Array.from({ length: width }, (_, i) => `<th>${columnName(i)}</th>`).join('')}</tr>`
  const body = sheet.rows.map((row, r) => `<tr><th>${r + 1}</th>${Array.from({ length: width }, (_, c) => `<td>${multiline(row[c] ?? '')}</td>`).join('')}</tr>`).join('')
  const more = sheet.truncated ? `<p class="empty">${translate(locale, 'documents.truncatedRows', { count: sheet.rows.length })}</p>` : ''
  return `<div class="scroll"><table>${head}${body}</table></div>${more}`
}

export function sheetsHtml(title: string, sheets: Sheet[], locale: Locale = DEFAULT_LOCALE) {
  const nav = sheets.length > 1 ? `<nav>${sheets.map((sheet, i) => `<a href="#sheet-${i + 1}" target="_self">${escapeHtml(sheet.name)}</a>`).join('')}</nav>` : ''
  const sections = sheets.map((sheet, i) => `<section class="sheet" id="sheet-${i + 1}"><h2>${escapeHtml(sheet.name)}</h2>${sheetTable(sheet, locale)}</section>`).join('')
  return page(title, nav + (sections || `<p class="note">${translate(locale, 'documents.emptyWorkbook')}</p>`), locale)
}

export function slidesHtml(title: string, slides: string[][], locale: Locale = DEFAULT_LOCALE) {
  const note = `<p class="note">${translate(locale, 'documents.slidesNote')}</p>`
  const sections = slides.map(([heading, ...rest], i) => `<section class="slide">${heading
    ? `<h2>${multiline(heading)}</h2>${rest.map(p => `<p>${multiline(p)}</p>`).join('')}`
    : `<p class="empty">${translate(locale, 'documents.emptySlide')}</p>`}<span class="number">${i + 1} / ${slides.length}</span></section>`).join('')
  return page(title, note + sections, locale)
}

export function bookHtml(title: string, book: Book, locale: Locale = DEFAULT_LOCALE) {
  const cover = book.cover ? `<img src="data:image/webp;base64,${book.cover.toString('base64')}" alt="">` : ''
  const heading = `<header>${cover}<h1>${escapeHtml(book.title || title)}</h1>${book.author ? `<p>${escapeHtml(book.author)}</p>` : ''}</header>`
  const toc = book.toc.length > 1
    ? `<details class="toc"><summary>${translate(locale, 'documents.contents')}</summary><ol>${book.toc.map(entry => `<li><a href="${escapeHtml(entry.href)}" target="_self">${escapeHtml(entry.label)}</a></li>`).join('')}</ol></details>`
    : ''
  const chapters = book.chapters.map(chapter => `<section class="chapter" id="${chapter.id}">${chapter.html}</section>`).join('')
  return page(book.title || title, `<main class="book">${heading}${toc}${chapters || `<p class="empty">${translate(locale, 'documents.emptyBook')}</p>`}</main>`, locale)
}
