import type { H3Event } from 'h3'
import type { Readable } from 'node:stream'
import { and, isNull, sql } from 'drizzle-orm'
import { ZipFile } from 'yazl'
import { kindOf } from '#shared/utils/search'
import { resolveChildAccess, type Access } from '../domain/access'
import type { AccessRule, Resource } from '../database/schema'

const MAX_ENTRIES = 10_000
const ALREADY_COMPRESSED = new Set(['image', 'video', 'audio', 'archive', 'pdf'])

interface Entry {
  path: string
  resource: Resource | null
}

async function subtree(viewer: Viewer, root: Resource, rootAccess: Access, prefix: string): Promise<Entry[]> {
  const { resources, accessRules } = tables
  const db = useDB()
  const descendants = await db.select().from(resources)
    .where(and(sql`${resources.ancestorIds} @> array[${root.id}::uuid]`, isNull(resources.deletedAt)))
  const rules = viewer.ctx.isOwner
    ? []
    : await db.select().from(accessRules).where(sql`${accessRules.resourceId} in (select id from ${resources} where ancestor_ids @> array[${root.id}::uuid])`)
  const rulesByResource = Map.groupBy(rules, (rule: AccessRule) => rule.resourceId)

  const accessById = new Map<string, Access>([[root.id, rootAccess]])
  const pathById = new Map<string, string>([[root.id, prefix]])
  const entries: Entry[] = []
  const folders: string[] = [prefix]

  for (const node of descendants.toSorted((a, b) => a.ancestorIds.length - b.ancestorIds.length)) {
    const parentAccess = node.parentId ? accessById.get(node.parentId) : undefined
    if (!parentAccess) continue
    const access = resolveChildAccess(viewer.ctx, parentAccess, toAccessNode(node), rulesByResource.get(node.id) ?? [])
    if (!access.read) continue
    const path = `${pathById.get(node.parentId!)}/${node.name}`
    if (node.type === 'folder') {
      accessById.set(node.id, access)
      pathById.set(node.id, path)
      folders.push(path)
    }
    else if (access.download && node.storageKey) {
      entries.push({ path, resource: node })
    }
  }

  const filled = new Set<string>()
  const markParents = (path: string) => {
    for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
      const parent = path.slice(0, cut)
      if (filled.has(parent)) return
      filled.add(parent)
    }
  }
  for (const entry of entries) markParents(entry.path)
  for (const folder of folders) markParents(folder)
  return [...entries, ...folders.filter(folder => !filled.has(folder)).map(path => ({ path, resource: null }))]
}

/** What goes in the archive: the requested items the viewer may download, folders walked with the same resolver as listings. */
export async function archiveEntries(viewer: Viewer, ids: string[]) {
  const entries: Entry[] = []
  const roots: Resource[] = []
  for (const id of ids) {
    const { resource, access } = await requireReadable(viewer, id)
    roots.push(resource)
    if (resource.type === 'folder') entries.push(...await subtree(viewer, resource, access, resource.name))
    else if (access.download && resource.storageKey) entries.push({ path: resource.name, resource })
    if (entries.length > MAX_ENTRIES) throw createError({ statusCode: 413, statusMessage: tr('errors.tooManyFiles', { max: MAX_ENTRIES }) })
  }
  if (!entries.some(entry => entry.resource)) throw createError({ statusCode: 403, statusMessage: tr('errors.nothingDownloadable') })
  return { entries, roots }
}

/** Streams a ZIP without buffering: each file is opened only when the archive reaches it. */
export function sendArchive(event: H3Event, filename: string, entries: Entry[]) {
  const zip = new ZipFile()
  const storage = useStorageProvider()
  for (const entry of entries) {
    if (!entry.resource) {
      zip.addEmptyDirectory(entry.path)
      continue
    }
    const { storageKey, updatedAt, size, type, mimeType } = entry.resource
    zip.addReadStreamLazy(entry.path, { mtime: updatedAt, size, compress: !ALREADY_COMPRESSED.has(kindOf(type, mimeType)) }, (callback) => {
      storage.get(storageKey!).then(stream => callback(null, stream), error => callback(error as Error, undefined as unknown as Readable))
    })
  }
  zip.end()
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': contentDisposition('attachment', filename),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })
  return streamBody(event, zip.outputStream as unknown as Readable)
}

export async function serveArchive(event: H3Event, viewer: Viewer, ids: string[]) {
  const { entries, roots } = await archiveEntries(viewer, ids)
  for (const root of roots) await logAccess(event, viewer, root, 'download')
  const name = roots.length === 1 ? `${roots[0]!.name}.zip` : `${useRuntimeConfig().public.appName} ${new Date().toISOString().slice(0, 10)}.zip`
  return sendArchive(event, name, entries)
}

export function parseIds(value: unknown) {
  const ids = String(value ?? '').split(',').filter(Boolean)
  if (ids.length === 0 || ids.length > 500 || !ids.every(isUuid)) throw createError({ statusCode: 400, statusMessage: tr('errors.invalidSelection') })
  return [...new Set(ids)]
}

