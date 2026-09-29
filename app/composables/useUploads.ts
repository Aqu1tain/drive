import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { isSystemFile } from '#shared/utils/names'
import type { FolderListing, ResourceDetails, ResourceItem } from '#shared/types/api'

export interface UploadTarget {
  id: string | null
  name: string
}

export interface UploadTask {
  id: string
  batchId: string
  file: File
  name: string
  parentId: string | null
  parentName: string
  loaded: number
  status: 'queued' | 'uploading' | 'done' | 'error' | 'canceled'
  error?: string
  nameTaken?: boolean
  conflict: 'fail' | 'keep' | 'replace'
  resourceId?: string
  renamed?: boolean
  sessionId?: string
  partSize?: number
  nextPart?: number
}

export interface TreeFile {
  file: File
  path: string[]
}

interface Batch {
  id: string
  target: UploadTarget
  total: number
}

const CONCURRENCY = 3
/** Above one part a file travels in parts: requests stay short even on a slow connection, and each one can be retried. */
const MULTIPART_THRESHOLD = 8 * 1024 * 1024
/** Enough to ride out a network drop or a server restart: about 30 seconds of backing off. */
const UPLOAD_ATTEMPTS = 6
const state = reactive({ tasks: [] as UploadTask[], announcement: '' })
const requests = new Map<string, XMLHttpRequest>()
const batches = new Map<string, Batch>()
let queryClient: ReturnType<typeof useQueryClient> | undefined
let router: ReturnType<typeof useRouter> | undefined

/** randomUUID only exists in secure contexts; a plain-HTTP install by IP must still upload. */
const newId = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

function markDone(task: UploadTask, item: ResourceItem) {
  task.status = 'done'
  task.loaded = task.file.size
  task.resourceId = item.id
  task.renamed = item.name !== task.name
  queryClient?.invalidateQueries({ queryKey: ['folder', task.parentId ?? 'root'] })
  queryClient?.invalidateQueries({ queryKey: ['versions', item.id] })
  queryClient?.invalidateQueries({ queryKey: ['resource', item.id] })
  if (item.kind === 'video' && !item.thumbnailUrl) addVideoThumbnail(task, item.id)
}

/** The local file is at hand: its frame is captured without downloading anything. */
async function addVideoThumbnail(task: UploadTask, resourceId: string) {
  const src = URL.createObjectURL(task.file)
  const added = await uploadVideoThumbnail(resourceId, src).catch(() => false)
  URL.revokeObjectURL(src)
  if (added) queryClient?.invalidateQueries({ queryKey: ['folder', task.parentId ?? 'root'] })
}

function xhrError(xhr: XMLHttpRequest) {
  let body: unknown
  try {
    body = JSON.parse(xhr.responseText)
  }
  catch {}
  return { statusCode: xhr.status || undefined, data: body }
}

function putPart(task: UploadTask, partNumber: number, blob: Blob, offset: number) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    requests.set(task.id, xhr)
    xhr.open('PUT', `/api/uploads/sessions/${task.sessionId}/parts/${partNumber}`)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = event => (task.loaded = offset + event.loaded)
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(xhrError(xhr))
    xhr.onerror = () => reject({ statusCode: undefined })
    xhr.onabort = () => reject({ canceled: true })
    xhr.send(blob)
  })
}

