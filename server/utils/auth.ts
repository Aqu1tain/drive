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
      const { html, text } = emailLayout(`Votre code de connexion : ${code}`, [
        `Saisissez ce code pour vous connecter à ${config.public.appName}.`,
        'Il expire dans 10 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
      ])
      await sendEmail(email, `${code} est votre code de connexion`, text, html)
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
