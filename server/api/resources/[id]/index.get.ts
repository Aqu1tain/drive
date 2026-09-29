export default defineEventHandler(async event => resourceDetails(await requireViewer(event), getRouterParam(event, 'id')!))
