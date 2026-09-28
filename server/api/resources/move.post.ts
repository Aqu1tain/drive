import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { keepBothName } from '#shared/utils/names'

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  targetId: z.string().uuid().nullable(),
  conflict: z.enum(['fail', 'keep']).default('fail'),
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const target = await requireFolder(body.targetId)
  const targetId = target?.id ?? null
  const { resources } = tables

  const items = (await useDB().select().from(resources).where(inArray(resources.id, body.ids)))
    .filter(item => item.parentId !== targetId)
  if (items.some(item => target && (item.id === target.id || target.ancestorIds.includes(item.id)))) {
    throw createError({ statusCode: 400, statusMessage: 'Impossible de déplacer un dossier dans lui-même' })
  }

  const taken = await siblingNames(targetId)
  const takenLower = new Set(taken.map(n => n.toLowerCase()))
  const conflicts = items.filter(item => takenLower.has(item.nameLower)).map(item => item.name)
  if (conflicts.length > 0 && body.conflict === 'fail') {
    throw createError({ statusCode: 409, statusMessage: 'Certains noms existent déjà à destination', data: { reason: 'name_taken', conflicts } })
  }

  await useDB().transaction(async (tx) => {
    for (const item of items) {
      const name = keepBothName(item.name, taken)
      taken.push(name)
      await reparent(tx, item, target, name === item.name ? {} : nameFields(name))
    }
  })
  return { moved: items.map(item => item.id), target: target ? { id: target.id, name: target.name } : { id: null, name: 'Mon Drive' } }
})
