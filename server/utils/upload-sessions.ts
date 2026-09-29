import { createHash, randomUUID, type Hash } from 'node:crypto'
import type { UploadedPart } from '../lib/storage/types'

export const PART_SIZE = 8 * 1024 * 1024
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export interface UploadSession {
  id: string
  plan: UploadPlan
  storageKey: string
  uploadId: string
  parts: UploadedPart[]
  received: number
  hash: Hash
  head: Uint8Array
  touchedAt: number
}

/**
 * Sessions live in memory: parts must arrive in order so the hash can be computed as they come.
 * A restart loses them (the client simply starts over) and the sweep aborts what was left behind.
 */
const sessions = new Map<string, UploadSession>()

export async function openSession(plan: UploadPlan) {
  const storageKey = newBlobKey()
  const uploadId = await useStorageProvider().createMultipart(storageKey)
  const session: UploadSession = {
    id: randomUUID(),
    plan,
    storageKey,
    uploadId,
    parts: [],
    received: 0,
    hash: createHash('sha256'),
    head: new Uint8Array(),
    touchedAt: Date.now(),
  }
  sessions.set(session.id, session)
  return session
}

export function requireSession(id: string) {
  const session = sessions.get(id)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'Import expiré, recommencez', data: { reason: 'session_gone' } })
  session.touchedAt = Date.now()
  return session
}

export async function addPart(session: UploadSession, partNumber: number, body: Uint8Array) {
  const expected = session.parts.length + 1
  if (partNumber !== expected) throw createError({ statusCode: 409, statusMessage: 'Partie inattendue', data: { reason: 'part_order', expected } })
  const remaining = session.plan.size - session.received
  const isLast = body.byteLength === remaining
  if (body.byteLength === 0 || body.byteLength > remaining || (!isLast && body.byteLength !== PART_SIZE)) {
    throw createError({ statusCode: 400, statusMessage: 'Taille de partie incohérente' })
  }
  const part = await useStorageProvider().uploadPart(session.storageKey, session.uploadId, partNumber, body)
  session.parts.push(part)
  session.received += body.byteLength
  session.hash.update(body)
  if (session.head.byteLength < SNIFF_BYTES) session.head = Buffer.concat([session.head, body.subarray(0, SNIFF_BYTES)]).subarray(0, SNIFF_BYTES)
}

export async function finishSession(viewer: Viewer, session: UploadSession) {
  if (session.received !== session.plan.size) throw createError({ statusCode: 400, statusMessage: 'Import incomplet' })
  sessions.delete(session.id)
  const storage = useStorageProvider()
  try {
    await storage.completeMultipart(session.storageKey, session.uploadId, session.parts)
  }
  catch (error) {
    await storage.abortMultipart(session.storageKey, session.uploadId)
    throw error
  }
  return commitUpload(viewer, session.plan, {
    storageKey: session.storageKey,
    size: session.received,
    checksum: session.hash.digest('hex'),
    head: session.head,
  })
}

export async function dropSession(session: UploadSession) {
  sessions.delete(session.id)
  await useStorageProvider().abortMultipart(session.storageKey, session.uploadId)
}

export async function sweepSessions(now = Date.now()) {
  for (const session of sessions.values()) {
    if (now - session.touchedAt > SESSION_TTL_MS) await dropSession(session)
  }
}
