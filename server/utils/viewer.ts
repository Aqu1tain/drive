import type { H3Event } from 'h3'
import type { Role, SessionUser } from '#shared/types/api'
import { ANONYMOUS, type AccessContext } from '../domain/access'
import type { AccessRule, Invitation } from '../database/schema'

export interface Viewer {
  kind: 'owner' | 'member' | 'reader' | 'share'
  ctx: AccessContext
  apiBase: string
  user?: SessionUser
  invitation?: Invitation
  linkRule?: AccessRule
  shareToken?: string
  visitorId?: string
  /** The AI app acting for this person, named in the activity journal. */
  via?: string
}

declare module 'h3' {
  interface H3EventContext {
    auth?: { user: SessionUser | null }
  }
}

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  if (event.context.auth) return event.context.auth.user

  const session = await useAuth().api.getSession({ headers: event.headers })
  const raw = session?.user as { id: string, name: string, email: string, role?: string, status?: string, twoFactorEnabled?: boolean | null } | undefined
  const user = raw && raw.status === 'active'
    ? { id: raw.id, name: raw.name, email: raw.email, role: userRole(raw.role), twoFactorEnabled: !!raw.twoFactorEnabled }
    : null
  event.context.auth = { user }
  return user
}

/** Anything unknown reads as the least privileged role. */
export const userRole = (role: string | undefined): Role => role === 'owner' || role === 'member' ? role : 'reader'

export function viewerFor(user: SessionUser): Viewer {
  return { kind: user.role, user, apiBase: '/api', ctx: { isOwner: user.role === 'owner', isMember: user.role !== 'reader', userId: user.id } }
}

export async function getSessionViewer(event: H3Event): Promise<Viewer | null> {
  const user = await getSessionUser(event)
  return user ? viewerFor(user) : null
}

export async function requireViewer(event: H3Event) {
  const viewer = await getSessionViewer(event)
  if (!viewer) throw createError({ statusCode: 401, statusMessage: tr('errors.signInRequired') })
  return viewer
}

/** Owners and members: the people who work in the drive, as opposed to readers. */
export async function requireMember(event: H3Event) {
  const viewer = await requireViewer(event)
  if (!viewer.ctx.isMember) throw createError({ statusCode: 403, statusMessage: tr('errors.membersOnly') })
  return viewer
}

export async function requireOwner(event: H3Event) {
  const viewer = await requireViewer(event)
  if (viewer.kind !== 'owner') throw createError({ statusCode: 403, statusMessage: tr('errors.ownerOnly') })
  return viewer
}

export const anonymousViewer = (): Viewer => ({ kind: 'share', ctx: ANONYMOUS, apiBase: '/api' })
