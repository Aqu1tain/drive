import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const reader = await requireReader(getRouterParam(event, 'id')!)
  await revokeSessions(reader.id)
  await useDB().delete(tables.user).where(eq(tables.user.id, reader.id))
  return { deleted: reader.id }
})
