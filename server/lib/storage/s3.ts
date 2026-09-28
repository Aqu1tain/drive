import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { Readable } from 'node:stream'
import { assertSafeKey, type ByteRange, type StorageProvider } from './types'

export interface S3Options {
  endpoint?: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client
  private readonly bucket: string
  private ready?: Promise<void>

  constructor(options: S3Options) {
    this.bucket = options.bucket
    this.client = new S3Client({
      endpoint: options.endpoint || undefined,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  private ensureBucket() {
    this.ready ??= this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      .then(() => undefined)
      .catch(() => this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).then(() => undefined))
    return this.ready
  }

  async put(key: string, body: Readable, contentType?: string) {
    assertSafeKey(key)
    await this.ensureBucket()
    await new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType ?? 'application/octet-stream' },
    }).done()
  }

  async get(key: string, range?: ByteRange) {
    assertSafeKey(key)
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    }))
    return result.Body as Readable
  }

  async size(key: string) {
    assertSafeKey(key)
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => null)
    return head?.ContentLength ?? null
  }

  async delete(key: string) {
    assertSafeKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
