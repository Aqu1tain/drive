import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { MAX_TAG_LENGTH, TAG_COLORS, cleanTagName } from '#shared/utils/tags'
import type { TagInfo } from '#shared/types/api'

export const tagNameSchema = z.string().transform(cleanTagName).pipe(z.string().min(1, 'Nom d’étiquette vide').max(MAX_TAG_LENGTH, `${MAX_TAG_LENGTH} caractères au plus`))
export const tagColorSchema = z.enum(TAG_COLORS)

export async function listTags(): Promise<TagInfo[]> {
  const { tags, resources } = tables
  return useDB().select({
    id: tags.id,
    name: tags.name,
    color: tags.color,
    count: sql<number>`(select count(*)::int from ${resources} as tagged where tagged.tag_ids @> array["tags"."id"] and tagged.deleted_at is null)`,
  }).from(tags)
}

export async function requireTag(id: string) {
  const { tags } = tables
  const [tag] = isUuid(id) ? await useDB().select().from(tags).where(eq(tags.id, id)).limit(1) : []
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Étiquette introuvable' })
  return tag
}

export function tagNameTaken(error: unknown, name: string): never {
  if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: `L’étiquette « ${name} » existe déjà` })
  throw error
}
