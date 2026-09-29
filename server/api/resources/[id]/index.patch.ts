import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(300).optional(),
  starred: z.boolean().optional(),
  inheritAccess: z.boolean().optional(),
  allowScripts: z.boolean().optional(),
  versioning: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  return updateResource(event, viewer, getRouterParam(event, 'id')!, body)
})
