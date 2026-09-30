import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: personNameSchema.min(1).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  role: z.enum(['owner', 'member', 'reader']).optional(),
  password: passwordSchema.optional(),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const person = await requirePerson(viewer, getRouterParam(event, 'id')!)
  const role = body.role ?? userRole(person.role)
  const status = body.status ?? person.status
  const takesSeat = role !== 'reader' && status === 'active'
  const tookSeat = person.role !== 'reader' && person.status === 'active'
  if (takesSeat && !tookSeat) await requireSeat()

  const { user } = tables
  const patch = { ...(body.name ? { name: body.name } : {}), ...(body.status ? { status: body.status } : {}), ...(body.role ? { role: body.role } : {}) }
  if (Object.keys(patch).length) await useDB().update(user).set(patch).where(eq(user.id, person.id))
  if (body.role === 'member' && person.role === 'reader') await createPersonalFolder({ id: person.id, name: body.name ?? person.name, email: person.email })
  if (body.password) await setPassword(person.id, body.password)
  if (body.status === 'disabled' || body.password || (body.role && body.role !== person.role)) await revokeSessions(person.id)
  return { ok: true }
})
