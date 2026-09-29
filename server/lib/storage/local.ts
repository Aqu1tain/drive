import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'
import { assertSafeKey, type ByteRange, type StorageProvider, type UploadedPart } from './types'

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

  private partsDir(uploadId: string) {
    if (!/^[\w-]+$/.test(uploadId)) throw new Error('Invalid upload id')
    return resolve(this.root, 'tmp', 'multipart', uploadId)
  }

  async createMultipart() {
    const uploadId = randomUUID()
    await mkdir(this.partsDir(uploadId), { recursive: true })
    return uploadId
  }

  async uploadPart(_key: string, uploadId: string, partNumber: number, body: Uint8Array): Promise<UploadedPart> {
    await writeFile(resolve(this.partsDir(uploadId), String(partNumber)), body)
    return { partNumber, etag: String(partNumber) }
  }

  async completeMultipart(key: string, uploadId: string, parts: UploadedPart[]) {
    const target = this.pathOf(key)
    const temp = resolve(this.root, 'tmp', randomUUID())
    await mkdir(dirname(target), { recursive: true })
    const out = createWriteStream(temp, { flags: 'wx' })
    try {
      for (const part of parts.toSorted((a, b) => a.partNumber - b.partNumber)) {
        await pipeline(createReadStream(resolve(this.partsDir(uploadId), String(part.partNumber))), out, { end: false })
      }
      await new Promise<void>((done, fail) => out.end((error?: Error | null) => error ? fail(error) : done()))
      await rename(temp, target)
    }
    catch (error) {
      out.destroy()
      await rm(temp, { force: true })
      throw error
    }
    await rm(this.partsDir(uploadId), { recursive: true, force: true })
  }

  async abortMultipart(_key: string, uploadId: string) {
    await rm(this.partsDir(uploadId), { recursive: true, force: true })
  }
}
