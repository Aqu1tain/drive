const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/

/** Where the site starts inside the archive: its root, or its single top folder, as long as it holds an index.html. */
export function siteRoot(names: string[]): string | null {
  const files = names.filter(name => !name.endsWith('/') && !JUNK.test(name))
  if (files.includes('index.html')) return ''
  const tops = new Set(files.map(name => name.split('/')[0]))
  const [top] = tops
  return tops.size === 1 && files.includes(`${top}/index.html`) ? `${top}/` : null
}

/** The path a file is served at, or null for anything that could escape the site or is not part of it. */
export function sitePath(name: string, root: string) {
  if (!name.startsWith(root) || name.endsWith('/') || JUNK.test(name)) return null
  const path = name.slice(root.length)
  if (/[\\\u0000-\u001F]/.test(path)) return null
  return path.split('/').some(segment => segment === '' || segment === '.' || segment === '..') ? null : path
}

/** A request path mapped to a file: folders serve their index.html. */
export const siteFileFor = (path: string) => path === '' || path.endsWith('/') ? `${path}index.html` : path
