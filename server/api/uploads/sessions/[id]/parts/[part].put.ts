import { buffer } from 'node:stream/consumers'

/** One part, buffered (8 MiB at most) so that a dropped connection never corrupts the running checksum. */
export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const session = requireSession(viewer, getRouterParam(event, 'id')!)
  const partNumber = Number(getRouterParam(event, 'part'))
  if (!Number.isInteger(partNumber) || partNumber < 1) throw createError({ statusCode: 400, statusMessage: tr('errors.partNumberInvalid') })
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declared) || declared > PART_SIZE) throw createError({ statusCode: 413, statusMessage: tr('errors.partTooLarge') })

  const body = await buffer(event.node.req)
  if (body.byteLength !== declared) throw createError({ statusCode: 400, statusMessage: tr('errors.partIncomplete') })
  await addPart(session, partNumber, body)
  return { received: session.received, nextPart: session.parts.length + 1 }
})
