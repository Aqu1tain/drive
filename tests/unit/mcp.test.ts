import { describe, expect, it } from 'vitest'
import { mcpResourceOf } from '../../server/lib/auth'
import { DOCUMENT_MAX_BYTES, IMAGE_MAX_BYTES, readPlan, textWindow } from '../../server/lib/mcp'
import { isEmptySearch, parseSearchQuery } from '../../shared/utils/search'

describe('mcpResourceOf', () => {
  it('serves MCP over HTTPS, or over HTTP on this machine only', () => {
    expect(mcpResourceOf('https://drive.example.com')).toBe('https://drive.example.com/mcp')
    expect(mcpResourceOf('http://localhost:3000')).toBe('http://localhost:3000/mcp')
    expect(mcpResourceOf('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000/mcp')
    expect(mcpResourceOf('http://192.168.1.20:3000')).toBeNull()
  })
})

describe('readPlan', () => {
  const text = { mimeType: 'text/markdown', size: 100 }

  it('extracts text with read access alone', () => {
    expect(readPlan(text, false)).toEqual({ as: 'text' })
    expect(readPlan({ mimeType: 'application/pdf', size: 1000 }, false)).toEqual({ as: 'text' })
    expect(readPlan({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }, true)).toEqual({ as: 'text' })
  })

  it('hands images over only when they may be downloaded', () => {
    expect(readPlan({ mimeType: 'image/png', size: 1000 }, true)).toEqual({ as: 'image' })
    expect(readPlan({ mimeType: 'image/png', size: 1000 }, false).as).toBe('refused')
    expect(readPlan({ mimeType: 'image/jpeg', size: IMAGE_MAX_BYTES + 1 }, true).as).toBe('refused')
  })

  it('refuses what cannot be read as text, and very large documents', () => {
    expect(readPlan({ mimeType: 'video/mp4', size: 1000 }, true).as).toBe('refused')
    expect(readPlan({ mimeType: 'image/svg+xml', size: 1000 }, true).as).toBe('refused')
    expect(readPlan({ mimeType: null, size: 1000 }, true).as).toBe('refused')
    expect(readPlan({ mimeType: 'application/pdf', size: DOCUMENT_MAX_BYTES + 1 }, true).as).toBe('refused')
  })
})

describe('textWindow', () => {
  it('returns the whole text when it fits', () => {
    expect(textWindow('hello', 0, 10)).toEqual({ text: 'hello', totalCharacters: 5, nextOffset: null })
  })

  it('says where to resume a long text', () => {
    expect(textWindow('abcdefghij', 0, 4)).toEqual({ text: 'abcd', totalCharacters: 10, nextOffset: 4 })
    expect(textWindow('abcdefghij', 8, 4)).toEqual({ text: 'ij', totalCharacters: 10, nextOffset: null })
    expect(textWindow('abc', 5, 4)).toEqual({ text: '', totalCharacters: 3, nextOffset: null })
  })
})

describe('isEmptySearch', () => {
  it('needs a word or a filter, a folder alone is not enough', () => {
    expect(isEmptySearch(parseSearchQuery(''))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('in:8f311e17-3a0b-4c1e-9b1f-2d6f0c9a7e21'))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('type:pdf'))).toBe(false)
    expect(isEmptySearch(parseSearchQuery('facture'))).toBe(false)
  })
})
