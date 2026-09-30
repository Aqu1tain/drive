import { z } from 'zod'

const bodySchema = z.object({
  email: emailSchema,
  name: personNameSchema.min(1, 'Indiquez un nom'),
  password: passwordSchema,
  role: z.enum(['owner', 'member', 'reader']).default('reader'),
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  if (await findUserByEmail(body.email)) throw createError({ statusCode: 409, statusMessage: tr('errors.accountExists') })
  if (body.role !== 'reader') await requireSeat()
  const created = await createUser({ ...body, emailVerified: true })
  if (body.role === 'member') await createPersonalFolder(created)
  setResponseStatus(event, 201)
  return { id: created.id }
})
