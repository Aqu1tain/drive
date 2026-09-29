import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import { z } from 'zod'

const querySchema = z.object({
  parentId: z.string().optional(),
  name: z.string().min(1),
  conflict: z.enum(['fail', 'keep', 'replace']).default('fail'),
})

/** Single-request upload for small files. Large files go through upload sessions, in parts. */
export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const declared = Number(getRequestHeader(event, 'content-length'))
  const plan = await planUpload({ ...query, size: declared })

  const hash = createHash('sha256')
  const head: Buffer[] = []
  let headBytes = 0
  let received = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > declared) return callback(createError({ statusCode: 400, statusMessage: tr('errors.sizeMismatch') }))
      hash.update(chunk)
      if (headBytes < SNIFF_BYTES) {
        head.push(chunk)
        headBytes += chunk.length
      }
      callback(null, chunk)
    },
  })
  const source = event.node.req
  source.on('error', error => meter.destroy(error))
  source.on('aborted', () => meter.destroy(new Error('Upload aborted')))
  source.pipe(meter)

  const storage = useStorageProvider()
  const storageKey = newBlobKey()
  try {
    await storage.put(storageKey, meter)
    if (received !== declared) throw createError({ statusCode: 400, statusMessage: tr('errors.uploadIncomplete') })
  }
  catch (error) {
    await storage.delete(storageKey).catch(() => {})
    throw error
  }

  const { item, replaced } = await commitUpload(viewer, plan, { storageKey, size: received, checksum: hash.digest('hex'), head: Buffer.concat(head) })
  setResponseStatus(event, replaced ? 200 : 201)
  return item
})
