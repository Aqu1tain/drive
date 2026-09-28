import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: personNameSchema.min(1).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  password: passwordSchema.optional(),
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const reader = await requireReader(getRouterParam(event, 'id')!)
  const { user } = tables
  const patch = { ...(body.name ? { name: body.name } : {}), ...(body.status ? { status: body.status } : {}) }
  if (Object.keys(patch).length) await useDB().update(user).set(patch).where(and(eq(user.id, reader.id), eq(user.role, 'reader')))
  if (body.password) await setPassword(reader.id, body.password)
  if (body.status === 'disabled' || body.password) await revokeSessions(reader.id)
  return { ok: true }
})
