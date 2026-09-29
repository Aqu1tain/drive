import { describe, expect, it } from 'vitest'
import { DOCX, PPTX, XLSX, deriveDocument, readsContent } from '../../server/lib/documents'
import { readPdf } from '../../server/lib/documents/pdf'
import { readPptx } from '../../server/lib/documents/pptx'
import { htmlToText } from '../../server/lib/documents/text'
import { readXlsx } from '../../server/lib/documents/xlsx'
import { docx, pack, pdf } from '../fixtures'

const workbook = () => pack({
  'xl/workbook.xml': '<workbook><sheets><sheet name="Devis &amp; factures" sheetId="1" r:id="rId1"/><sheet name="Vide" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Client</t></si><si><r><t>Mon</t></r><r><t xml:space="preserve">tant</t></r></si></sst>',
  'xl/styles.xml': '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="0.00&quot; d&quot;"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml': `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>&lt;script&gt;alert(1)&lt;/script&gt;</t></is></c><c r="B2"><v>12400.5</v></c><c r="C2" s="1"><v>46023</v></c><c r="E2" t="b"><v>1</v></c></row>
    <row r="4"/>
    <row r="5"><c r="B5" s="2"><v>3</v></c><c r="C5"><f>SUM(B2:B4)</f></c></row>
  </sheetData></worksheet>`,
  'xl/worksheets/sheet2.xml': '<worksheet><sheetData/></worksheet>',
})

describe('spreadsheets', () => {
  it('reads sheets in order with their values', async () => {
    const [devis, empty] = await readXlsx(await workbook())
    expect(devis!.name).toBe('Devis & factures')
    expect(devis!.rows[0]).toEqual(['Client', 'Montant'])
    expect(devis!.rows[1]).toEqual(['<script>alert(1)</script>', '12\u202F400,5', '01/01/2026', '', 'VRAI'])
    expect(devis!.rows[2]).toEqual([])
    expect(devis!.rows[4]).toEqual(['', '3', '=SUM(B2:B4)'])
    expect(empty).toEqual({ name: 'Vide', rows: [], truncated: false })
  })

  it('renders an inert page and indexes the cells', async () => {
    const { html, text } = await deriveDocument(XLSX, 'Budget', await workbook())
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('href="#sheet-2"')
    expect(text).toContain('Montant')
  })
})

describe('presentations', () => {
  const deck = () => pack({
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slides/slide1.xml': '<p:sld><a:p><a:r><a:t>Bilan</a:t></a:r></a:p><a:p><a:pPr/><a:r><a:t>Ligne 1</a:t></a:r><a:br><a:rPr/></a:br><a:r><a:t>Ligne 2</a:t></a:r></a:p><a:p/></p:sld>',
    'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>Titre &amp; sommaire</a:t></a:r></a:p></p:sld>',
  })

  it('follows the presentation order, not file names', async () => {
    expect(await readPptx(await deck())).toEqual([['Titre & sommaire'], ['Bilan', 'Ligne 1\nLigne 2']])
  })

  it('renders one card per slide', async () => {
    const { html, text } = await deriveDocument(PPTX, 'Réunion', await deck())
    expect(html).toContain('<h2>Titre &amp; sommaire</h2>')
    expect(html).toContain('Ligne 1<br>Ligne 2')
    expect(html).toContain('2 / 2')
    expect(text).toContain('Bilan')
  })
})

describe('word documents', () => {
  it('converts paragraphs and extracts their text', async () => {
    const { html, text } = await deriveDocument(DOCX, 'CR', await docx(['Compte rendu &lt;b&gt;']))
    expect(html).toContain('<p>Compte rendu &lt;b&gt;</p>')
    expect(html).toContain('<base target="_blank">')
    expect(text?.trim()).toBe('Compte rendu <b>')
  })
})

describe('pdf', () => {
  it('renders the first page and reads the text', async () => {
    const { thumbnail, text } = await readPdf(pdf('Facture 2026-003', ['Prestation zanzibar']), 320)
    expect(thumbnail.subarray(8, 12).toString()).toBe('WEBP')
    expect(text).toContain('zanzibar')
  })

  it('refuses a broken file', async () => {
    await expect(readPdf(new TextEncoder().encode('%PDF-1.4 nothing'), 320)).rejects.toThrow()
  })
})

describe('text', () => {
  it('drops markup, scripts and styles from HTML', () => {
    expect(htmlToText('<style>p{}</style><p>Salut&nbsp;&amp; bienvenue</p><script>secret()</script>').replace(/\s+/g, ' ').trim()).toBe('Salut & bienvenue')
  })

  it('knows which files carry text', () => {
    expect(['application/pdf', DOCX, 'text/markdown', 'application/json', 'text/csv', 'text/html'].every(readsContent)).toBe(true)
    expect(['image/png', 'application/zip', 'video/mp4', null].some(readsContent)).toBe(false)
  })
})
