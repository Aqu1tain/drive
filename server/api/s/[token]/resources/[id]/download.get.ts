export default defineEventHandler(async event => serveDownload(event, await requireShareViewer(event), getRouterParam(event, 'id')!))
