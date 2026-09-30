import { eq } from 'drizzle-orm'

/** Revocation is immediate: every request re-resolves access, and frame tokens are re-checked too. */
export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const rule = await requireRule(getRouterParam(event, 'ruleId')!)
  const { resource } = await requireAccess(viewer, rule.resourceId, 'manage')
  const label = await ruleLabel(rule)
  await useDB().delete(tables.accessRules).where(eq(tables.accessRules.id, rule.id))
  await logOwnerAction(event, viewer, rule.resourceId, rule.kind === 'link' ? 'link_removed' : 'share_removed', label)
  return resourceAccess(resource)
})
