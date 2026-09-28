export default defineEventHandler(async event => serveThumbnail(event, await requireViewer(event), getRouterParam(event, 'id')!))
