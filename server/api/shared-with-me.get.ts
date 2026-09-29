import { and, eq } from 'drizzle-orm'

/** Top-level resources shared with the reader; items already reachable through a shared parent are folded into it. */
export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  if (viewer.ctx.isOwner) throw createError({ statusCode: 400, statusMessage: tr('errors.readersOnly') })
  const { accessRules, resources } = tables
  const rows = await useDB().select({ resource: resources }).from(accessRules)
    .innerJoin(resources, eq(accessRules.resourceId, resources.id))
    .where(and(eq(accessRules.userId, viewer.user!.id), notInTrash))

  const readable = []
  for (const { resource } of rows) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) readable.push({ resource, access })
  }
  const ids = new Set(readable.map(r => r.resource.id))
  const items = readable
    .filter(({ resource }) => !resource.ancestorIds.some(id => ids.has(id)))
    .map(({ resource, access }) => toItem(resource, { viewer, access }))
  return { items: await withFolderPreviews(viewer, await withFavorites(viewer, items)) }
})
