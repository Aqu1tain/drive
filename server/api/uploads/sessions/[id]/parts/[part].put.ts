import { buffer } from 'node:stream/consumers'

/** One part, buffered (8 MiB at most) so that a dropped connection never corrupts the running checksum. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const session = requireSession(getRouterParam(event, 'id')!)
  const partNumber = Number(getRouterParam(event, 'part'))
  if (!Number.isInteger(partNumber) || partNumber < 1) throw createError({ statusCode: 400, statusMessage: 'Numéro de partie invalide' })
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declared) || declared > PART_SIZE) throw createError({ statusCode: 413, statusMessage: 'Partie trop volumineuse' })

  const body = await buffer(event.node.req)
  if (body.byteLength !== declared) throw createError({ statusCode: 400, statusMessage: 'Partie incomplète' })
  await addPart(session, partNumber, body)
  return { received: session.received, nextPart: session.parts.length + 1 }
})
