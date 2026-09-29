import { attr, openPackage, relationships, runsText } from './ooxml'

/** The text of each slide in presentation order, one entry per paragraph. */
export async function readPptx(data: Buffer): Promise<string[][]> {
  const read = await openPackage(data)
  const [presentation, rels] = await Promise.all([read('ppt/presentation.xml'), read('ppt/_rels/presentation.xml.rels')])
  const targets = relationships(rels, 'ppt')
  const paths = [...presentation.matchAll(/<p:sldId\b[^>]*>/g)].map(([tag]) => targets.get(attr(tag, 'r:id'))).filter(path => path !== undefined)
  return Promise.all(paths.map(async path => paragraphs(await read(path))))
}

function paragraphs(xml: string) {
  return [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
    .map(([, paragraph]) => runsText(paragraph!.replace(/<a:br\b[^>]*?(?:\/>|>[\s\S]*?<\/a:br>)/g, '<a:t>\n</a:t>'), 'a:t').trim())
    .filter(Boolean)
}
