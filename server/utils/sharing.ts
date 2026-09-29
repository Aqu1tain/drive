import { and, eq } from 'drizzle-orm'
import type { AccessEntry, Crumb, LinkInfo, ResourceAccess } from '#shared/types/api'
import { generateToken, hashToken, openToken, sealToken } from '../lib/crypto'
import type { AccessRule, Invitation, Resource } from '../database/schema'

const ACCOUNT_INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const secret = () => useRuntimeConfig().authSecret

export function newSecretToken() {
  const token = generateToken()
  return { token, tokenHash: hashToken(token), tokenSealed: sealToken(token, secret()) }
}

export const shareUrl = (tokenSealed: string) => appUrl(`/s/${openToken(tokenSealed, secret())}`)

export function invitationUrl(invitation: Pick<Invitation, 'mode' | 'tokenSealed'>) {
  const token = openToken(invitation.tokenSealed, secret())
  return appUrl(invitation.mode === 'account' ? `/invite/${token}` : `/s/${token}`)
}

function linkInfo(rule: AccessRule, resource: Resource): LinkInfo {
  const token = openToken(rule.tokenSealed!, secret())
  return {
    ruleId: rule.id,
    url: appUrl(`/s/${token}`),
    publishedUrl: resourceKind(resource) === 'html' ? usercontentUrl(`/p/${token}/`) : null,
    allowDownload: rule.allowDownload,
    expiresAt: rule.expiresAt?.toISOString() ?? null,
    createdAt: rule.createdAt.toISOString(),
  }
}

export async function resourceAccess(resource: Resource): Promise<ResourceAccess> {
  const chain = await loadChain(resource)
  const rows = await loadRuleRows(rulesOn(chain.map(r => r.id)))
  const effective = effectiveRuleRows(chain, rows)
  const crumb = (id: string | null): Crumb | null => {
    if (!id) return null
    const node = chain.find(n => n.id === id)
    return node ? { id: node.id, name: node.name } : null
  }

  const entries: AccessEntry[] = effective
    .filter(row => row.rule.kind !== 'link' && row.status !== 'revoked')
    .map(row => ({
      ruleId: row.rule.id,
      kind: row.rule.kind,
      label: row.person!.label,
      email: row.person!.email,
      status: row.status,
      invitationMode: row.invitationMode,
      allowDownload: row.rule.allowDownload,
      expiresAt: row.rule.expiresAt?.toISOString() ?? null,
      inheritedFrom: crumb(row.inheritedFrom),
      createdAt: row.rule.createdAt.toISOString(),
      inviteUrl: row.invitationTokenSealed && row.invitationMode && row.status !== 'expired'
        ? invitationUrl({ mode: row.invitationMode, tokenSealed: row.invitationTokenSealed })
        : null,
    }))

  const ownLink = effective.find(row => row.rule.kind === 'link' && !row.inheritedFrom)
  const inheritedLink = effective.find(row => row.rule.kind === 'link' && row.inheritedFrom && row.active)
  const parent = chain[1]
  return {
    resourceId: resource.id,
    resourceName: resource.name,
    inheritAccess: resource.inheritAccess,
    parent: parent ? { id: parent.id, name: parent.name } : null,
    entries,
    link: ownLink ? linkInfo(ownLink.rule, resource) : null,
    inheritedLink: inheritedLink ? { ...linkInfo(inheritedLink.rule, resource), inheritedFrom: crumb(inheritedLink.inheritedFrom)! } : null,
  }
}

export async function findOrCreateInvitation(email: string, name: string | null, mode: 'account' | 'link') {
  const { invitations } = tables
  const db = useDB()
  const [existing] = await db.select().from(invitations)
    .where(and(eq(invitations.email, email), eq(invitations.mode, mode), eq(invitations.status, 'pending'))).limit(1)
  if (existing) {
    if (name && !existing.name) await db.update(invitations).set({ name }).where(eq(invitations.id, existing.id))
    return existing
  }
  const { tokenHash, tokenSealed } = newSecretToken()
  const [created] = await db.insert(invitations).values({
    email,
    name,
    mode,
    tokenHash,
    tokenSealed,
    expiresAt: mode === 'account' ? new Date(Date.now() + ACCOUNT_INVITATION_TTL_MS) : null,
  }).returning()
  return created!
}

export async function ownerName() {
  const { user } = tables
  const [owner] = await useDB().select({ name: user.name }).from(user).where(eq(user.role, 'owner')).limit(1)
  return owner?.name ?? tr('labels.theOwner')
}

export async function notifyShare(to: string, resource: Resource, url: string, kind: 'user' | 'account' | 'link') {
  const sender = await ownerName()
  const params = { sender, name: resource.name }
  const lines = [tr(resource.type === 'folder' ? 'emails.share.folder' : 'emails.share.file', params)]
  if (kind === 'account') lines.push(tr('emails.share.createAccount'))
  if (kind === 'link') lines.push(tr('emails.share.personalLink'))
  const { html, text } = emailLayout(tr('emails.share.title', params), lines, { label: tr('emails.share.open'), url })
  return sendEmail(to, tr('emails.share.subject', params), text, html).catch((error) => {
    console.error(JSON.stringify({ level: 'error', job: 'email', error: String(error) }))
    return false
  })
}

export async function requireRule(id: string) {
  if (!isUuid(id)) throw createError({ statusCode: 404, statusMessage: tr('errors.accessNotFound') })
  const [rule] = await useDB().select().from(tables.accessRules).where(eq(tables.accessRules.id, id)).limit(1)
  if (!rule) throw createError({ statusCode: 404, statusMessage: tr('errors.accessNotFound') })
  return rule
}

export async function ruleLabel(rule: AccessRule) {
  if (rule.kind === 'link') return ACTIVITY_LABELS.publicLink
  const [row] = await loadRuleRows(eq(tables.accessRules.id, rule.id))
  return row?.person?.label ?? tr('labels.access')
}
