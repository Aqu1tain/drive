import { randomUUID } from 'node:crypto'
import { LocalStorageProvider } from '../lib/storage/local'
import { S3StorageProvider } from '../lib/storage/s3'
import type { StorageProvider } from '../lib/storage/types'

let provider: StorageProvider | undefined

export function useStorageProvider() {
  if (provider) return provider
  const { storage } = useRuntimeConfig()
  provider = storage.driver === 's3'
    ? new S3StorageProvider({ ...storage.s3, forcePathStyle: String(storage.s3.forcePathStyle) === 'true' })
    : new LocalStorageProvider(storage.localDir)
  return provider
}

export function newBlobKey() {
  const id = randomUUID()
  return `blobs/${id.slice(0, 2)}/${id}`
}

export const thumbnailKeyOf = (resourceId: string, checksum: string) => `thumbs/${resourceId.slice(0, 2)}/${resourceId}-${checksum.slice(0, 12)}.webp`