interface UploadFailure {
  canceled?: boolean
  statusCode?: number
  data?: { data?: { reason?: string, existingId?: string } }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const isTransient = (failure: UploadFailure) => !failure.canceled && (!failure.statusCode || failure.statusCode >= 500)
const backOff = (attempt: number) => wait(1000 * 2 ** (attempt - 1))

function uploadError(error: unknown) {
  if ((error as UploadFailure).statusCode) return errorMessage(error, say('uploads.error'))
  return say(navigator.onLine ? 'uploads.interrupted' : 'uploads.offline')
}

function fail(task: UploadTask, error: unknown) {
  task.status = 'error'
  task.error = uploadError(error)
  task.nameTaken = errorReason(error) === 'name_taken'
}
/** Read through a function: a cancel can land between two awaits, which type narrowing cannot see. */
const isCanceled = (task: UploadTask) => task.status === 'canceled'

async function resumePoint(task: UploadTask) {
  if (!task.sessionId) return
  try {
    const state = await api<{ nextPart: number }>(`/api/uploads/sessions/${task.sessionId}`)
    task.nextPart = state.nextPart
  }
  catch {
    task.sessionId = undefined
  }
}

async function sendParts(task: UploadTask) {
  task.status = 'uploading'
  task.error = undefined
  try {
    await resumePoint(task)
    if (!task.sessionId) {
      const session = await api<{ id: string, partSize: number }>('/api/uploads/sessions', {
        method: 'POST',
        body: { parentId: task.parentId, name: task.name, size: task.file.size, conflict: task.conflict },
      })
      Object.assign(task, { sessionId: session.id, partSize: session.partSize, nextPart: 1 })
    }
    const partSize = task.partSize!
    const total = Math.ceil(task.file.size / partSize)
    while (task.nextPart! <= total) {
      const offset = (task.nextPart! - 1) * partSize
      for (let attempt = 1; ; attempt++) {
        if (isCanceled(task)) return
        try {
          await putPart(task, task.nextPart!, task.file.slice(offset, offset + partSize), offset)
          task.nextPart! += 1
          break
        }
        catch (error) {
          const failure = error as UploadFailure
          if (failure.canceled) return
          if (failure.data?.data?.reason === 'part_order') {
            await resumePoint(task)
            break
          }
          if (!isTransient(failure) || attempt >= UPLOAD_ATTEMPTS) throw failure
          await backOff(attempt)
        }
      }
    }
    const item = await api<ResourceItem>(`/api/uploads/sessions/${task.sessionId}/complete`, { method: 'POST' })
    task.sessionId = undefined
    markDone(task, item)
  }
  catch (error) {
    if (!isCanceled(task)) fail(task, error)
  }
  finally {
    requests.delete(task.id)
    settle(task)
  }
}

function putWhole(task: UploadTask) {
  return new Promise<ResourceItem>((resolve, reject) => {
    const query = new URLSearchParams({ name: task.name, conflict: task.conflict, ...(task.parentId ? { parentId: task.parentId } : {}) })
    const xhr = new XMLHttpRequest()
    requests.set(task.id, xhr)
    xhr.open('PUT', `/api/uploads?${query}`)
    xhr.setRequestHeader('Content-Type', task.file.type || 'application/octet-stream')
    xhr.upload.onprogress = event => (task.loaded = event.loaded)
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText) as ResourceItem) : reject(xhrError(xhr))
    xhr.onerror = () => reject({ statusCode: undefined })
    xhr.onabort = () => reject({ canceled: true })
    xhr.send(task.file)
  })
}

/** A connection cut after the server stored the file leaves it in place: the retry meets it under the same name, same size. */
async function alreadyStored(task: UploadTask, failure: UploadFailure) {
  const existingId = failure.data?.data?.existingId
  if (failure.data?.data?.reason !== 'name_taken' || !existingId) return null
  const { item } = await api<ResourceDetails>(`/api/resources/${existingId}`)
  return item.size === task.file.size ? item : null
}

async function sendWhole(task: UploadTask) {
  task.status = 'uploading'
  task.error = undefined
  let interrupted = false
  try {
    for (let attempt = 1; ; attempt++) {
      if (isCanceled(task)) return
      task.loaded = 0
      try {
        markDone(task, await putWhole(task))
        return
      }
      catch (error) {
        const failure = error as UploadFailure
        const stored = interrupted ? await alreadyStored(task, failure) : null
        if (stored) {
          markDone(task, stored)
          return
        }
        if (!isTransient(failure) || attempt >= UPLOAD_ATTEMPTS) throw failure
        interrupted = true
        await backOff(attempt)
      }
    }
  }
  catch (error) {
    if (!isCanceled(task) && !(error as UploadFailure).canceled) fail(task, error)
  }
  finally {
    requests.delete(task.id)
    settle(task)
  }
}

const send = (task: UploadTask) => task.file.size > MULTIPART_THRESHOLD ? sendParts(task) : sendWhole(task)

