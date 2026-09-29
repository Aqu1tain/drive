import mammoth from 'mammoth'
import { htmlToText } from './text'

export async function readDocx(data: Buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer: data })
  return { html, text: htmlToText(html) }
}
