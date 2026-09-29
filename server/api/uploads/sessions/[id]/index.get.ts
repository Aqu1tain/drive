export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const session = requireSession(getRouterParam(event, 'id')!)
  return { nextPart: session.parts.length + 1, received: session.received, size: session.plan.size }
})
