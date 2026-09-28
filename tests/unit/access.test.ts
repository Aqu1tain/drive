import { describe, expect, it } from 'vitest'
import {
  ANONYMOUS,
  effectiveRules,
  resolveAccess,
  resolveChildAccess,
  type AccessContext,
  type AccessNode,
  type AccessRuleLike,
  type InvitationLike,
} from '../../server/domain/access'

const now = new Date('2026-09-28T12:00:00Z')
const past = new Date('2026-09-01T00:00:00Z')
const future = new Date('2026-12-01T00:00:00Z')

const node = (id: string, patch: Partial<AccessNode> = {}): AccessNode => ({ id, inheritAccess: true, deletedAt: null, ...patch })

let ruleSeq = 0
const rule = (resourceId: string, patch: Partial<AccessRuleLike>): AccessRuleLike => ({
  id: `rule-${++ruleSeq}`,
  resourceId,
  kind: 'user',
  userId: null,
  invitationId: null,
  allowDownload: true,
  expiresAt: null,
  ...patch,
})

const owner: AccessContext = { isOwner: true, userId: 'owner' }
const paul: AccessContext = { isOwner: false, userId: 'paul' }
const marie: AccessContext = { isOwner: false, userId: 'marie' }

// Clients / Dupont / devis.pdf
const root = node('clients')
const folder = node('dupont')
const file = node('devis')
const chain = [file, folder, root]

describe('owner', () => {
  it('can do everything, even without rules', () => {
    expect(resolveAccess(owner, chain, [], now)).toMatchObject({ read: true, download: true, manage: true })
  })

  it('can still read trashed resources', () => {
    expect(resolveAccess(owner, [node('devis', { deletedAt: past }), folder], [], now).read).toBe(true)
  })
})

describe('reader', () => {
  it('has no access without a rule', () => {
    expect(resolveAccess(paul, chain, [], now).read).toBe(false)
  })

  it('reads a resource shared directly', () => {
    const access = resolveAccess(paul, chain, [rule('devis', { userId: 'paul' })], now)
    expect(access).toMatchObject({ read: true, download: true, manage: false })
  })

  it('never gets manage rights', () => {
    expect(resolveAccess(paul, chain, [rule('devis', { userId: 'paul' })], now).manage).toBe(false)
  })

  it('inherits access from an ancestor folder', () => {
    expect(resolveAccess(paul, chain, [rule('clients', { userId: 'paul' })], now).read).toBe(true)
  })

  it('does not get access from another user rule', () => {
    expect(resolveAccess(marie, chain, [rule('dupont', { userId: 'paul' })], now).read).toBe(false)
  })

  it('loses inherited access when inheritance is broken', () => {
    const isolated = [node('devis', { inheritAccess: false }), folder, root]
    expect(resolveAccess(paul, isolated, [rule('dupont', { userId: 'paul' })], now).read).toBe(false)
  })

  it('keeps own rules when inheritance is broken', () => {
    const isolated = [node('devis', { inheritAccess: false }), folder, root]
    expect(resolveAccess(paul, isolated, [rule('devis', { userId: 'paul' })], now).read).toBe(true)
  })

  it('stops inheritance at the node that breaks it, not above', () => {
    const brokenAtFolder = [file, node('dupont', { inheritAccess: false }), root]
    expect(resolveAccess(paul, brokenAtFolder, [rule('clients', { userId: 'paul' })], now).read).toBe(false)
    expect(resolveAccess(paul, brokenAtFolder, [rule('dupont', { userId: 'paul' })], now).read).toBe(true)
  })

  it('cannot download when the rule forbids it', () => {
    const access = resolveAccess(paul, chain, [rule('dupont', { userId: 'paul', allowDownload: false })], now)
    expect(access).toMatchObject({ read: true, download: false })
  })

  it('can download when any matching rule allows it', () => {
    const rules = [
      rule('dupont', { userId: 'paul', allowDownload: false }),
      rule('devis', { userId: 'paul', allowDownload: true }),
    ]
    expect(resolveAccess(paul, chain, rules, now).download).toBe(true)
  })

  it('loses access when the resource is trashed', () => {
    const trashed = [node('devis', { deletedAt: past }), folder, root]
    expect(resolveAccess(paul, trashed, [rule('devis', { userId: 'paul' })], now).read).toBe(false)
  })

  it('loses access when an ancestor is trashed', () => {
    const trashed = [file, node('dupont', { deletedAt: past }), root]
    expect(resolveAccess(paul, trashed, [rule('devis', { userId: 'paul' })], now).read).toBe(false)
  })
})

describe('expiration', () => {
  it('ignores expired rules', () => {
    expect(resolveAccess(paul, chain, [rule('devis', { userId: 'paul', expiresAt: past })], now).read).toBe(false)
  })

  it('treats the exact expiry instant as expired', () => {
    expect(resolveAccess(paul, chain, [rule('devis', { userId: 'paul', expiresAt: now })], now).read).toBe(false)
  })

  it('honours rules that expire later', () => {
    expect(resolveAccess(paul, chain, [rule('devis', { userId: 'paul', expiresAt: future })], now).read).toBe(true)
  })

  it('falls back to a still valid inherited rule', () => {
    const rules = [
      rule('devis', { userId: 'paul', expiresAt: past }),
      rule('clients', { userId: 'paul' }),
    ]
    expect(resolveAccess(paul, chain, rules, now).read).toBe(true)
  })
})

