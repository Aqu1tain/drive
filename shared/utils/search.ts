export const FILE_KINDS = ['folder', 'pdf', 'image', 'video', 'audio', 'document', 'spreadsheet', 'presentation', 'text', 'html', 'archive'] as const
export type FileKind = typeof FILE_KINDS[number] | 'other'

export const ACCESS_FILTERS = ['private', 'shared', 'public'] as const
export type AccessFilter = typeof ACCESS_FILTERS[number]

export interface SearchQuery {
  terms: string[]
  type?: FileKind
  access?: AccessFilter
  sharedWith?: string
  after?: string
  before?: string
  folderId?: string
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ACCESS_ALIASES: Record<string, AccessFilter> = {
  private: 'private', prive: 'private', privé: 'private',
  shared: 'shared', partage: 'shared', partagé: 'shared',
  public: 'public', link: 'public', lien: 'public',
}

const TYPE_ALIASES: Record<string, FileKind> = {
  dossier: 'folder', folder: 'folder',
  pdf: 'pdf',
  image: 'image', images: 'image', photo: 'image', photos: 'image',
  video: 'video', vidéo: 'video',
  audio: 'audio', son: 'audio', musique: 'audio',
  doc: 'document', document: 'document', word: 'document',
  sheet: 'spreadsheet', tableur: 'spreadsheet', spreadsheet: 'spreadsheet', excel: 'spreadsheet',
  slides: 'presentation', presentation: 'presentation', présentation: 'presentation',
  text: 'text', texte: 'text', markdown: 'text',
  html: 'html', web: 'html', page: 'html',
  zip: 'archive', archive: 'archive',
}

export function parseSearchQuery(input: string): SearchQuery {
  const query: SearchQuery = { terms: [] }
  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    const colon = token.indexOf(':')
    const key = colon > 0 ? token.slice(0, colon).toLowerCase() : ''
    const value = colon > 0 ? token.slice(colon + 1) : ''

    if (key === 'type' && TYPE_ALIASES[value.toLowerCase()]) query.type = TYPE_ALIASES[value.toLowerCase()]
    else if (key === 'access' && ACCESS_ALIASES[value.toLowerCase()]) query.access = ACCESS_ALIASES[value.toLowerCase()]
    else if ((key === 'shared' || key === 'with') && value) query.sharedWith = value.toLowerCase()
    else if (key === 'after' && DATE.test(value)) query.after = value
    else if (key === 'before' && DATE.test(value)) query.before = value
    else if (key === 'in' && UUID.test(value)) query.folderId = value
    else query.terms.push(token)
  }
  return query
}

export function stringifySearchQuery(query: SearchQuery) {
  return [
    ...query.terms,
    query.type && `type:${query.type}`,
    query.access && `access:${query.access}`,
    query.sharedWith && `shared:${query.sharedWith}`,
    query.after && `after:${query.after}`,
    query.before && `before:${query.before}`,
    query.folderId && `in:${query.folderId}`,
  ].filter(Boolean).join(' ')
}

const MIME_KINDS: Array<[RegExp, FileKind]> = [
  [/^application\/pdf$/, 'pdf'],
  [/^image\//, 'image'],
  [/^video\//, 'video'],
  [/^audio\//, 'audio'],
  [/^text\/html$|^application\/xhtml\+xml$/, 'html'],
  [/wordprocessingml|msword|opendocument\.text|rtf/, 'document'],
  [/spreadsheetml|ms-excel|opendocument\.spreadsheet|text\/csv/, 'spreadsheet'],
  [/presentationml|ms-powerpoint|opendocument\.presentation/, 'presentation'],
  [/zip|x-tar|gzip|x-7z|x-rar|x-bzip/, 'archive'],
  [/^text\/|json$|xml$|yaml$|javascript$/, 'text'],
]

export function kindOf(type: 'file' | 'folder', mimeType: string | null): FileKind {
  if (type === 'folder') return 'folder'
  if (!mimeType) return 'other'
  return MIME_KINDS.find(([pattern]) => pattern.test(mimeType))?.[1] ?? 'other'
}
