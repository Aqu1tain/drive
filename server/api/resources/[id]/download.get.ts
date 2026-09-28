export default defineEventHandler(async event => serveDownload(event, await requireViewer(event), getRouterParam(event, 'id')!))
