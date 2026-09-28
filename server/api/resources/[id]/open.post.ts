export default defineEventHandler(async event => openResource(event, await requireViewer(event), getRouterParam(event, 'id')!))
