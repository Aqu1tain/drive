import type { H3Event } from 'h3'
import { buffer } from 'node:stream/consumers'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { isEmptySearch, parseSearchQuery, stringifySearchQuery } from '#shared/utils/search'
import type { AccessSummary, ActivityEvent, Crumb, ResourceItem } from '#shared/types/api'
import { deriveDocument } from '../lib/documents'
import { TEXT_UPLOAD_MAX_BYTES, readPlan, textWindow } from '../lib/mcp'

const LISTED_ITEMS = 200
const DEFAULT_CHARACTERS = 50_000
const MAX_CHARACTERS = 200_000

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE = { readOnlyHint: false, openWorldHint: false }

const uuid = z.string().uuid()

/** One MCP server per request, acting for the person who approved the AI app: every rule of the app applies unchanged. */
export function createMcpServer(event: H3Event, viewer: Viewer) {
  const { appName } = useRuntimeConfig().public
  const server = new McpServer({ name: appName, version: '1.0.0' }, { instructions: instructionsFor(viewer, appName) })
  registerReadTools(server, event, viewer)
  if (viewer.kind === 'owner') registerOwnerTools(server, event, viewer)
  return server
}

function instructionsFor(viewer: Viewer, appName: string) {
  const name = viewer.user!.name || viewer.user!.email
  if (viewer.kind !== 'owner') {
    return `${appName} is a personal drive. You act for ${name}, who can read what the owner shared with them; nothing can be changed from here. Find items with search or list_folder, then read them with read_file.`
  }
  return `${appName} is the personal drive of ${name}, and you act as its owner. Find items with search or list_folder, read them with read_file, and organize them. `
    + 'You cannot share, change sharing settings or delete anything permanently. Moving an item into a shared folder makes it visible to the people that folder is shared with.'
}

function registerReadTools(server: McpServer, event: H3Event, viewer: Viewer) {
  const owner = viewer.kind === 'owner'

  server.registerTool('list_folder', {
    title: 'List a folder',
    description: owner
      ? 'Lists the files and folders directly inside a folder. Without folderId, lists the top of My Drive.'
      : 'Lists the files and folders directly inside a folder shared with you. Without folderId, lists everything shared with you.',
    inputSchema: { folderId: uuid.optional().describe('Id of the folder to list; omit it for the top level.') },
    annotations: READ,
  }, ({ folderId }) => respond(async () => {
    if (!folderId && !owner) return json(listing([{ id: null, name: 'Partagé avec moi' }], await listSharedWithMe(viewer)))
    const { folder, breadcrumbs, items } = await listFolder(viewer, folderId ?? null)
    return json({ folder: folder && describe(folder), ...listing(breadcrumbs, items, folderId) })
  }))

  server.registerTool('search', {
    title: 'Search',
    description: [
      'Finds files and folders by name, by the name of an enclosing folder and by the text inside files (PDF, Word, Excel, PowerPoint, HTML and text).',
      'Every word must match; in the text of files a word matches the start of a word: "factur" finds "factures".',
      'Filters, alone or with words: type:folder|pdf|image|video|audio|document|spreadsheet|presentation|text|html|archive, after:YYYY-MM-DD and before:YYYY-MM-DD (last change), in:<folderId> (with words or another filter).',
      owner ? 'Owner filters: access:private|shared|public, shared:<name or email of someone with access>, tag:<tag> (quote a tag with spaces: tag:"to review"). A word also matches the people an item is shared with.' : '',
    ].join(' ').trim(),
    inputSchema: {
      query: z.string().min(1).max(500).describe('Words and filters, for example: invoice type:pdf after:2026-01-01'),
      limit: z.number().int().min(1).max(100).default(25).describe('Maximum number of results.'),
    },
    annotations: READ,
  }, ({ query, limit }) => respond(async () => {
    const parsed = parseSearchQuery(query)
    if (isEmptySearch(parsed)) throw createError({ statusCode: 400, statusMessage: 'Give at least one word or filter.' })
    const results = await searchResources(viewer, parsed, limit)
    return json({ query: stringifySearchQuery(parsed), results: results.map(describe) })
  }))

  server.registerTool('get_item', {
    title: 'Get details',
    description: owner
      ? 'Details of a file or folder: type, size, dates, location, who it is shared with and how often others viewed it.'
      : 'Details of a file or folder shared with you: type, size, dates and location.',
    inputSchema: { id: uuid.describe('Id of the file or folder.') },
    annotations: READ,
  }, ({ id }) => respond(async () => {
    const { item, path, stats } = await resourceDetails(viewer, id)
    return json({ ...describe(item), location: pathOf(path), ...(stats ? { activity: stats } : {}) })
  }))

  server.registerTool('read_file', {
    title: 'Read a file',
    description: 'Reads a file: the text of text files and the text extracted from PDF (first 100 pages), Word, Excel, PowerPoint and HTML files. '
      + 'PNG, JPEG, GIF and WebP images up to 5 MB come back as images when downloading is allowed. '
      + 'Long texts come in parts: call again with the returned nextOffset to continue. A read counts as opening the file in the app.',
    inputSchema: {
      id: uuid.describe('Id of the file.'),
      offset: z.number().int().min(0).default(0).describe('Character to start from, to continue a long text.'),
      maxCharacters: z.number().int().min(1000).max(MAX_CHARACTERS).default(DEFAULT_CHARACTERS).describe('Maximum number of characters to return.'),
    },
    annotations: READ,
  }, ({ id, offset, maxCharacters }) => respond(() => readFile(event, viewer, id, offset, maxCharacters)))
}

