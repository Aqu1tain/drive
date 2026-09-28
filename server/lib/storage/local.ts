import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'
import { assertSafeKey, type ByteRange, type StorageProvider } from './types'

export class LocalStorageProvider implements StorageProvider {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  private pathOf(key: string) {
    assertSafeKey(key)
    return resolve(this.root, key)
  }

  async put(key: string, body: Readable) {
    const target = this.pathOf(key)
    const temp = resolve(this.root, 'tmp', randomUUID())
    await mkdir(dirname(target), { recursive: true })
    await mkdir(dirname(temp), { recursive: true })
    try {
      await pipeline(body, createWriteStream(temp, { flags: 'wx' }))
      await rename(temp, target)
    }
    catch (error) {
      await rm(temp, { force: true })
      throw error
    }
  }

  async get(key: string, range?: ByteRange) {
    return createReadStream(this.pathOf(key), range)
  }

  async size(key: string) {
    const info = await stat(this.pathOf(key)).catch(() => null)
    return info?.size ?? null
  }

  async delete(key: string) {
    await rm(this.pathOf(key), { force: true })
  }
}
