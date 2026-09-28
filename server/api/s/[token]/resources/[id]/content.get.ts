export default defineEventHandler(async event => serveContent(event, await requireShareViewer(event), getRouterParam(event, 'id')!))
