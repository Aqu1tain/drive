import { Readable } from 'node:stream'
import { and, eq, sql } from 'drizzle-orm'
import JSZip from 'jszip'
import { extensionOf } from '#shared/utils/names'
import { mimeOfExtension } from '../lib/mime'
import { siteFileFor, sitePath, siteRoot } from '../lib/site'
import type { Resource } from '../database/schema'

const MAX_SITE_FILES = 2000
const MAX_SITE_BYTES = 200 * 1024 * 1024

export interface SiteFile {
  path: string
  storageKey: string
  mimeType: string
  size: number
}

export const isSite = (resource: Resource) => !!resource.siteChecksum && resource.siteChecksum === resource.checksum

/**
 * Unpacks a zip that holds a static site into storage, one blob per file. Sizes are counted while inflating,
 * so an archive that lies about them cannot fill the disk or the memory.
 */
export async function extractSite(resource: Resource & { checksum: string }, data: Buffer): Promise<SiteFile[] | null> {
  const zip = await JSZip.loadAsync(data)
  const names = Object.keys(zip.files)
  const root = siteRoot(names)
  if (root === null) return null
  const entries = names.flatMap((name) => {
    const path = sitePath(name, root)
    return path ? [{ path, entry: zip.files[name]! }] : []
  })
  if (entries.length > MAX_SITE_FILES) return null

  const storage = useStorageProvider()
  const prefix = `sites/${resource.id.slice(0, 2)}/${resource.id}-${resource.checksum.slice(0, 12)}`
  const files: SiteFile[] = []
  let budget = MAX_SITE_BYTES
  try {
    for (const [index, { path, entry }] of entries.entries()) {
      const storageKey = `${prefix}/${index}`
      const mimeType = mimeOfExtension(extensionOf(path) ?? '') ?? 'application/octet-stream'
      let size = 0
      async function* counted(source: Readable) {
        for await (const chunk of source) {
          size += chunk.length
          budget -= chunk.length
          if (budget < 0) throw new Error('Site too large')
          yield chunk
        }
      }
      await storage.put(storageKey, Readable.from(counted(new Readable().wrap(entry.nodeStream('nodebuffer')))), mimeType)
      files.push({ path, storageKey, mimeType, size })
    }
  }
  catch (error) {
    await deleteBlobs([...files.map(file => file.storageKey), `${prefix}/${files.length}`])
    throw error
  }
  return files
}

/** Swaps the extracted files of a resource for a new set (possibly empty), then drops the old blobs. */
export async function replaceSiteFiles(resourceId: string, files: SiteFile[]) {
  const { siteFiles } = tables
  const previous = await useDB().transaction(async (tx) => {
    const old = await tx.delete(siteFiles).where(eq(siteFiles.resourceId, resourceId)).returning({ storageKey: siteFiles.storageKey })
    if (files.length) await tx.insert(siteFiles).values(files.map(file => ({ ...file, resourceId })))
    return old
  })
  const kept = new Set(files.map(file => file.storageKey))
  await deleteBlobs(previous.map(row => row.storageKey).filter(key => !kept.has(key)))
}

export async function siteEntry(resourceId: string, path: string) {
  const { siteFiles } = tables
  const [file] = await useDB().select().from(siteFiles)
    .where(and(eq(siteFiles.resourceId, resourceId), eq(siteFiles.path, siteFileFor(path))))
    .limit(1)
  return file ?? null
}

export async function siteHasFolder(resourceId: string, path: string) {
  const { siteFiles } = tables
  const [row] = await useDB().select({ found: sql<number>`1` }).from(siteFiles)
    .where(and(eq(siteFiles.resourceId, resourceId), eq(siteFiles.path, `${path}/index.html`)))
    .limit(1)
  return !!row
}
