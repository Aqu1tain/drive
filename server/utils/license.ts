import { and, eq, inArray, sql } from 'drizzle-orm'
import type { OrganizationStatus } from '#shared/types/api'
import { licenseActive, readLicense, type License } from '../lib/license'

let cached: { key: string, license: License | null } | undefined

export function currentLicense() {
  const key = useRuntimeConfig().licenseKey
  if (cached?.key !== key) cached = { key, license: key ? readLicense(key) : null }
  return cached.license
}

/** Owners and members take a seat; readers are free. Without a license, the drive has one seat: its owner. */
export async function seatsUsed() {
  const { user } = tables
  const [row] = await useDB().select({ count: sql<number>`count(*)::int` }).from(user)
    .where(and(inArray(user.role, ['owner', 'member']), eq(user.status, 'active')))
  return row?.count ?? 0
}

export async function organizationStatus(): Promise<OrganizationStatus> {
  const license = currentLicense()
  const active = licenseActive(license)
  return {
    active,
    name: license?.organization ?? null,
    seats: active ? license!.seats : 1,
    used: await seatsUsed(),
    expiresAt: license?.expiresAt.toISOString() ?? null,
    invalidKey: !!useRuntimeConfig().licenseKey && !license,
  }
}

/** Adding someone who manages files needs a license with a seat left; everyone already there keeps their access regardless. */
export async function requireSeat() {
  const status = await organizationStatus()
  if (!status.active) throw createError({ statusCode: 403, statusMessage: tr('errors.organizationsNeedLicense'), data: { reason: 'license' } })
  if (status.used >= status.seats) throw createError({ statusCode: 403, statusMessage: tr('errors.noSeatLeft', { seats: status.seats }), data: { reason: 'seats' } })
}

/** Letting someone edit or manage is an organization feature. */
export function requireOrganization() {
  if (!licenseActive(currentLicense())) throw createError({ statusCode: 403, statusMessage: tr('errors.organizationsNeedLicense'), data: { reason: 'license' } })
}
