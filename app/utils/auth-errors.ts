interface AuthError {
  code?: string
  status?: number
  message?: string
}

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Adresse email ou mot de passe incorrect.',
  INVALID_OTP: 'Ce code est incorrect ou a expiré.',
  OTP_EXPIRED: 'Ce code a expiré. Demandez-en un nouveau.',
  TOO_MANY_ATTEMPTS: 'Trop de tentatives. Demandez un nouveau code.',
  INVALID_TWO_FACTOR_AUTHENTICATION: 'Code de vérification incorrect.',
  INVALID_CODE: 'Code de vérification incorrect.',
  PASSWORD_TOO_SHORT: 'Le mot de passe doit contenir au moins 10 caractères.',
  INVALID_PASSWORD: 'Mot de passe incorrect.',
  SESSION_EXPIRED: 'Pour des raisons de sécurité, reconnectez-vous avant cette action.',
}

export function authErrorMessage(error: AuthError | null | undefined, fallback = 'La connexion a échoué. Réessayez.') {
  if (!error) return fallback
  if (error.status === 429) return 'Trop de tentatives. Patientez une minute avant de réessayer.'
  if (error.status === 403 && /désactivé/i.test(error.message ?? '')) return 'Ce compte est désactivé. Contactez le propriétaire.'
  return (error.code && MESSAGES[error.code]) || fallback
}
