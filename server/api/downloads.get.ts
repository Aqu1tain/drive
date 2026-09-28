export default defineEventHandler(async event => serveArchive(event, await requireViewer(event), parseIds(getQuery(event).ids)))
