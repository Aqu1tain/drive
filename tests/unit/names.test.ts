import { describe, expect, it } from 'vitest'
import { InvalidNameError, extensionOf, keepBothName, sanitizeName, searchKeyOf, splitName } from '../../shared/utils/names'

describe('sanitizeName', () => {
  it('neutralises path traversal', () => {
    expect(sanitizeName('../../../etc/passwd')).toBe('..-..-..-etc-passwd')
    expect(sanitizeName('..\\..\\windows\\system32')).toBe('..-..-windows-system32')
  })

  it('removes control characters and trims', () => {
    expect(sanitizeName('  rapport\u0000\n.pdf ')).toBe('rapport--.pdf')
  })

  it('rejects empty and dot names', () => {
    for (const name of ['', '   ', '.', '..']) expect(() => sanitizeName(name)).toThrow(InvalidNameError)
  })

  it('rejects names that are too long', () => {
    expect(() => sanitizeName('a'.repeat(256))).toThrow(InvalidNameError)
  })

  it('keeps html-looking names as plain text', () => {
    expect(sanitizeName('<img src=x onerror=alert(1)>.png')).toBe('<img src=x onerror=alert(1)>.png')
  })

  it('normalises unicode to NFC', () => {
    expect(sanitizeName('résumé.pdf')).toBe('résumé.pdf')
  })
})

describe('splitName', () => {
  it.each([
    ['rapport.pdf', 'rapport', 'pdf'],
    ['photo.jpg.exe', 'photo.jpg', 'exe'],
    ['archive.tar.gz', 'archive', 'tar.gz'],
    ['Makefile', 'Makefile', ''],
    ['.env', '.env', ''],
    ['trailing.', 'trailing.', ''],
  ])('%s', (name, base, extension) => {
    expect(splitName(name)).toEqual({ base, extension })
  })

  it('lowercases extensions', () => {
    expect(extensionOf('IMG_0001.JPG')).toBe('jpg')
    expect(extensionOf('README')).toBeNull()
  })
})

describe('keepBothName', () => {
  it('returns the name untouched when free', () => {
    expect(keepBothName('rapport.pdf', ['autre.pdf'])).toBe('rapport.pdf')
  })

  it('appends the first free counter', () => {
    expect(keepBothName('rapport.pdf', ['rapport.pdf'])).toBe('rapport (1).pdf')
    expect(keepBothName('rapport.pdf', ['rapport.pdf', 'rapport (1).pdf'])).toBe('rapport (2).pdf')
  })

  it('compares case-insensitively', () => {
    expect(keepBothName('Rapport.PDF', ['rapport.pdf'])).toBe('Rapport (1).PDF')
  })

  it('does not stack counters', () => {
    expect(keepBothName('rapport (1).pdf', ['rapport (1).pdf'])).toBe('rapport (2).pdf')
  })

  it('handles names without extension and compound extensions', () => {
    expect(keepBothName('Makefile', ['Makefile'])).toBe('Makefile (1)')
    expect(keepBothName('backup.tar.gz', ['backup.tar.gz'])).toBe('backup (1).tar.gz')
  })
})

describe('searchKeyOf', () => {
  it('ignores accents and case', () => {
    expect(searchKeyOf('Facture Été 2026.PDF')).toBe('facture ete 2026.pdf')
  })
})