function pump() {
  const running = state.tasks.filter(t => t.status === 'uploading').length
  const next = state.tasks.filter(t => t.status === 'queued').slice(0, CONCURRENCY - running)
  for (const task of next) send(task)
}

function settle(task: UploadTask) {
  pump()
  const batch = batches.get(task.batchId)
  if (!batch) return
  const tasks = state.tasks.filter(t => t.batchId === batch.id)
  if (tasks.some(t => t.status === 'queued' || t.status === 'uploading')) return

  batches.delete(batch.id)
  queryClient?.invalidateQueries({ queryKey: ['storage'] })
  queryClient?.invalidateQueries({ queryKey: ['list'] })
  const done = tasks.filter(t => t.status === 'done')
  const failed = tasks.filter(t => t.status === 'error')
  const renamed = done.filter(t => t.renamed).length
  const summary = say('uploads.done', { count: done.length })
  state.announcement = failed.length ? say('uploads.doneWithErrors', { summary, count: failed.length }) : summary
  if (done.length === 0) return

  toast.success(renamed ? say('uploads.doneRenamed', { summary, count: renamed }) : summary, {
    action: {
      label: say('uploads.show'),
      onClick: () => router?.push(batch.target.id ? `/drive/folder/${batch.target.id}` : '/drive'),
    },
  })
}

function enqueue(files: Array<{ file: File, name?: string, parentId: string | null, parentName: string, conflict: UploadTask['conflict'] }>, target: UploadTarget) {
  if (files.length === 0) return
  const batch: Batch = { id: newId(), target, total: files.length }
  batches.set(batch.id, batch)
  state.tasks.push(...files.map(f => ({
    id: newId(),
    batchId: batch.id,
    file: f.file,
    name: f.name ?? f.file.name,
    parentId: f.parentId,
    parentName: f.parentName,
    loaded: 0,
    status: 'queued' as const,
    conflict: f.conflict,
  })))
  state.announcement = say('uploads.uploadingTo', { count: files.length, folder: target.name })
  pump()
}

async function resolveConflicts(names: string[], kind: 'file' | 'folder', versioned = false) {
  const dialogs = useDialogs()
  const decisions = new Map<string, 'replace' | 'keep' | 'skip'>()
  let applyAll: 'replace' | 'keep' | 'skip' | null = null
  for (const [index, name] of names.entries()) {
    if (applyAll) {
      decisions.set(name, applyAll)
      continue
    }
    const choice = await dialogs.conflict({ name, kind, versioned, remaining: names.length - index - 1 })
    decisions.set(name, choice.strategy)
    if (choice.applyToAll) applyAll = choice.strategy
  }
  return decisions
}

/** A new version of a file: same name, same place, whatever the picked file is called. */
function uploadVersion(file: File, item: ResourceItem, folder: UploadTarget) {
  enqueue([{ file, name: item.name, parentId: item.parentId, parentName: folder.name, conflict: 'replace' }], folder)
}

async function uploadFiles(files: File[], target: UploadTarget) {
  if (files.length === 0) return
  try {
    const { conflicts, versioning } = await api<{ conflicts: Array<{ name: string, existingType: 'file' | 'folder' }>, versioning: boolean }>('/api/uploads/check', {
      method: 'POST',
      body: { parentId: target.id, names: files.map(f => f.name) },
    })
    const decisions = await resolveConflicts(conflicts.map(c => c.name), 'file', versioning)
    const byLower = new Map([...decisions].map(([name, strategy]) => [name.toLowerCase(), strategy]))
    const accepted = files.flatMap((file) => {
      const decision = byLower.get(file.name.toLowerCase())
      if (decision === 'skip') return []
      const conflictType = conflicts.find(c => c.name.toLowerCase() === file.name.toLowerCase())?.existingType
      const conflict = !decision ? 'fail' as const : conflictType === 'folder' ? 'keep' as const : decision
      return [{ file, parentId: target.id, parentName: target.name, conflict }]
    })
    enqueue(accepted, target)
  }
  catch (error) {
    toast.error(errorMessage(error, say('uploads.prepareFailed')))
  }
}

