import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { getDocument, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'

/** Runs pdf.js in-process: the worker module is handed over instead of being loaded from a path the bundle may not ship. */
Object.assign(globalThis, { pdfjsWorker: pdfWorker })

type RenderCanvas = Parameters<PDFPageProxy['render']>[0]['canvas']

const MAX_TEXT_PAGES = 100
const MAX_THUMBNAIL_HEIGHT = 1280

export async function readPdf(data: Uint8Array, thumbnailWidth: number) {
  const task = getDocument({ data, disableFontFace: true, verbosity: 0 })
  try {
    const document = await task.promise
    const first = await document.getPage(1)
    const size = first.getViewport({ scale: 1 })
    const viewport = first.getViewport({ scale: Math.min(thumbnailWidth / size.width, MAX_THUMBNAIL_HEIGHT / size.height) })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await first.render({ canvas: canvas as unknown as RenderCanvas, viewport }).promise
    const thumbnail = await canvas.encode('webp', 80)

    const pages: string[] = []
    for (let number = 1; number <= Math.min(document.numPages, MAX_TEXT_PAGES); number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '))
      page.cleanup()
    }
    return { thumbnail, text: pages.join('\n') }
  }
  finally {
    await task.destroy()
  }
}
