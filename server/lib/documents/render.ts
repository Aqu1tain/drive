import { escapeHtml } from './text'
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
@media (max-width: 640px) { .paper { margin: 0; padding: 24px 16px; border-radius: 0 } .slide { aspect-ratio: auto; margin: 12px; padding: 24px } .slide h2 { font-size: 20px } .slide p { font-size: 15px } }
`

function page(title: string, body: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`
}

const multiline = (value: string) => escapeHtml(value).replace(/\n/g, '<br>')

export const documentHtml = (title: string, html: string) => page(title, `<article class="paper">${html}</article>`)

function columnName(index: number): string {
  return (index >= 26 ? columnName(Math.floor(index / 26) - 1) : '') + String.fromCharCode(65 + index % 26)
}

function sheetTable(sheet: Sheet) {
  const width = Math.max(0, ...sheet.rows.map(row => row.length))
  if (width === 0) return '<p class="empty">Feuille vide</p>'
  const head = `<tr><th></th>${Array.from({ length: width }, (_, i) => `<th>${columnName(i)}</th>`).join('')}</tr>`
  const body = sheet.rows.map((row, r) => `<tr><th>${r + 1}</th>${Array.from({ length: width }, (_, c) => `<td>${multiline(row[c] ?? '')}</td>`).join('')}</tr>`).join('')
  const more = sheet.truncated ? '<p class="empty">Seules les 1 000 premières lignes sont affichées.</p>' : ''
  return `<div class="scroll"><table>${head}${body}</table></div>${more}`
}

export function sheetsHtml(title: string, sheets: Sheet[]) {
  const nav = sheets.length > 1 ? `<nav>${sheets.map((sheet, i) => `<a href="#sheet-${i + 1}" target="_self">${escapeHtml(sheet.name)}</a>`).join('')}</nav>` : ''
  const sections = sheets.map((sheet, i) => `<section class="sheet" id="sheet-${i + 1}"><h2>${escapeHtml(sheet.name)}</h2>${sheetTable(sheet)}</section>`).join('')
  return page(title, nav + (sections || '<p class="note">Classeur vide</p>'))
}

export function slidesHtml(title: string, slides: string[][]) {
  const note = '<p class="note">Aperçu du texte des diapositives. Téléchargez le fichier pour la mise en page complète.</p>'
  const sections = slides.map(([heading, ...rest], i) => `<section class="slide">${heading
    ? `<h2>${multiline(heading)}</h2>${rest.map(p => `<p>${multiline(p)}</p>`).join('')}`
    : '<p class="empty">Diapositive sans texte</p>'}<span class="number">${i + 1} / ${slides.length}</span></section>`).join('')
  return page(title, note + sections)
}
