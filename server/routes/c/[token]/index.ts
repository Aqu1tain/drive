/** In-app previews of HTML and converted documents: the frame token is short-lived and access is re-resolved on every request. */
export default defineEventHandler(async (event) => {
  const claims = await contextFromFrameToken(getRouterParam(event, 'token') ?? '')
  if (!claims) throw createError({ statusCode: 403, statusMessage: 'Expired preview' })
  const { stream } = await serveHtmlPage(event, claims.ctx, claims.resourceId, { previews: true })
  return streamBody(event, await stream())
})
