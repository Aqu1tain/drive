export interface AccessNode {
  id: string
  inheritAccess: boolean
  deletedAt: Date | null
}

export interface AccessRuleLike {
  id: string
  resourceId: string
  kind: 'user' | 'invitation' | 'link'
  userId: string | null
  invitationId: string | null
  allowDownload: boolean
  expiresAt: Date | null
}

export interface InvitationLike {
  id: string
  mode: 'account' | 'link'
  status: 'pending' | 'accepted' | 'revoked'
  expiresAt: Date | null
}

export interface AccessContext {
  isOwner: boolean
  userId?: string
  invitation?: InvitationLike
  linkRuleId?: string
}

export interface Access {
  read: boolean
  download: boolean
  manage: boolean
  grants: AccessRuleLike[]
}

export const NO_ACCESS: Access = Object.freeze({ read: false, download: false, manage: false, grants: [] })
const OWNER_ACCESS: Access = Object.freeze({ read: true, download: true, manage: true, grants: [] })

export const ANONYMOUS: AccessContext = Object.freeze({ isOwner: false })

export function isExpired(expiresAt: Date | null, now: Date) {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime()
}

export function isInvitationUsable(invitation: InvitationLike, now: Date) {
  return invitation.mode === 'link' && invitation.status === 'pending' && !isExpired(invitation.expiresAt, now)
}

export function ruleMatches(ctx: AccessContext, rule: AccessRuleLike, now: Date) {
  if (isExpired(rule.expiresAt, now)) return false
  if (rule.kind === 'user') return !!ctx.userId && rule.userId === ctx.userId
  if (rule.kind === 'link') return !!ctx.linkRuleId && rule.id === ctx.linkRuleId
  if (!ctx.invitation || rule.invitationId !== ctx.invitation.id) return false
  return isInvitationUsable(ctx.invitation, now)
}

/** Rules that apply to a resource: its own, then its ancestors' until inheritance is broken. `chain` goes from the resource up to the root. */
export function effectiveRules<R extends AccessRuleLike>(chain: AccessNode[], rules: R[]) {
  const result: Array<{ rule: R, inheritedFrom: string | null }> = []
  for (const [depth, node] of chain.entries()) {
    for (const rule of rules) {
      if (rule.resourceId === node.id) result.push({ rule, inheritedFrom: depth === 0 ? null : node.id })
    }
    if (!node.inheritAccess) break
  }
  return result
}

function accessFromGrants(grants: AccessRuleLike[]): Access {
  if (grants.length === 0) return NO_ACCESS
  return { read: true, download: grants.some(g => g.allowDownload), manage: false, grants }
}

export function resolveAccess(ctx: AccessContext, chain: AccessNode[], rules: AccessRuleLike[], now = new Date()): Access {
  if (chain.length === 0) return NO_ACCESS
  if (ctx.isOwner) return OWNER_ACCESS
  if (chain.some(node => node.deletedAt)) return NO_ACCESS

  const grants = effectiveRules(chain, rules)
    .map(({ rule }) => rule)
    .filter(rule => ruleMatches(ctx, rule, now))
  return accessFromGrants(grants)
}

/** Access of a direct child when the parent's access is already known: avoids reloading the chain for every row of a listing. */
export function resolveChildAccess(ctx: AccessContext, parentAccess: Access, child: AccessNode, childRules: AccessRuleLike[], now = new Date()): Access {
  if (ctx.isOwner) return OWNER_ACCESS
  if (child.deletedAt) return NO_ACCESS

  const own = childRules.filter(rule => rule.resourceId === child.id && ruleMatches(ctx, rule, now))
  const inherited = child.inheritAccess ? parentAccess.grants : []
  return accessFromGrants([...own, ...inherited])
}

export const canRead = (access: Access) => access.read
export const canDownload = (access: Access) => access.download
export const canManage = (access: Access) => access.manage