function registerOwnerTools(server: McpServer, event: H3Event, viewer: Viewer) {
  const folderId = uuid.optional().describe('Id of the destination folder; omit it for the top of My Drive.')

  server.registerTool('create_folder', {
    title: 'Create a folder',
    description: 'Creates a folder. Names are unique within a folder, ignoring case.',
    inputSchema: { name: z.string().min(1).max(300).describe('Name of the new folder.'), folderId },
    annotations: { ...WRITE, destructiveHint: false, idempotentHint: false },
  }, ({ name, folderId }) => respond(async () => json(describe(await createFolder(viewer, folderId, name)))))

  server.registerTool('upload_text_file', {
    title: 'Save a text file',
    description: 'Saves text as a file, up to 1 MB; its extension sets its type (notes.md, data.csv, page.html...). '
      + 'When the name is taken: conflict "fail" refuses, "keep" saves it under a new name, "replace" makes it the new version of the existing file, which keeps its shares.',
    inputSchema: {
      name: z.string().min(1).max(300).describe('File name, with its extension.'),
      content: z.string().describe('Text content, saved as UTF-8.'),
      folderId,
      conflict: z.enum(['fail', 'keep', 'replace']).default('fail').describe('What to do when the name is already taken.'),
    },
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: false },
  }, ({ name, content, folderId, conflict }) => respond(async () => {
    const data = Buffer.from(content, 'utf8')
    if (data.length > TEXT_UPLOAD_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Text files are limited to 1 MB.' })
    const { item, replaced } = await uploadBuffer(viewer, { parentId: folderId, name, conflict }, data)
    return json({ ...describe(item), replaced })
  }))

  server.registerTool('rename', {
    title: 'Rename',
    description: 'Renames a file or folder. Keep the extension of a file unless its type really changes.',
    inputSchema: { id: uuid.describe('Id of the file or folder.'), name: z.string().min(1).max(300).describe('New name.') },
    annotations: { ...WRITE, destructiveHint: false, idempotentHint: true },
  }, ({ id, name }) => respond(async () => json(describe(await updateResource(event, viewer, id, { name })))))

  server.registerTool('move', {
    title: 'Move',
    description: 'Moves files and folders, with everything they contain, into another folder. '
      + 'An item then gets the access of its new folder: moving it into a shared folder shares it with the same people.',
    inputSchema: {
      ids: z.array(uuid).min(1).max(100).describe('Ids of the files and folders to move.'),
      folderId,
      conflict: z.enum(['fail', 'keep']).default('fail').describe('"fail" refuses when a name is taken at the destination, "keep" gives the moved item a new name.'),
    },
    annotations: { ...WRITE, destructiveHint: false, idempotentHint: true },
  }, ({ ids, folderId, conflict }) => respond(async () => json(await moveResources(ids, folderId ?? null, conflict))))

  server.registerTool('move_to_trash', {
    title: 'Move to trash',
    description: 'Moves files and folders to the trash: they disappear from the drive and from everyone they were shared with, until the owner restores them from the trash in the app. Nothing is deleted permanently.',
    inputSchema: { ids: z.array(uuid).min(1).max(100).describe('Ids of the files and folders to move to the trash.') },
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  }, ({ ids }) => respond(async () => json(await trashResources(ids))))

  server.registerTool('list_activity', {
    title: 'Recent activity',
    description: 'The activity journal, newest first: what the people the drive is shared with viewed and downloaded, and sharing changes. With id, only that item and, for a folder, everything inside it.',
    inputSchema: {
      id: uuid.optional().describe('Id of a file or folder; omit it for the whole drive.'),
      filter: z.enum(['all', 'views', 'downloads', 'sharing']).default('all'),
      limit: z.number().int().min(1).max(200).default(50),
      before: z.number().int().positive().optional().describe('The next value of a previous call, to get older events.'),
    },
    annotations: READ,
  }, ({ id, filter, limit, before }) => respond(async () => {
    const { events, next } = await listActivity({ resourceId: id, filter, limit, before })
    return json({ events: events.map(describeEvent), next })
  }))
}

