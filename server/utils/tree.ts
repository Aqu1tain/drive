import { and, eq, isNull, sql } from 'drizzle-orm'
import { extensionOf, sanitizeName, searchKeyOf, InvalidNameError } from '#shared/utils/names'
import type { Resource } from '../database/schema'

const { resources } = tables

export function nameFields(raw: string) {
  try {
    const name = sanitizeName(raw)
    return { name, nameLower: name.toLowerCase(), searchKey: searchKeyOf(name), extension: extensionOf(name) }
  }
  catch (error) {
    if (error instanceof InvalidNameError) throw createError({ statusCode: 400, statusMessage: error.message })
    throw error
  }
}

export const childAncestors = (parent: Resource | null) => parent ? [...parent.ancestorIds, parent.id] : []

/** Returns the target folder (null for the root), refusing anything that is not a live folder. */
export async function requireFolder(parentId: string | null | undefined) {
  if (!parentId || parentId === 'root') return null
  const folder = await findResource(parentId)
  if (!folder || folder.type !== 'folder') throw createError({ statusCode: 404, statusMessage: 'Dossier introuvable' })
  const chain = await loadChain(folder)
  if (chain.some(node => node.deletedAt)) throw createError({ statusCode: 409, statusMessage: 'Ce dossier est dans la corbeille' })
  return folder
}

export async function findSibling(parentId: string | null, nameLower: string) {
  const [row] = await useDB().select().from(resources).where(and(
    parentId ? eq(resources.parentId, parentId) : isNull(resources.parentId),
    eq(resources.nameLower, nameLower),
    isNull(resources.deletedAt),
  )).limit(1)
  return row ?? null
}

export async function siblingNames(parentId: string | null) {
  const rows = await useDB().select({ name: resources.name }).from(resources).where(and(
    parentId ? eq(resources.parentId, parentId) : isNull(resources.parentId),
    isNull(resources.deletedAt),
  ))
  return rows.map(r => r.name)
}

export async function usedBytes() {
  const [row] = await useDB().select({ total: sql<string>`coalesce(sum(${resources.size}), 0)` }).from(resources).where(eq(resources.type, 'file'))
  return Number(row?.total ?? 0)
}

export function isUniqueViolation(error: unknown) {
  const code = (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code
  return code === '23505'
}

export function nameTaken(name: string): never {
  throw createError({ statusCode: 409, statusMessage: `« ${name} » existe déjà à cet emplacement`, data: { reason: 'name_taken' } })
}
