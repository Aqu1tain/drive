export default defineEventHandler(async event => serveArchive(event, await requireShareViewer(event), parseIds(getQuery(event).ids)))
