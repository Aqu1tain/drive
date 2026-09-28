export default defineEventHandler(async event => listFolder(await requireShareViewer(event), getRouterParam(event, 'id')!))
