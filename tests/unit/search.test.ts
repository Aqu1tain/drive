import { describe, expect, it } from 'vitest'
import { kindOf, parseSearchQuery, stringifySearchQuery } from '../../shared/utils/search'

describe('parseSearchQuery', () => {
  it('keeps plain words as terms', () => {
    expect(parseSearchQuery('  facture   2026 ')).toEqual({ terms: ['facture', '2026'] })
  })

  it('extracts power-user filters', () => {
    expect(parseSearchQuery('facture type:pdf access:public shared:Paul@Example.com after:2026-09-01 before:2026-10-01')).toEqual({
      terms: ['facture'],
      type: 'pdf',
      access: 'public',
      sharedWith: 'paul@example.com',
      after: '2026-09-01',
      before: '2026-10-01',
    })
  })

  it('understands french aliases', () => {
    expect(parseSearchQuery('type:dossier access:privé')).toMatchObject({ type: 'folder', access: 'private' })
  })

  it('treats unknown or malformed filters as terms', () => {
    expect(parseSearchQuery('type:unicorn after:yesterday note:1')).toEqual({ terms: ['type:unicorn', 'after:yesterday', 'note:1'] })
  })

  it('only accepts uuids as folder scope', () => {
    expect(parseSearchQuery('in:../../etc').folderId).toBeUndefined()
    expect(parseSearchQuery('in:8f311e17-e1c9-4a2b-9c3d-1234567890ab').folderId).toBe('8f311e17-e1c9-4a2b-9c3d-1234567890ab')
  })

  it('reads tags, quoted when they contain spaces', () => {
    expect(parseSearchQuery('devis tag:"À relancer" tag:urgent')).toEqual({ terms: ['devis'], tag: 'urgent' })
    expect(parseSearchQuery('devis tag:"À relancer"')).toEqual({ terms: ['devis'], tag: 'à relancer' })
    expect(parseSearchQuery('étiquette:Clients')).toEqual({ terms: [], tag: 'clients' })
    expect(stringifySearchQuery({ terms: ['devis'], tag: 'à relancer' })).toBe('devis tag:"à relancer"')
    expect(parseSearchQuery('tag:"')).toEqual({ terms: ['tag:"'] })
  })

  it('round-trips through stringify', () => {
    const input = 'facture type:pdf access:shared'
    expect(stringifySearchQuery(parseSearchQuery(input))).toBe(input)
  })
})

describe('kindOf', () => {
  it.each([
    ['application/pdf', 'pdf'],
    ['image/png', 'image'],
    ['image/svg+xml', 'image'],
    ['text/html', 'html'],
    ['text/markdown', 'text'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
    ['text/csv', 'spreadsheet'],
    ['application/zip', 'archive'],
    ['application/octet-stream', 'other'],
  ])('%s -> %s', (mime, kind) => {
    expect(kindOf('file', mime)).toBe(kind)
  })

  it('recognises folders and unknown files', () => {
    expect(kindOf('folder', null)).toBe('folder')
    expect(kindOf('file', null)).toBe('other')
  })
})
