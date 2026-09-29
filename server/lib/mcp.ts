import { readsContent } from './documents'

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024
export const TEXT_UPLOAD_MAX_BYTES = 1024 * 1024

/** Formats every AI model accepts as an image. */
const MODEL_IMAGES = /^image\/(png|jpeg|gif|webp)$/

export type ReadPlan = { as: 'text' | 'image' } | { as: 'refused', reason: string }

const megabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`

/**
 * Reading needs the same right as a preview. Text is extracted like the preview shows it, but an image goes out
 * as the file itself: that is a copy, so it also needs the right to download.
 */
export function readPlan(file: { mimeType: string | null, size: number }, canDownload: boolean): ReadPlan {
  const mimeType = file.mimeType ?? 'application/octet-stream'
  if (MODEL_IMAGES.test(mimeType)) {
    if (!canDownload) return { as: 'refused', reason: 'Downloading is turned off for this share, so the image itself cannot be handed over.' }
    if (file.size > IMAGE_MAX_BYTES) return { as: 'refused', reason: `Images over ${megabytes(IMAGE_MAX_BYTES)} are not handed over.` }
    return { as: 'image' }
  }
  if (!readsContent(mimeType)) return { as: 'refused', reason: 'Only text files, PDF, Word, Excel, PowerPoint and HTML files can be read as text.' }
  if (file.size > DOCUMENT_MAX_BYTES) return { as: 'refused', reason: `Files over ${megabytes(DOCUMENT_MAX_BYTES)} are too large to read here.` }
  return { as: 'text' }
}

/** A slice of a long text, with where to resume. */
export function textWindow(text: string, offset: number, maxCharacters: number) {
  const slice = text.slice(offset, offset + maxCharacters)
  const end = offset + slice.length
  return { text: slice, totalCharacters: text.length, nextOffset: end < text.length ? end : null }
}
