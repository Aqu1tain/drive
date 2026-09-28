import type { Readable } from 'node:stream'

export interface ByteRange {
  start: number
  end: number
}

export interface StorageProvider {
  put(key: string, body: Readable, contentType?: string): Promise<void>
  get(key: string, range?: ByteRange): Promise<Readable>
  size(key: string): Promise<number | null>
  delete(key: string): Promise<void>
}

const SAFE_KEY = /^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+$/

export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`Unsafe storage key: ${key}`)
  }
}
