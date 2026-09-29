import { and, eq } from 'drizzle-orm'
import { hashToken } from '../../../lib/crypto'
import { isExpired } from '../../../domain/access'

/** The published address of an HTML page shared by public link: lives as long as the link does. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const { accessRules } = tables
  const [rule] = /^[\w-]{16,64}$/.test(token)
    ? await useDB().select().from(accessRules).where(and(eq(accessRules.tokenHash, hashToken(token)), eq(accessRules.kind, 'link'))).limit(1)
    : []
  if (!rule || isExpired(rule.expiresAt, new Date())) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const viewer: Viewer = { kind: 'share', apiBase: '', ctx: { isOwner: false, linkRuleId: rule.id }, linkRule: rule }
  const served = await serveHtmlPage(event, viewer.ctx, rule.resourceId)
  if ('redirect' in served) return sendRedirect(event, served.redirect)
  if (served.document) await logAccess(event, viewer, served.resource, 'view')
  return streamBody(event, await served.stream())
})
