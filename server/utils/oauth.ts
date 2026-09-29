import type { H3Event } from 'h3'
import { and, desc, eq } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { createDpopReplayStore, enforceDpopBinding, isDpopBindingError, parseAccessTokenAuthorization, type AccessTokenAuthorization } from 'better-auth/oauth2'
import { hashToken } from '../lib/crypto'
import { mcpResourceOf } from '../lib/auth'

const CLIENT_LABEL_LENGTH = 60

export const mcpResource = () => mcpResourceOf(useRuntimeConfig().public.appUrl)

/** WWW-Authenticate challenge that sends an AI client to the OAuth discovery documents. */
export function mcpChallenge(error?: 'invalid_token') {
  const metadata = `resource_metadata="${appUrl('/.well-known/oauth-protected-resource')}"`
  return error ? `Bearer error="${error}", ${metadata}` : `Bearer ${metadata}`
}

/**
 * The person an MCP request acts for, as the same viewer the app uses, or null when the access token is unknown,
 * expired, revoked, issued for another resource, no longer backed by the person's consent, or its app or account
 * was disabled. Checked on every request.
 */
export async function authenticateMcp(event: H3Event, resource: string): Promise<Viewer | null> {
  const authorization = parseAccessTokenAuthorization(getRequestHeader(event, 'authorization'))
  if (!authorization) return null

  const { oauthAccessToken, oauthClient, oauthConsent, user } = tables
  const [row] = await useDB().select({ token: oauthAccessToken, client: oauthClient, user }).from(oauthAccessToken)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthAccessToken.clientId))
    .innerJoin(user, eq(user.id, oauthAccessToken.userId))
    .innerJoin(oauthConsent, and(eq(oauthConsent.clientId, oauthAccessToken.clientId), eq(oauthConsent.userId, oauthAccessToken.userId)))
    .where(eq(oauthAccessToken.token, hashToken(authorization.token)))
    .limit(1)
  if (!row || row.token.revoked || row.token.expiresAt <= new Date()) return null
  if (!row.token.resources?.includes(resource) || row.client.disabled || row.user.status !== 'active') return null
  if (!(await isSenderBound(event, row.token.confirmation, authorization, resource))) return null

  const person = { id: row.user.id, name: row.user.name, email: row.user.email, role: row.user.role === 'owner' ? 'owner' as const : 'reader' as const }
  return { ...viewerFor(person), via: row.client.name?.trim().slice(0, CLIENT_LABEL_LENGTH) || 'assistant IA' }
}

/** A DPoP-bound token only works with a proof from the key it was issued to; a plain bearer token passes as is. */
async function isSenderBound(event: H3Event, confirmation: unknown, authorization: AccessTokenAuthorization, resource: string) {
  try {
    await enforceDpopBinding({
      payload: confirmation ? { cnf: confirmation } : {},
      authorization,
      proofJwt: getRequestHeader(event, 'dpop'),
      method: event.method,
      url: resource,
      replayStore: createDpopReplayStore((await useAuth().$context).internalAdapter),
    })
    return true
  }
  catch (error) {
    if (isDpopBindingError(error)) return false
    throw error
  }
}

/** AI apps a person approved, most recent first. */
export async function connectedApps(userId: string) {
  const { oauthConsent, oauthClient } = tables
  const rows = await useDB().select({ clientId: oauthClient.clientId, name: oauthClient.name, uri: oauthClient.uri, connectedAt: oauthConsent.createdAt, updatedAt: oauthConsent.updatedAt })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, userId))
    .orderBy(desc(oauthConsent.updatedAt))
  return rows.map(row => ({ ...row, connectedAt: row.connectedAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))
}

/** Withdraws a person's approval and every token issued from it: one app, or all of them. Takes effect on the next request. */
export async function revokeApps(userId: string, clientId?: string) {
  const { oauthAccessToken, oauthRefreshToken, oauthConsent } = tables
  const granted = (table: { userId: AnyPgColumn, clientId: AnyPgColumn }) =>
    and(eq(table.userId, userId), clientId ? eq(table.clientId, clientId) : undefined)
  return useDB().transaction(async (tx) => {
    await tx.delete(oauthAccessToken).where(granted(oauthAccessToken))
    await tx.delete(oauthRefreshToken).where(granted(oauthRefreshToken))
    const consents = await tx.delete(oauthConsent).where(granted(oauthConsent)).returning({ id: oauthConsent.id })
    return consents.length
  })
}
