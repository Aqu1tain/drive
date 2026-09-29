import { attr, openPackage, relationships, runsText } from './ooxml'
import { decodeEntities } from './text'

export interface Sheet {
  name: string
  rows: string[][]
  truncated: boolean
}

const MAX_ROWS = 1000
const MAX_COLUMNS = 50
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58])
const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 10 })

export async function readXlsx(data: Buffer): Promise<Sheet[]> {
  const read = await openPackage(data)
  const [workbook, rels, sharedStrings, styles] = await Promise.all([
    read('xl/workbook.xml'),
    read('xl/_rels/workbook.xml.rels'),
    read('xl/sharedStrings.xml'),
    read('xl/styles.xml'),
  ])
  const strings = [...sharedStrings.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) => runsText(si!.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''), 't'))
  const dates = dateStyles(styles)
  const targets = relationships(rels, 'xl')

  const sheets: Sheet[] = []
  for (const [tag] of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const path = targets.get(attr(tag, 'r:id'))
    if (path) sheets.push({ name: attr(tag, 'name'), ...parseSheet(await read(path), strings, dates) })
  }
  return sheets
}

function parseSheet(xml: string, strings: string[], dates: Set<number>) {
  const rows: string[][] = []
  let truncated = false
  for (const [, rowAttrs, rowXml] of xml.matchAll(/<row\b([^>]*[^/])?>([\s\S]*?)<\/row>/g)) {
    const index = Number(attr(rowAttrs ?? '', 'r') || rows.length + 1) - 1
    if (index >= MAX_ROWS) {
      truncated = true
      break
    }
    const cells: string[] = []
    for (const [, cellAttrs, inner] of rowXml!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const column = columnIndex(attr(cellAttrs!, 'r')) ?? cells.length
      if (column >= MAX_COLUMNS) continue
      cells[column] = cellValue(cellAttrs!, inner ?? '', strings, dates)
    }
    rows[index] = Array.from(cells, value => value ?? '')
  }
  return { rows: Array.from(rows, row => row ?? []), truncated }
}

function cellValue(attrs: string, inner: string, strings: string[], dates: Set<number>) {
  const type = attr(attrs, 't')
  const raw = decodeEntities(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
  if (type === 's') return strings[Number(raw)] ?? ''
  if (type === 'inlineStr') return runsText(inner, 't')
  if (type === 'b') return raw === '1' ? 'VRAI' : 'FAUX'
  const formula = inner.match(/<f\b[^>]*>([\s\S]*?)<\/f>/)?.[1]
  if (raw === '' && formula) return `=${decodeEntities(formula)}`
  if (type === 'str' || type === 'e' || raw === '') return raw
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return dates.has(Number(attr(attrs, 's') || 0)) ? formatDate(value) : numberFormat.format(value)
}

function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0]
  if (!letters) return null
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

/** Indexes of cell styles whose number format displays a date or a time. */
function dateStyles(styles: string) {
  const custom = new Map([...styles.matchAll(/<numFmt\b[^>]*>/g)].map(([tag]) => [Number(attr(tag, 'numFmtId')), attr(tag, 'formatCode')]))
  const isDate = (id: number) => {
    const code = custom.get(id)
    if (code === undefined) return BUILTIN_DATE_FORMATS.has(id)
    return /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''))
  }
  const cellXfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? ''
  const formats = [...cellXfs.matchAll(/<xf\b[^>]*>/g)].map(([tag]) => Number(attr(tag, 'numFmtId') || 0))
  return new Set(formats.flatMap((id, index) => isDate(id) ? [index] : []))
}

function formatDate(serial: number) {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000))
  if (serial < 1) return date.toLocaleTimeString('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
  return date.toLocaleString('fr-FR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: serial % 1 ? 'short' : undefined })
}
