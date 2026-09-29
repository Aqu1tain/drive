import { eq } from 'drizzle-orm'
import { createAuth, type Auth } from '../lib/auth'

let instance: Auth | undefined

export function useAuth() {
  if (instance) return instance
  const config = useRuntimeConfig()
  const { user } = tables

  instance = createAuth({
    db: useDB(),
    secret: config.authSecret,
    appUrl: config.public.appUrl,
    appName: config.public.appName,
    async sendSignInCode(email, code) {
      const { html, text } = emailLayout(tr('emails.code.title', { code }), [
        tr('emails.code.intro', { app: config.public.appName }),
        tr('emails.code.expiry'),
      ])
      await sendEmail(email, tr('emails.code.subject', { code }), text, html)
    },
    async isUserActive(userId) {
      const [row] = await useDB().select({ status: user.status }).from(user).where(eq(user.id, userId)).limit(1)
      return row?.status === 'active'
    },
    async onSessionCreated(userId) {
      await useDB().update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, userId))
    },
  })
  return instance
}
