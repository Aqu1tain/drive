import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const bodySchema = z.object({
  name: personNameSchema.min(1, 'Indiquez votre nom'),
  email: emailSchema,
  password: passwordSchema,
  token: z.string().optional(),
})

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const { setupToken } = useRuntimeConfig()
  if (setupToken && !sameSecret(body.token ?? '', setupToken)) {
    throw createError({ statusCode: 403, statusMessage: 'Jeton d’installation invalide' })
  }
  if (await ownerExists()) throw createError({ statusCode: 409, statusMessage: 'Le propriétaire existe déjà' })

  try {
    await createUser({ ...body, role: 'owner', emailVerified: true })
  }
  catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: 'Le propriétaire existe déjà' })
    throw error
  }
  return { ok: true }
})
