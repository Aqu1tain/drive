import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import { epub } from '../fixtures'
import { deriveDocument } from '../../server/lib/documents'
import { readEpub, type Book } from '../../server/lib/documents/epub'

let book: Book
let cover: Uint8Array

beforeAll(async () => {
  cover = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#3355aa' } }).png().toBuffer()
  book = await readEpub(await epub(cover))
})

describe('readEpub', () => {
  it('reads the title, the author and the table of contents', () => {
    expect(book).toMatchObject({ title: 'Le Petit Voyage', author: 'Jeanne Martin' })
    expect(book.toc).toEqual([{ label: 'Le départ', href: '#c1' }, { label: 'L\'arrivée', href: '#c2-arrivee' }])
  })

  it('keeps the chapters in reading order, without anything that runs or styles', () => {
    expect(book.chapters.map(chapter => chapter.id)).toEqual(['c1', 'c2'])
    const [one, two] = book.chapters.map(chapter => chapter.html)
    expect(one).toContain('Il était une fois une lanterne.')
    expect(one).not.toMatch(/script|onclick|style|class=|alert|javascript/)
    expect(two).toContain('<h1 id="c2-arrivee">')
  })

  it('points links inside the book, keeps web links and inlines images', () => {
    const [one] = book.chapters.map(chapter => chapter.html)
    expect(one).toContain('href="#c2-arrivee"')
    expect(one).toContain('href="https://example.com"')
    expect(one).toMatch(/<img src="data:image\/png;base64,[\w+/=]+" alt="La couverture"/)
  })

  it('turns the declared cover into a thumbnail', async () => {
    const meta = await sharp(book.cover!).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 600, height: 900 })
  })

  it('gives search the text and previews a reader page', async () => {
    const derived = await deriveDocument('application/epub+zip', 'voyage.epub', await epub(cover), 'fr')
    expect(derived.text).toContain('Jeanne Martin')
    expect(derived.text).toContain('la lanterne brilla')
    expect(derived.html).toContain('<summary>Sommaire</summary>')
    expect(derived.thumbnail).toBeInstanceOf(Buffer)
  })

  it('refuses what is not a book', async () => {
    await expect(readEpub(Buffer.from('not a zip'))).rejects.toThrow()
  })
})
