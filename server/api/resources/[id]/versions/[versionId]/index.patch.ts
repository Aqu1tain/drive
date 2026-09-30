import { z } from 'zod'
import { MAX_LABEL_LENGTH, cleanVersionLabel } from '#shared/utils/versions'

const bodySchema = z.object({ label: z.string().max(MAX_LABEL_LENGTH * 4).nullable() })

/** A named version is kept for good: automatic cleanup never removes it. */
export default defineEventHandler(async (event) => {
  const { version } = await fileVersion(event)
  const { label } = await readValidatedBody(event, bodySchema.parse)
  const updated = await labelVersion(version, label === null ? null : cleanVersionLabel(label) || null)
  return { id: updated.id, label: updated.label }
})
