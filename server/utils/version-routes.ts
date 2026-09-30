import type { H3Event } from 'h3'

/** Versions are for those who can edit the file: readers and links only ever see the current content. */
export async function versionedFile(event: H3Event, need: Need = 'edit') {
  const viewer = await requireViewer(event)
  const { resource: file } = await requireAccess(viewer, getRouterParam(event, 'id')!, need)
  if (file.type !== 'file') throw createError({ statusCode: 400, statusMessage: tr('errors.itemNotFound') })
  return { viewer, file }
}

export async function fileVersion(event: H3Event, need: Need = 'edit') {
  const { viewer, file } = await versionedFile(event, need)
  return { viewer, file, version: await requireVersion(file, getRouterParam(event, 'versionId')!) }
}
