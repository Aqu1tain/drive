export default defineEventHandler(async event => serveContent(event, await requireViewer(event), getRouterParam(event, 'id')!))
