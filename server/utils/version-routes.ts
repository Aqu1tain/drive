import type { H3Event } from 'h3'

/** Versions belong to the owner: readers and links only ever see the current content. */
export async function ownedFile(event: H3Event) {
  const viewer = await requireOwner(event)
  const file = await requireOwned(getRouterParam(event, 'id')!)
  if (file.type !== 'file') throw createError({ statusCode: 400, statusMessage: tr('errors.itemNotFound') })
  return { viewer, file }
}

export async function ownedVersion(event: H3Event) {
  const { viewer, file } = await ownedFile(event)
  return { viewer, file, version: await requireVersion(file, getRouterParam(event, 'versionId')!) }
}
