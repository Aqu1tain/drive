import { posix } from 'node:path'
import JSZip from 'jszip'
import sharp from 'sharp'
import { decodeEntities, escapeHtml, htmlToText } from './text'

const IMAGE_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_INLINED_BYTES = 40 * 1024 * 1024
const MAX_CHAPTERS = 1000
/** Tags whose content never shows in the reader: scripts, styles, embedded objects, forms and media. */
const DROPPED = /<(script|style|template|iframe|object|embed|form|audio|video|canvas|math|noscript|head)\b[\s\S]*?<\/\1\s*>|<(link|meta|base|source|track|input|button|param)\b[^>]*>/gi

interface Item {
  id: string
  path: string
  type: string
  properties: string
}

export interface Book {
  title: string
  author: string
  chapters: Array<{ id: string, html: string }>
  toc: Array<{ label: string, href: string }>
  cover?: Buffer
  text: string
}

/** An EPUB is a zip: the container names the package, which lists the files (manifest) and the reading order (spine). */
export async function readEpub(data: Buffer): Promise<Book> {
  const zip = await JSZip.loadAsync(data)
  const read = (path: string) => zip.file(path)?.async('string') ?? Promise.resolve('')
  const container = await read('META-INF/container.xml')
  const packagePath = attr(container.match(/<rootfile\b[^>]*>/)?.[0] ?? '', 'full-path')
  const opf = await read(packagePath)
  if (!opf) throw new Error('Not an EPUB package')

  const base = posix.dirname(packagePath)
  const items = new Map([...opf.matchAll(/<item\b[^>]*>/g)].map(([tag]): [string, Item] => [attr(tag, 'id'), {
    id: attr(tag, 'id'),
    path: resolve(base, attr(tag, 'href')),
    type: attr(tag, 'media-type'),
    properties: attr(tag, 'properties'),
  }]))
  const spine = [...opf.matchAll(/<itemref\b[^>]*>/g)]
    .map(([tag]) => items.get(attr(tag, 'idref')))
    .filter((item): item is Item => !!item && /x?html/.test(item.type))
    .slice(0, MAX_CHAPTERS)
  const anchors = new Map(spine.map((item, index) => [item.path, `c${index + 1}`]))

  const images = inliner(zip)
  const chapters = []
  for (const [index, item] of spine.entries()) {
    const source = await read(item.path)
    const body = source.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? source
    chapters.push({ id: `c${index + 1}`, html: await cleanChapter(body, item.path, `c${index + 1}`, anchors, images) })
  }

  return {
    title: metadata(opf, 'title'),
    author: metadata(opf, 'creator'),
    chapters,
    toc: await tableOfContents(read, items, anchors),
    cover: await coverOf(zip, opf, items, spine),
    text: chapters.map(chapter => htmlToText(chapter.html)).join('\n'),
  }
}

/** XHTML allows both quote styles. */
function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`))
  return match ? decodeEntities(match[1] ?? match[2]!) : ''
}

const metadata = (opf: string, name: string) =>
  decodeEntities(opf.match(new RegExp(`<dc:${name}\\b[^>]*>([^<]*)</dc:${name}>`))?.[1]?.trim() ?? '')

function resolve(from: string, href: string) {
  try {
    return posix.normalize(posix.join(from, decodeURIComponent(href.split('#')[0]!))).replace(/^\.\//, '')
  }
  catch {
    return ''
  }
}

/** Book images become data URIs, the only images the preview origin allows; past a budget, the rest are left out. */
function inliner(zip: JSZip) {
  let budget = MAX_INLINED_BYTES
  return async (path: string) => {
    const type = IMAGE_TYPES[posix.extname(path).slice(1).toLowerCase()]
    const file = type ? zip.file(path) : null
    if (!file) return null
    const data = await file.async('nodebuffer')
    if (data.length > MAX_IMAGE_BYTES || data.length > budget) return null
    budget -= data.length
    return `data:${type};base64,${data.toString('base64')}`
  }
}

/** Keeps the text and its structure, nothing that runs or loads: ids are scoped to the chapter, links point inside the page. */
async function cleanChapter(body: string, path: string, anchor: string, anchors: Map<string, string>, image: (path: string) => Promise<string | null>) {
  const folder = posix.dirname(path)
  let html = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROPPED, '')
    .replace(/<svg\b[\s\S]*?<image\b[^>]*?(?:xlink:)?href="([^"]*)"[\s\S]*?<\/svg>/gi, '<img src="$1" alt="">')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')

  const sources = [...new Set([...html.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)].map(match => match[1]!))]
  const inlined = new Map(await Promise.all(sources.map(async src => [src, await image(resolve(folder, src))] as const)))

  html = html.replace(/<(\/?)([a-z][\w:-]*)([^>]*)>/gi, (_, slash: string, tag: string, rest: string) => {
    if (slash) return `</${tag}>`
    const kept: string[] = []
    const id = attr(rest, 'id')
    if (id) kept.push(`id="${anchor}-${escapeHtml(id)}"`)
    if (tag.toLowerCase() === 'img') {
      const src = inlined.get(attr(rest, 'src'))
      if (!src) return ''
      kept.push(`src="${src}"`, `alt="${escapeHtml(attr(rest, 'alt'))}"`)
    }
    if (tag.toLowerCase() === 'a') {
      const href = linkTarget(attr(rest, 'href'), folder, anchors, anchor)
      if (href) kept.push(`href="${escapeHtml(href)}"`)
    }
    if (/^(td|th)$/i.test(tag)) for (const span of ['colspan', 'rowspan']) if (/^\d+$/.test(attr(rest, span))) kept.push(`${span}="${attr(rest, span)}"`)
    const name = tag.toLowerCase().replace(/^.*:/, '')
    return `<${name}${kept.length ? ` ${kept.join(' ')}` : ''}${/\/\s*$/.test(rest) ? ' /' : ''}>`
  })
  return html
}

/** Web links open outside; links into the book jump to the chapter, or the place within it. */
function linkTarget(href: string, folder: string, anchors: Map<string, string>, current?: string) {
  if (/^(https?:\/\/|mailto:)/i.test(href)) return href
  if (!href || /^[a-z][\w+.-]*:/i.test(href)) return null
  const [file, fragment] = href.split('#')
  const chapter = file ? anchors.get(resolve(folder, file)) : current
  if (!chapter) return null
  return `#${fragment ? `${chapter}-${fragment}` : chapter}`
}

