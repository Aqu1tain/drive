import JSZip from 'jszip'

/** A one-page PDF with real text, small enough to build inline. */
export function pdf(title: string, lines: string[]) {
  const text = [title, '', ...lines].map((line, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${760 - i * 22} Td (${line.replace(/[()\\]/g, '')}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Uint8Array(Buffer.from(out, 'latin1'))
}

export async function pack(files: Record<string, string | Uint8Array>) {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  return zip.generateAsync({ type: 'nodebuffer' })
}

export const docx = (paragraphs: string[]) => pack({
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
  '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(p => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`,
})

const xhtml = (title: string, body: string) => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title><style>p { color: red }</style></head><body>${body}</body></html>`

/** A small EPUB 3 book: a declared cover, a navigation document and two chapters that link to each other. */
export const epub = (cover: Uint8Array) => pack({
  'mimetype': 'application/epub+zip',
  'META-INF/container.xml': '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  'OEBPS/content.opf': `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Le Petit Voyage</dc:title><dc:creator>Jeanne Martin</dc:creator></metadata>
    <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="one"/><itemref idref="two"/></spine></package>`,
  'OEBPS/nav.xhtml': xhtml('Sommaire', '<nav epub:type="toc"><ol><li><a href="text/one.xhtml">Le départ</a></li><li><a href="text/two.xhtml#arrivee">L\'arrivée</a></li></ol></nav>'),
  'OEBPS/images/cover.png': cover,
  'OEBPS/text/one.xhtml': xhtml('Un', '<h1 class="title">Le départ</h1><p onclick="alert(1)" style="color: blue">Il était une fois une lanterne.</p><script>alert(1)</script><img src="../images/cover.png" alt="La couverture"/><p><a href="two.xhtml#arrivee">Aller à l\'arrivée</a> <a href="https://example.com">Un site</a> <a href="javascript:alert(1)">Piège</a></p>'),
  'OEBPS/text/two.xhtml': xhtml('Deux', '<h1 id="arrivee">L\'arrivée</h1><p>Et la lanterne brilla.</p>'),
})
