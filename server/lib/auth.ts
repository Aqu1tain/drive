import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, twoFactor } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { mcp } from '@better-auth/mcp'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as authSchema from '../database/schema/auth'
import { generateToken, hashToken } from './crypto'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** The MCP endpoint, when AI clients may connect: OAuth requires HTTPS, except on this machine during development. */
export function mcpResourceOf(appUrl: string) {
  const url = new URL('/mcp', appUrl)
  return url.protocol === 'https:' || LOOPBACK_HOSTS.has(url.hostname) ? url.toString() : null
}

/**
 * AI clients register themselves and act for a person who approved them. Access tokens are opaque and stored hashed,
 * so a revocation takes effect on the next request. Clients belong to no one: grants (consents, tokens) belong to people.
 */
function mcpServer(resource: string) {
  return mcp({
    resource,
    loginPage: '/oauth/login',
    consentPage: '/oauth/consent',
    scopes: ['offline_access'],
    grantTypes: ['authorization_code', 'refresh_token'],
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientPrivileges: () => false,
    disableJwtPlugin: true,
    storeTokens: { hash: token => hashToken(token) },
    generateOpaqueAccessToken: () => generateToken(),
    generateRefreshToken: () => generateToken(),
  })
}

/** MCP clients register without an application type, and as web apps their loopback redirect URIs would be refused. */
const registerAsNative = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/oauth2/register' || ctx.body?.application_type) return
  return { context: { body: { ...ctx.body, application_type: 'native' } } }
})

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
  const resource = mcpResourceOf(options.appUrl)
  return betterAuth({
    appName: options.appName,
    baseURL: options.appUrl,
    secret: options.secret,
    trustedOrigins: [options.appUrl],
    database: drizzleAdapter(options.db, { provider: 'pg', schema: authSchema }),
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
      ipAddress: { ipAddressHeaders: ['x-drive-client-ip'] },
    },
    hooks: { before: registerAsNative },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (options.isUserActive && !(await options.isUserActive(session.userId))) {
              throw new APIError('FORBIDDEN', { message: 'This account is disabled', code: 'ACCOUNT_DISABLED' })
            }
          },
          after: async (session) => {
            await options.onSessionCreated?.(session.userId)
          },
        },
      },
    },
    plugins: [
      passkey({ rpID: hostname, rpName: options.appName, origin: new URL(options.appUrl).origin }),
      twoFactor({ issuer: options.appName, backupCodeOptions: { storeBackupCodes: 'encrypted' } }),
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 600,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }) {
          if (type === 'sign-in') await options.sendSignInCode(email, otp)
        },
      }),
      ...(resource ? [mcpServer(resource)] : []),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