/** The book's own table of contents: the EPUB 3 navigation document, or the EPUB 2 NCX. */
async function tableOfContents(read: (path: string) => Promise<string>, items: Map<string, Item>, anchors: Map<string, string>) {
  const all = [...items.values()]
  const nav = all.find(item => item.properties.split(/\s+/).includes('nav'))
  const toAnchor = (from: string, href: string) => linkTarget(href, posix.dirname(from), anchors)?.replace(/^(?!#).*/, '') || null
  if (nav) {
    const xml = await read(nav.path)
    const list = xml.match(/<nav\b[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? xml
    return [...list.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
      .map(([, rest, label]) => ({ label: htmlToText(label!).replace(/\s+/g, ' ').trim(), href: toAnchor(nav.path, attr(rest!, 'href')) }))
      .filter((entry): entry is { label: string, href: string } => !!entry.label && !!entry.href)
  }
  const ncx = all.find(item => item.type === 'application/x-dtbncx+xml')
  if (!ncx) return []
  const xml = await read(ncx.path)
  return [...xml.matchAll(/<navLabel>\s*<text>([\s\S]*?)<\/text>\s*<\/navLabel>\s*<content\b([^>]*)>/g)]
    .map(([, label, rest]) => ({ label: decodeEntities(label!).trim(), href: toAnchor(ncx.path, attr(rest!, 'src')) }))
    .filter((entry): entry is { label: string, href: string } => !!entry.label && !!entry.href)
}

/** The declared cover (EPUB 3 property or EPUB 2 meta), otherwise an image named cover, otherwise the first image of the book. */
async function coverOf(zip: JSZip, opf: string, items: Map<string, Item>, spine: Item[]) {
  const all = [...items.values()]
  const images = all.filter(item => /^image\/(jpeg|png|gif|webp|avif)$/.test(item.type))
  const declared = images.find(item => item.properties.split(/\s+/).includes('cover-image'))
    ?? items.get(attr(opf.match(/<meta\b[^>]*name="cover"[^>]*>/)?.[0] ?? '', 'content'))
    ?? images.find(item => /cover/i.test(item.id) || /cover/i.test(posix.basename(item.path)))
  let path = declared && /^image\//.test(declared.type) ? declared.path : undefined
  if (!path && spine[0]) {
    const first = await zip.file(spine[0].path)?.async('string') ?? ''
    const src = first.match(/<img\b[^>]*\ssrc="([^"]*)"/i)?.[1] ?? first.match(/<image\b[^>]*?(?:xlink:)?href="([^"]*)"/i)?.[1]
    if (src) path = resolve(posix.dirname(spine[0].path), src)
  }
  const file = path ? zip.file(path) : null
  if (!file) return undefined
  return sharp(await file.async('nodebuffer'), { limitInputPixels: 120_000_000, failOn: 'error' })
    .resize(640, 960, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
    .catch(() => undefined)
}
