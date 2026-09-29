import { describe, expect, it } from 'vitest'
import { siteFileFor, sitePath, siteRoot } from '../../server/lib/site'

describe('siteRoot', () => {
  it('finds an index at the root', () => {
    expect(siteRoot(['index.html', 'style.css', 'img/'])).toBe('')
  })

  it('accepts a single top folder, ignoring what macOS adds', () => {
    expect(siteRoot(['monsite/', 'monsite/index.html', 'monsite/a.css', '__MACOSX/monsite/._index.html', '.DS_Store'])).toBe('monsite/')
  })

  it('is not a site without an index where it would be served', () => {
    expect(siteRoot(['a/index.html', 'b/index.html'])).toBeNull()
    expect(siteRoot(['docs/readme.md'])).toBeNull()
    expect(siteRoot(['site/sub/index.html'])).toBeNull()
  })
})

describe('sitePath', () => {
  it('strips the root', () => {
    expect(sitePath('monsite/css/app.css', 'monsite/')).toBe('css/app.css')
  })

  it('refuses anything that could escape the site', () => {
    for (const name of ['../etc/passwd', 'a/../../b', './x', 'a//b', 'a\\b', 'a/\u0000b', 'dossier/']) expect(sitePath(name, '')).toBeNull()
    expect(sitePath('autre/index.html', 'monsite/')).toBeNull()
    expect(sitePath('monsite/__MACOSX/x', 'monsite/')).toBeNull()
  })
})

describe('siteFileFor', () => {
  it('serves index.html for folders', () => {
    expect(siteFileFor('')).toBe('index.html')
    expect(siteFileFor('blog/')).toBe('blog/index.html')
    expect(siteFileFor('blog/post.html')).toBe('blog/post.html')
  })
})