/** Dropped or picked directories: top-level folders that already exist can be merged or kept side by side. */
async function uploadTree(entries: TreeFile[], target: UploadTarget) {
  const loose = entries.filter(e => e.path.length === 0).map(e => e.file)
  const nested = entries.filter(e => e.path.length > 0)
  await uploadFiles(loose, target)
  if (nested.length === 0) return

  try {
    const roots = [...new Set(nested.map(e => e.path[0]!))]
    const listing = await api<FolderListing>(`/api/folders/${target.id ?? 'root'}`)
    const taken = listing.items.map(i => i.name)
    const existing = roots.filter(root => taken.some(name => name.toLowerCase() === root.toLowerCase()))
    const decisions = await resolveConflicts(existing, 'folder')

    const rename = new Map<string, string>()
    for (const root of roots) {
      const decision = decisions.get(root)
      if (decision === 'skip') continue
      const finalName = decision === 'keep' ? keepBothName(root, taken) : root
      taken.push(finalName)
      rename.set(root, finalName)
    }

    const folderIds = new Map<string, string>()
    const files: Parameters<typeof enqueue>[0] = []
    for (const entry of nested) {
      const root = rename.get(entry.path[0]!)
      if (!root) continue
      const path = [root, ...entry.path.slice(1)]
      const key = path.join('/')
      if (!folderIds.has(key)) {
        const { id } = await api<{ id: string }>('/api/folders/ensure', { method: 'POST', body: { parentId: target.id, path } })
        folderIds.set(key, id)
      }
      files.push({ file: entry.file, parentId: folderIds.get(key)!, parentName: path.at(-1)!, conflict: 'keep' })
    }
    queryClient?.invalidateQueries({ queryKey: ['folder', target.id ?? 'root'] })
    enqueue(files, target)
  }
  catch (error) {
    toast.error(errorMessage(error, say('uploads.prepareFolderFailed')))
  }
}

export async function filesFromDataTransfer(transfer: DataTransfer): Promise<TreeFile[]> {
  const entries = [...transfer.items].map(item => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e && !isSystemFile(e.name))
  if (entries.length === 0) return [...transfer.files].filter(file => !isSystemFile(file.name)).map(file => ({ file, path: [] }))

  const result: TreeFile[] = []
  async function walk(entry: FileSystemEntry, path: string[]) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
      result.push({ file, path })
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
      for (const child of batch) {
        if (!isSystemFile(child.name)) await walk(child, [...path, entry.name])
      }
    } while (batch.length > 0)
  }
  for (const entry of entries) await walk(entry, [])
  return result
}

export const filesFromInput = (files: FileList): TreeFile[] => [...files]
  .filter(file => !isSystemFile(file.webkitRelativePath || file.name))
  .map(file => ({ file, path: file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(0, -1) : [] }))

function cancelTask(task: UploadTask) {
  task.status = 'canceled'
  requests.get(task.id)?.abort()
  if (task.sessionId) api(`/api/uploads/sessions/${task.sessionId}`, { method: 'DELETE' }).catch(() => {})
  task.sessionId = undefined
}

export function useUploads() {
  queryClient ??= useQueryClient()
  router ??= useRouter()
  const active = computed(() => state.tasks.filter(t => t.status === 'queued' || t.status === 'uploading'))
  const totalBytes = computed(() => active.value.reduce((sum, t) => sum + t.file.size, 0))
  const loadedBytes = computed(() => active.value.reduce((sum, t) => sum + t.loaded, 0))

  return {
    state,
    active,
    progress: computed(() => totalBytes.value ? loadedBytes.value / totalBytes.value : 1),
    uploadFiles,
    uploadTree,
    uploadVersion,
    retry(task: UploadTask) {
      task.status = 'queued'
      if (task.nameTaken) task.conflict = 'keep'
      batches.set(task.batchId, batches.get(task.batchId) ?? { id: task.batchId, target: { id: task.parentId, name: task.parentName }, total: 1 })
      pump()
    },
    cancel(task: UploadTask) {
      cancelTask(task)
    },
    cancelAll() {
      for (const task of active.value) cancelTask(task)
    },
    clear() {
      state.tasks = state.tasks.filter(t => t.status === 'queued' || t.status === 'uploading')
    },
  }
}
