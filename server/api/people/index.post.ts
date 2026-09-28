import { z } from 'zod'

const bodySchema = z.object({
  email: emailSchema,
  name: personNameSchema.min(1, 'Indiquez un nom'),
  password: passwordSchema,
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  if (await findUserByEmail(body.email)) throw createError({ statusCode: 409, statusMessage: 'Un compte existe déjà avec cette adresse' })
  const created = await createUser({ ...body, role: 'reader', emailVerified: true })
  setResponseStatus(event, 201)
  return { id: created.id }
})
