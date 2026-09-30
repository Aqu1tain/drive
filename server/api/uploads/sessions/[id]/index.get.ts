export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const session = requireSession(viewer, getRouterParam(event, 'id')!)
  return { nextPart: session.parts.length + 1, received: session.received, size: session.plan.size }
})
