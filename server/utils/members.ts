import { keepBothName } from '#shared/utils/names'
import type { user } from '../database/schema'

/** A member starts with a folder of their own at the top of the drive: they manage it, and owners see it like everything else. */
export async function createPersonalFolder(person: { id: string, name: string, email: string }) {
  const { resources, accessRules } = tables
  const name = keepBothName(nameFields(person.name || person.email).name, await siblingNames(null))
  return useDB().transaction(async (tx) => {
    const [folder] = await tx.insert(resources).values({ ...nameFields(name), extension: null, type: 'folder', parentId: null, ancestorIds: [] }).returning()
    await tx.insert(accessRules).values({ resourceId: folder!.id, kind: 'user', userId: person.id, role: 'manager' })
    return folder!
  })
}

/** Only members of the organization, with a license, can be let edit or manage: readers and invitations only ever read. */
export async function requireRoleFor(person: typeof user.$inferSelect | null) {
  requireOrganization()
  if (person?.role !== 'member') throw createError({ statusCode: 400, statusMessage: tr('errors.onlyMembersEdit') })
}
