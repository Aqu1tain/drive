import JSZip from 'jszip'
import { decodeEntities } from './text'

export async function openPackage(data: Buffer) {
  const zip = await JSZip.loadAsync(data)
  return (path: string) => zip.file(path)?.async('string') ?? Promise.resolve('')
}

export function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return match ? decodeEntities(match[1]!) : ''
}

/** Relationship id -> package path, resolved against the folder of the part that owns the relationships. */
export function relationships(xml: string, baseFolder: string) {
  return new Map([...xml.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => {
    const target = attr(tag, 'Target')
    return [attr(tag, 'Id'), target.startsWith('/') ? target.slice(1) : `${baseFolder}/${target}`]
  }))
}

export const runsText = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'g'))].map(match => decodeEntities(match[1]!)).join('')
