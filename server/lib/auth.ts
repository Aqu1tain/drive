import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, twoFactor } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export interface AuthOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PostgresJsDatabase<any>
  secret: string
  appUrl: string
  appName: string
  sendSignInCode: (email: string, code: string) => Promise<void>
  onSessionCreated?: (userId: string) => Promise<void>
  isUserActive?: (userId: string) => Promise<boolean>
}

export function createAuth(options: AuthOptions) {
  const { hostname, protocol } = new URL(options.appUrl)
  return betterAuth({
    appName: options.appName,
    baseURL: options.appUrl,
    secret: options.secret,
    trustedOrigins: [options.appUrl],
    database: drizzleAdapter(options.db, { provider: 'pg' }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 256,
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: true, defaultValue: 'reader', input: false },
        status: { type: 'string', required: true, defaultValue: 'active', input: false },
        lastLoginAt: { type: 'date', required: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 8 },
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 8 },
        '/two-factor/verify-totp': { window: 60, max: 8 },
      },
    },
    advanced: {
      cookiePrefix: 'drive',
      useSecureCookies: protocol === 'https:',
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (options.isUserActive && !(await options.isUserActive(session.userId))) return false
            return { data: session }
          },
          after: async (session) => {
            await options.onSessionCreated?.(session.userId)
          },
        },
      },
    },
    plugins: [
      passkey({ rpID: hostname, rpName: options.appName, origin: new URL(options.appUrl).origin }),
      twoFactor({ issuer: options.appName }),
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === 'sign-in') await options.sendSignInCode(email, otp)
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
