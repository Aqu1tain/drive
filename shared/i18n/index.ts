import en from './en'
import fr from './fr'

export const LOCALES = ['en', 'fr'] as const
export type Locale = typeof LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'drive_locale'
export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale)

/** Words that change with a count: `one` for a single item, `other` for the rest ("{count}" is replaced). */
export interface Plural {
  one: string
  other: string
}

type Leaf = string | Plural
type Tree = { [key: string]: Leaf | Tree }

/** Same keys as the English catalog, any wording: a key missing from another language is a type error. */
export type Catalog<T> = { [K in keyof T]: T[K] extends Leaf ? (T[K] extends string ? string : Plural) : Catalog<T[K]> }

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type MessageKey = Paths<typeof en>
export type MessageParams = Record<string, string | number>

const catalogs: Record<Locale, Tree> = { en, fr }

function lookup(tree: Tree, key: string) {
  let node: Leaf | Tree | undefined = tree
  for (const part of key.split('.')) node = typeof node === 'object' && !('one' in node && 'other' in node) ? (node as Tree)[part] : undefined
  return typeof node === 'string' || (node && 'one' in node) ? node as Leaf : undefined
}

export function translate(locale: Locale, key: MessageKey, params: MessageParams = {}) {
  const entry = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key
  const text = typeof entry === 'string' ? entry : entry[new Intl.PluralRules(locale).select(Number(params.count ?? 0)) === 'one' ? 'one' : 'other']
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    if (value === undefined) return match
    return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value
  })
}
