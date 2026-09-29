import { eq } from 'drizzle-orm'

/** Permanent deletion is only possible from the trash. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const resource = await requireOwned(getRouterParam(event, 'id')!)
  const chain = await loadChain(resource)
  if (!chain.some(node => node.deletedAt)) {
    throw createError({ statusCode: 409, statusMessage: tr('errors.trashFirst') })
  }
  const keys = await subtreeKeys([resource.id])
  await useDB().delete(tables.resources).where(eq(tables.resources.id, resource.id))
  await deleteBlobs(keys)
  return { deleted: resource.id }
})