describe('public links', () => {
  const link = rule('dupont', { kind: 'link' })
  const visitor: AccessContext = { isOwner: false, linkRuleId: link.id }

  it('grants anonymous access to the linked resource and its descendants', () => {
    expect(resolveAccess(visitor, [folder, root], [link], now).read).toBe(true)
    expect(resolveAccess(visitor, chain, [link], now).read).toBe(true)
  })

  it('does not reach resources outside of its scope', () => {
    expect(resolveAccess(visitor, [root], [link], now).read).toBe(false)
    expect(resolveAccess(visitor, [node('other'), root], [link], now).read).toBe(false)
  })

  it('does not reach a descendant that breaks inheritance', () => {
    expect(resolveAccess(visitor, [node('devis', { inheritAccess: false }), folder, root], [link], now).read).toBe(false)
  })

  it('is refused once expired', () => {
    const expired = rule('dupont', { kind: 'link', expiresAt: past })
    expect(resolveAccess({ isOwner: false, linkRuleId: expired.id }, chain, [expired], now).read).toBe(false)
  })

  it('is refused once removed (revocation)', () => {
    expect(resolveAccess(visitor, chain, [], now).read).toBe(false)
  })

  it('is not usable with a forged rule id', () => {
    expect(resolveAccess({ isOwner: false, linkRuleId: 'forged' }, chain, [link], now).read).toBe(false)
  })

  it('does not grant anything to anonymous visitors without the link', () => {
    expect(resolveAccess(ANONYMOUS, chain, [link], now).read).toBe(false)
  })

  it('respects the download flag', () => {
    const viewOnly = rule('dupont', { kind: 'link', allowDownload: false })
    expect(resolveAccess({ isOwner: false, linkRuleId: viewOnly.id }, chain, [viewOnly], now)).toMatchObject({ read: true, download: false })
  })
})

describe('personal invitation links', () => {
  const invitation: InvitationLike = { id: 'inv-1', mode: 'link', status: 'pending', expiresAt: null }
  const grant = rule('dupont', { kind: 'invitation', invitationId: 'inv-1' })

  it('grants access through an active invitation', () => {
    expect(resolveAccess({ isOwner: false, invitation }, chain, [grant], now).read).toBe(true)
  })

  it('is refused once the invitation is revoked', () => {
    const revoked = { ...invitation, status: 'revoked' as const }
    expect(resolveAccess({ isOwner: false, invitation: revoked }, chain, [grant], now).read).toBe(false)
  })

  it('is refused once the invitation expired', () => {
    const expired = { ...invitation, expiresAt: past }
    expect(resolveAccess({ isOwner: false, invitation: expired }, chain, [grant], now).read).toBe(false)
  })

  it('never grants browsing access to an account invitation that is not accepted', () => {
    const accountInvite = { ...invitation, mode: 'account' as const }
    expect(resolveAccess({ isOwner: false, invitation: accountInvite }, chain, [grant], now).read).toBe(false)
  })

  it('does not match another invitation', () => {
    const other = { ...invitation, id: 'inv-2' }
    expect(resolveAccess({ isOwner: false, invitation: other }, chain, [grant], now).read).toBe(false)
  })
})

describe('effectiveRules', () => {
  it('reports where inherited rules come from', () => {
    const own = rule('devis', { userId: 'paul' })
    const inherited = rule('dupont', { userId: 'marie' })
    expect(effectiveRules(chain, [own, inherited])).toEqual([
      { rule: own, inheritedFrom: null },
      { rule: inherited, inheritedFrom: 'dupont' },
    ])
  })
})

describe('resolveChildAccess', () => {
  const folderRule = rule('dupont', { userId: 'paul', allowDownload: false })
  const parentAccess = resolveAccess(paul, [folder, root], [folderRule], now)

  it('inherits the parent grants', () => {
    expect(resolveChildAccess(paul, parentAccess, file, [], now)).toMatchObject({ read: true, download: false })
  })

  it('adds the child own grants', () => {
    const own = rule('devis', { userId: 'paul', allowDownload: true })
    expect(resolveChildAccess(paul, parentAccess, file, [own], now)).toMatchObject({ read: true, download: true })
  })

  it('drops parent grants when the child breaks inheritance', () => {
    expect(resolveChildAccess(paul, parentAccess, node('devis', { inheritAccess: false }), [], now).read).toBe(false)
  })

  it('hides trashed children', () => {
    expect(resolveChildAccess(paul, parentAccess, node('devis', { deletedAt: past }), [], now).read).toBe(false)
  })

  it('agrees with resolveAccess on the full chain', () => {
    const rules = [folderRule, rule('devis', { userId: 'paul' })]
    const direct = resolveAccess(paul, chain, rules, now)
    const incremental = resolveChildAccess(paul, resolveAccess(paul, [folder, root], rules, now), file, rules, now)
    expect(incremental.read).toBe(direct.read)
    expect(incremental.download).toBe(direct.download)
  })
})
