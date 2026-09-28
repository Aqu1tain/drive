import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { keepBothName } from '#shared/utils/names'

const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) })

/** Restores in place; when the original folder is itself in the trash, the item comes back at the root. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const { ids } = await readValidatedBody(event, bodySchema.parse)
  const { resources } = tables
  const db = useDB()
  const items = (await db.select().from(resources).where(inArray(resources.id, ids))).filter(item => item.deletedAt)

  const restored = []
  for (const item of items) {
    const chain = await loadChain(item)
    const movedToRoot = chain.slice(1).some(node => node.deletedAt)
    const parentId = movedToRoot ? null : item.parentId
    const name = keepBothName(item.name, await siblingNames(parentId))
    const renamed = name !== item.name
    await db.transaction(async (tx) => {
      const patch = { deletedAt: null, ...(renamed ? nameFields(name) : {}) }
      if (movedToRoot) await reparent(tx, item, null, patch)
      else await tx.update(resources).set(patch).where(eq(resources.id, item.id))
    })
    restored.push({ id: item.id, name, parentId, renamed, movedToRoot })
  }
  return { restored }
})
