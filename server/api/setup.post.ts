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
    throw createError({ statusCode: 403, statusMessage: tr('errors.invalidSetupToken') })
  }
  if (await ownerExists()) throw createError({ statusCode: 409, statusMessage: tr('errors.ownerExists') })

  try {
    await createUser({ ...body, role: 'owner', emailVerified: true })
  }
  catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: tr('errors.ownerExists') })
    throw error
  }
  return { ok: true }
})
