import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translate, type Locale, type MessageKey, type MessageParams } from '#shared/i18n'

const YEAR = 60 * 60 * 24 * 365

/** The language of the interface: the one this browser picked, otherwise the instance default (English unless configured). */
export const useLocale = () => useState<Locale>('locale', () => {
  const picked = useCookie(LOCALE_COOKIE).value
  if (isLocale(picked)) return picked
  const configured = useRuntimeConfig().public.defaultLocale
  return isLocale(configured) ? configured : DEFAULT_LOCALE
})

/** The current language outside a component (utilities, early errors); English when no Nuxt context exists. */
export function currentLocale(): Locale {
  try {
    return useLocale().value
  }
  catch {
    return DEFAULT_LOCALE
  }
}

/** `t` for plain modules: reads the language at call time. */
export const say = (key: MessageKey, params?: MessageParams) => translate(currentLocale(), key, params)

export function useI18n() {
  const locale = useLocale()
  const cookie = useCookie<string | null>(LOCALE_COOKIE, { maxAge: YEAR, sameSite: 'lax', path: '/' })
  const t = (key: MessageKey, params?: MessageParams) => translate(locale.value, key, params)

  /** Server messages, cached lists and pages rendered on the server all follow: the simplest is to start again. */
  function setLocale(value: Locale) {
    cookie.value = value
    locale.value = value
    if (import.meta.client) window.location.reload()
  }

  return { locale, t, setLocale }
}
