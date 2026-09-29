import { and, eq, isNull } from 'drizzle-orm'
import type { ResourceItem } from '#shared/types/api'

export default defineEventHandler(async (event) => {
  const viewer = await requireShareViewer(event)
  const { user, accessRules, resources } = tables
  const db = useDB()
  const [owner] = await db.select({ name: user.name }).from(user).where(eq(user.role, 'owner')).limit(1)
  const sharedBy = owner?.name ?? tr('labels.theOwner')

  if (viewer.linkRule) {
    const { resource, access } = await requireReadable(viewer, viewer.linkRule.resourceId).catch(() => {
      throw createError({ statusCode: 410, statusMessage: tr('errors.contentGone'), data: { reason: 'gone' } })
    })
    const listing = resource.type === 'folder' ? await listFolder(viewer, resource.id) : null
    return {
      kind: 'link' as const,
      sharedBy,
      root: toItem(resource, { viewer, access }),
      items: listing?.items ?? [],
      expiresAt: viewer.linkRule.expiresAt?.toISOString() ?? null,
    }
  }

  const invitation = viewer.invitation!
  const shared = await db.select({ resource: resources }).from(accessRules)
    .innerJoin(resources, eq(accessRules.resourceId, resources.id))
    .where(and(eq(accessRules.invitationId, invitation.id), isNull(resources.deletedAt)))

  const items: ResourceItem[] = []
  for (const { resource } of shared) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) items.push(toItem(resource, { viewer, access }))
  }
  return {
    kind: 'invitation' as const,
    sharedBy,
    recipient: { name: invitation.name, email: invitation.email },
    root: null,
    items,
    expiresAt: invitation.expiresAt?.toISOString() ?? null,
  }
})
