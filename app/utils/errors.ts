interface FetchErrorLike {
  statusCode?: number
  statusMessage?: string
  data?: { statusMessage?: string, message?: string, data?: Record<string, unknown> }
  message?: string
}

import type { MessageKey } from '#shared/i18n'

const GENERIC: Record<number, MessageKey> = {
  401: 'errors.client.sessionExpired',
  403: 'errors.client.forbidden',
  404: 'errors.client.gone',
  413: 'errors.client.tooLarge',
  429: 'errors.client.tooManyAttempts',
  507: 'errors.client.storageFull',
}

/** Turns any fetch failure into a sentence a person can act on, in their language. Never "Error 500". */
export function errorMessage(error: unknown, fallback = say('errors.client.generic')) {
  const e = error as FetchErrorLike
  const status = e?.statusCode
  const message = e?.data?.statusMessage ?? e?.statusMessage
  if (message && status && status < 500 && !/^(Bad Request|Not Found|Forbidden|Unauthorized|Validation Error)$/i.test(message)) return message
  if (status && GENERIC[status]) return say(GENERIC[status])
  if (!status && typeof navigator !== 'undefined' && !navigator.onLine) return say('errors.client.offline')
  return fallback
}

export const errorReason = (error: unknown) => (error as FetchErrorLike)?.data?.data?.reason as string | undefined
export const errorStatus = (error: unknown) => (error as FetchErrorLike)?.statusCode
