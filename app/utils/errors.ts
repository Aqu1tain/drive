interface FetchErrorLike {
  statusCode?: number
  statusMessage?: string
  data?: { statusMessage?: string, message?: string, data?: Record<string, unknown> }
  message?: string
}

const GENERIC: Record<number, string> = {
  401: 'Votre session a expiré. Reconnectez-vous.',
  403: 'Vous n’avez pas les droits pour cette action.',
  404: 'Cet élément n’existe plus.',
  413: 'Ce fichier dépasse la taille autorisée.',
  429: 'Trop de tentatives. Réessayez dans une minute.',
  507: 'L’espace de stockage est plein.',
}

/** Turns any fetch failure into a sentence a person can act on. Never "Error 500". */
export function errorMessage(error: unknown, fallback = 'Une erreur est survenue. Réessayez.') {
  const e = error as FetchErrorLike
  const status = e?.statusCode
  const message = e?.data?.statusMessage ?? e?.statusMessage
  if (message && status && status < 500 && !/^(Bad Request|Not Found|Forbidden|Unauthorized|Validation Error)$/i.test(message)) return message
  if (status && GENERIC[status]) return GENERIC[status]
  if (!status && typeof navigator !== 'undefined' && !navigator.onLine) return 'Vous êtes hors ligne. Vérifiez votre connexion.'
  return fallback
}

export const errorReason = (error: unknown) => (error as FetchErrorLike)?.data?.data?.reason as string | undefined
export const errorStatus = (error: unknown) => (error as FetchErrorLike)?.statusCode
