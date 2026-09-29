import { z } from 'zod'

const bodySchema = z.object({ starred: z.boolean() })

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const { starred } = await readValidatedBody(event, bodySchema.parse)
  const { resource } = await requireReadable(viewer, getRouterParam(event, 'id')!)
  await setStarred(viewer, resource.id, starred)
  return { starred }
})
