import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { text } from 'node:stream/consumers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageProvider } from '../../server/lib/storage/local'

let root: string
let storage: LocalStorageProvider

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'drive-storage-'))
  storage = new LocalStorageProvider(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const bytes = (value: string) => new TextEncoder().encode(value)

describe('LocalStorageProvider', () => {
  it('stores, reads ranges and deletes', async () => {
    await storage.put('blobs/ab/file', Readable.from([bytes('hello world')]))
    expect(await storage.size('blobs/ab/file')).toBe(11)
    expect(await text(await storage.get('blobs/ab/file', { start: 6, end: 10 }))).toBe('world')
    await storage.delete('blobs/ab/file')
    expect(await storage.size('blobs/ab/file')).toBeNull()
  })

  it('refuses keys that could escape its root', async () => {
    for (const key of ['../etc/passwd', 'blobs/../../x', '/absolute', 'UPPER', 'a//b']) {
      await expect(storage.put(key, Readable.from([bytes('x')]))).rejects.toThrow('Unsafe storage key')
    }
  })

  it('assembles multipart uploads in part order', async () => {
    const uploadId = await storage.createMultipart()
    const parts = [
      await storage.uploadPart('blobs/cd/big', uploadId, 2, bytes('world')),
      await storage.uploadPart('blobs/cd/big', uploadId, 1, bytes('hello ')),
    ]
    await storage.completeMultipart('blobs/cd/big', uploadId, parts)
    expect(await text(await storage.get('blobs/cd/big'))).toBe('hello world')
  })

  it('discards the parts of an aborted upload', async () => {
    const uploadId = await storage.createMultipart()
    await storage.uploadPart('blobs/ef/big', uploadId, 1, bytes('partial'))
    await storage.abortMultipart('blobs/ef/big', uploadId)
    await expect(storage.completeMultipart('blobs/ef/big', uploadId, [{ partNumber: 1, etag: '1' }])).rejects.toThrow()
    expect(await storage.size('blobs/ef/big')).toBeNull()
  })

  it('rejects forged upload ids', async () => {
    await expect(storage.uploadPart('blobs/gh/x', '../../etc', 1, bytes('x'))).rejects.toThrow('Invalid upload id')
  })
})
