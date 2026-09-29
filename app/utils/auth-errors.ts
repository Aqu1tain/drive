import type { MessageKey } from '#shared/i18n'

interface AuthError {
  code?: string
  status?: number
}

const MESSAGES: Record<string, MessageKey> = {
  INVALID_EMAIL_OR_PASSWORD: 'auth.errors.invalidCredentials',
  INVALID_OTP: 'auth.errors.invalidOtp',
  OTP_EXPIRED: 'auth.errors.otpExpired',
  TOO_MANY_ATTEMPTS: 'auth.errors.tooManyAttempts',
  INVALID_TWO_FACTOR_AUTHENTICATION: 'auth.errors.invalidCode',
  INVALID_CODE: 'auth.errors.invalidCode',
  PASSWORD_TOO_SHORT: 'auth.errors.passwordTooShort',
  INVALID_PASSWORD: 'auth.errors.invalidPassword',
  SESSION_EXPIRED: 'auth.errors.sessionExpired',
  ACCOUNT_DISABLED: 'auth.errors.accountDisabled',
}

export function authErrorMessage(error: AuthError | null | undefined, fallback = say('auth.errors.failed')) {
  if (!error) return fallback
  if (error.status === 429) return say('auth.errors.rateLimited')
  const key = error.code && MESSAGES[error.code]
  return key ? say(key) : fallback
}
