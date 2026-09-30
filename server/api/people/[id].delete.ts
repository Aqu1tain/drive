import { eq } from 'drizzle-orm'

/** Their shares go with them; what they created stays in the drive. */
export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const person = await requirePerson(viewer, getRouterParam(event, 'id')!)
  await revokeSessions(person.id)
  await useDB().delete(tables.user).where(eq(tables.user.id, person.id))
  return { deleted: person.id }
})
