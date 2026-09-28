export default defineEventHandler(async event => serveThumbnail(event, await requireShareViewer(event), getRouterParam(event, 'id')!))
