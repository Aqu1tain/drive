import type { H3Event } from 'h3'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translate, type Locale, type MessageKey, type MessageParams } from '#shared/i18n'

/** The language of everyone who has not picked one, and of what is made outside a request (previews). */
export function instanceLocale(): Locale {
  const configured = useRuntimeConfig().public.defaultLocale
  return isLocale(configured) ? configured : DEFAULT_LOCALE
}

function currentEvent(): H3Event | undefined {
  try {
    return useEvent()
  }
  catch {
    return undefined
  }
}

/** The language of the request being served: the visitor's pick, otherwise the instance default. */
export function requestLocale(event = currentEvent()): Locale {
  const picked = event && getCookie(event, LOCALE_COOKIE)
  return isLocale(picked) ? picked : instanceLocale()
}

export const tr = (key: MessageKey, params?: MessageParams) => translate(requestLocale(), key, params)
