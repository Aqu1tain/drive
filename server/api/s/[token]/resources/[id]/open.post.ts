export default defineEventHandler(async event => openResource(event, await requireShareViewer(event), getRouterParam(event, 'id')!))