async function readFile(event: H3Event, viewer: Viewer, id: string, offset: number, maxCharacters: number): Promise<CallToolResult> {
  const { resource, access } = await requireReadable(viewer, id)
  if (resource.type === 'folder') throw createError({ statusCode: 400, statusMessage: 'This is a folder: list it with list_folder.' })
  if (!resource.storageKey) throw createError({ statusCode: 404, statusMessage: 'This file has no content.' })

  const file = { id: resource.id, name: resource.name, mimeType: resource.mimeType, size: resource.size, url: appUrl(`/open/${resource.id}`) }
  const plan = readPlan(resource, access.download)
  if (plan.as === 'refused') return { isError: true, content: [{ type: 'text', text: JSON.stringify({ ...file, error: plan.reason }) }] }

  const data = await buffer(await useStorageProvider().get(resource.storageKey))
  if (plan.as === 'image') {
    await logAccess(event, viewer, resource, 'view')
    return { content: [{ type: 'text', text: JSON.stringify(file) }, { type: 'image', data: data.toString('base64'), mimeType: resource.mimeType! }] }
  }

  const { text = '' } = await deriveDocument(resource.mimeType!, resource.name, data)
  const window = textWindow(text, offset, maxCharacters)
  await logAccess(event, viewer, resource, 'view')
  const next = window.nextOffset === null ? {} : { nextOffset: window.nextOffset, note: `Truncated: call read_file again with offset ${window.nextOffset} to continue.` }
  return {
    content: [
      { type: 'text', text: JSON.stringify({ ...file, offset, totalCharacters: window.totalCharacters, ...next }) },
      { type: 'text', text: window.text || (text ? 'Nothing left to read after this offset.' : 'No text found in this file: it may only contain images.') },
    ],
  }
}

async function respond(task: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await task()
  }
  catch (error) {
    if (isError(error) && error.statusCode < 500) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: error.statusMessage, ...(error.data ? { details: error.data } : {}) }) }] }
    }
    console.error(JSON.stringify({ level: 'error', job: 'mcp', error: String(error) }))
    return { isError: true, content: [{ type: 'text', text: 'Unexpected server error.' }] }
  }
}

const json = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] })

const pathOf = (crumbs: Crumb[]) => crumbs.map(crumb => crumb.name).join(' / ')

function describe(item: ResourceItem) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    kind: item.kind,
    ...(item.type === 'file' ? { size: item.size, mimeType: item.mimeType } : {}),
    updatedAt: item.updatedAt,
    ...(item.location ? { location: item.location } : {}),
    ...(item.canDownload ? {} : { downloadAllowed: false }),
    ...(item.access ? { sharing: sharingOf(item.access) } : {}),
    ...(item.deletedAt ? { inTrash: true } : {}),
    url: appUrl(`/open/${item.id}`),
  }
}

function sharingOf(access: AccessSummary) {
  return {
    level: access.level,
    people: access.people.map(person => person.label === person.email ? person.email : `${person.label} <${person.email}>`),
    publicLink: access.hasLink,
    ...(access.inherited ? { inheritedFromParent: true } : {}),
  }
}

/** Folders first, then by name; very large folders are cut, with a hint to narrow down. */
function listing(breadcrumbs: Crumb[], items: ResourceItem[], folderId?: string) {
  const sorted = items.toSorted((a, b) => a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === 'folder' ? -1 : 1)
  const hidden = sorted.length - LISTED_ITEMS
  return {
    path: pathOf(breadcrumbs),
    items: sorted.slice(0, LISTED_ITEMS).map(describe),
    ...(hidden > 0 ? { more: `${hidden} more items not shown: search with ${folderId ? `in:${folderId} and ` : ''}a word or a type: filter to narrow down.` } : {}),
  }
}

function describeEvent(event: ActivityEvent) {
  return {
    at: event.createdAt,
    type: event.type,
    by: actorLabel(event),
    ...(event.targetLabel ? { target: event.targetLabel } : {}),
    ...(event.resource ? { item: { id: event.resource.id, name: event.resource.name, type: event.resource.type } } : {}),
  }
}

function actorLabel(event: ActivityEvent) {
  if (event.actorKind === 'owner') return 'the owner'
  if (event.actorKind === 'link') return 'a visitor through the public link'
  if (event.actorKind === 'invitation') return `${event.actorLabel} (personal link)`
  return event.actorLabel
}
