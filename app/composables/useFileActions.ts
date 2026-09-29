import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import {
  ArchiveRestore, Download, ExternalLink, Eye, FolderInput, FolderOpen, History, Info, Link, Pencil, Share2, Star, StarOff, Trash2,
} from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

export type BrowserMode = 'owner' | 'reader' | 'share'

interface ItemsPayload<T = ResourceItem> {
  items: T[]
}

const label = (items: ResourceItem[]) => items.length === 1 ? items[0]!.name : plural(items.length, 'élément')

/** Everything a person can do to files, in one place: menus, palette and shortcuts all read from here. */
export function useFileActions() {
  const queryClient = useQueryClient()
  const dialogs = useDialogs()
  const details = useDetailsPanel()
  const router = useRouter()
  const route = useRoute()

  function refresh() {
    for (const key of ['folder', 'list', 'search', 'resource', 'access', 'activity', 'storage']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  function removeFromCaches(ids: Set<string>) {
    const strip = <T extends { items: ResourceItem[] }>(data: T | undefined) => data && { ...data, items: data.items.filter(i => !ids.has(i.id)) }
    queryClient.setQueriesData<{ items: ResourceItem[] }>({ queryKey: ['folder'] }, strip)
    queryClient.setQueriesData<{ items: ResourceItem[] }>({ queryKey: ['list'] }, strip)
    queryClient.setQueriesData<{ items: ResourceItem[] }>({ queryKey: ['search'] }, strip)
  }

  function patchInCaches(id: string, patch: Partial<ResourceItem>) {
    const apply = <T extends ItemsPayload>(data: T | undefined) => data && { ...data, items: data.items.map(i => i.id === id ? { ...i, ...patch } : i) }
    queryClient.setQueriesData<ItemsPayload>({ queryKey: ['folder'] }, apply)
    queryClient.setQueriesData<ItemsPayload>({ queryKey: ['list'] }, apply)
    queryClient.setQueriesData<ItemsPayload>({ queryKey: ['search'] }, apply)
  }

  /** Optimistic edits are undone from this snapshot when the server refuses or the network is gone. */
  function snapshot() {
    const saved = ['folder', 'list', 'search'].flatMap(key => queryClient.getQueriesData({ queryKey: [key] }))
    return () => {
      for (const [key, data] of saved) queryClient.setQueryData(key, data)
    }
  }

  async function run<T>(task: () => Promise<T>, fallback: string, rollback?: () => void) {
    try {
      return await task()
    }
    catch (error) {
      rollback?.()
      toast.error(errorMessage(error, fallback))
      refresh()
      throw error
    }
  }

  /** HTML pages open in a tab of their own, on the isolated origin, taking the whole window. */
  async function openInTab(item: ResourceItem, apiBase = '/api') {
    const tab = window.open('about:blank', '_blank')
    try {
      const info = await api<{ frameUrl: string | null }>(`${apiBase}/resources/${item.id}/open`, { method: 'POST' })
      if (tab && info.frameUrl) {
        tab.opener = null
        tab.location.href = info.frameUrl
      }
    }
    catch (error) {
      tab?.close()
      toast.error(errorMessage(error, 'Impossible d’ouvrir la page'))
    }
  }

  function preview(item: ResourceItem, full = false) {
    router.push({ query: { ...route.query, preview: item.id, full: full ? '1' : undefined } })
  }

  async function star(items: ResourceItem[], starred: boolean) {
    const rollback = snapshot()
    for (const item of items) patchInCaches(item.id, { starred })
    await run(() => Promise.all(items.map(item => api(`/api/resources/${item.id}`, { method: 'PATCH', body: { starred } }))), 'Impossible de mettre à jour les favoris', rollback)
    queryClient.invalidateQueries({ queryKey: ['list', 'starred'] })
    toast(starred ? `${label(items)} ajouté aux favoris` : `${label(items)} retiré des favoris`)
  }

  async function restore(items: ResourceItem[], quiet = false) {
    const result = await run(() => api<{ restored: Array<{ name: string, renamed: boolean, movedToRoot: boolean }> }>('/api/resources/restore', {
      method: 'POST',
      body: { ids: items.map(i => i.id) },
    }), 'La restauration a échoué')
    refresh()
    if (quiet) return
    const movedToRoot = result.restored.filter(r => r.movedToRoot).length
    toast.success(movedToRoot
      ? `${label(items)} restauré dans Mon Drive (dossier d’origine dans la corbeille)`
      : `${label(items)} restauré`)
  }

  async function trash(items: ResourceItem[]) {
    if (items.length === 0) return
    const rollback = snapshot()
    removeFromCaches(new Set(items.map(i => i.id)))
    await run(() => api('/api/resources/trash', { method: 'POST', body: { ids: items.map(i => i.id) } }), 'Impossible de déplacer vers la corbeille', rollback)
    refresh()
    toast(`${label(items)} déplacé vers la corbeille`, {
      duration: 6000,
      action: { label: 'Annuler', onClick: () => restore(items, true) },
    })
  }

  async function deleteForever(items: ResourceItem[]) {
    const confirmed = await dialogs.confirm({
      title: items.length === 1 ? `Supprimer définitivement « ${items[0]!.name} » ?` : `Supprimer définitivement ${plural(items.length, 'élément')} ?`,
      message: 'Cette action est irréversible. Les partages et l’historique associés seront effacés.',
      confirmLabel: 'Supprimer définitivement',
      danger: true,
    })
    if (!confirmed) return
    const rollback = snapshot()
    removeFromCaches(new Set(items.map(i => i.id)))
    await run(() => Promise.all(items.map(item => api(`/api/resources/${item.id}`, { method: 'DELETE' }))), 'La suppression a échoué', rollback)
    refresh()
    toast(`${label(items)} supprimé définitivement`)
  }

  async function emptyTrash() {
    const confirmed = await dialogs.confirm({
      title: 'Vider la corbeille ?',
      message: 'Tous les éléments de la corbeille seront supprimés définitivement. Cette action est irréversible.',
      confirmLabel: 'Vider la corbeille',
      danger: true,
    })
    if (!confirmed) return
    const { deleted } = await run(() => api<{ deleted: number }>('/api/trash/empty', { method: 'POST' }), 'Impossible de vider la corbeille')
    refresh()
    toast(deleted ? `${plural(deleted, 'élément')} supprimé${deleted > 1 ? 's' : ''} définitivement` : 'La corbeille était déjà vide')
  }

  async function moveTo(items: ResourceItem[], target: { id: string | null, name: string }, options: { undoable?: boolean } = {}) {
    const movable = items.filter(item => item.parentId !== target.id && item.id !== target.id)
    if (movable.length === 0) return
    const origins = Map.groupBy(movable, item => item.parentId)
    const send = (conflict: 'fail' | 'keep') => api('/api/resources/move', { method: 'POST', body: { ids: movable.map(i => i.id), targetId: target.id, conflict } })

    try {
      await send('fail')
    }
    catch (error) {
      if (errorReason(error) !== 'name_taken') {
        toast.error(errorMessage(error, 'Le déplacement a échoué'))
        return
      }
      const choice = await dialogs.conflict({ name: (error as { data?: { data?: { conflicts?: string[] } } }).data?.data?.conflicts?.[0] ?? movable[0]!.name, kind: 'file', remaining: 0 })
      if (choice.strategy === 'skip') return
      await run(() => send('keep'), 'Le déplacement a échoué')
    }
    refresh()
    toast(`${label(movable)} déplacé vers ${target.name}`, {
      duration: 6000,
      action: options.undoable === false
        ? undefined
        : {
            label: 'Annuler',
            onClick: async () => {
              for (const [parentId, group] of origins) {
                await api('/api/resources/move', { method: 'POST', body: { ids: group.map(i => i.id), targetId: parentId, conflict: 'keep' } })
              }
              refresh()
            },
          },
    })
  }

  async function copyLink(item: ResourceItem) {
    let url = `${location.origin}/open/${item.id}`
    let message = 'Lien copié, accessible aux personnes ayant accès'
    if (item.access?.hasLink) {
      const access = await api<{ link: { url: string } | null, inheritedLink: { url: string } | null }>(`/api/resources/${item.id}/access`)
      const link = access.link ?? access.inheritedLink
      if (link) {
        url = link.url
        message = 'Lien public copié'
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast(message)
    }
    catch {
      toast(`Copie impossible. Lien : ${url}`, { duration: 10000 })
    }
  }

  /** One file downloads as is; a folder or a selection becomes a single ZIP, streamed by the server. */
  function download(items: ResourceItem[], apiBase = '/api') {
    const allowed = items.filter(item => item.canDownload)
    if (allowed.length === 0) return
    const single = allowed.length === 1 ? allowed[0]! : null
    const anchor = document.createElement('a')
    anchor.href = single
      ? `${apiBase}/resources/${single.id}/download`
      : `${apiBase}/downloads?ids=${allowed.map(item => item.id).join(',')}`
    anchor.download = single?.type === 'file' ? single.name : ''
    anchor.click()
    if (!single || single.type === 'folder') toast('Préparation de l’archive ZIP, le téléchargement démarre')
  }

  function showDetails(item: ResourceItem | null, tab: DetailsTab = 'details') {
    details.show(item, tab)
  }

  interface MenuContext {
    mode: BrowserMode
    trash?: boolean
    open?: (item: ResourceItem) => void
    apiBase?: string
  }

  function menuFor(items: ResourceItem[], context: MenuContext): MenuEntry[] {
    if (items.length === 0) return []
    const single = items.length === 1 ? items[0]! : null
    const downloadable = items.some(item => item.canDownload)

    if (context.trash) {
      return [
        { id: 'restore', label: 'Restaurer', icon: ArchiveRestore, onSelect: () => restore(items) },
        { kind: 'separator' },
        { id: 'delete', label: 'Supprimer définitivement', icon: Trash2, danger: true, onSelect: () => deleteForever(items) },
      ]
    }

    const openEntries: MenuEntry[] = single
      ? [
          { id: 'open', label: 'Ouvrir', icon: single.type === 'folder' ? FolderOpen : Eye, shortcut: 'Entrée', onSelect: () => context.open?.(single) },
          ...(single.type === 'file' ? [{ id: 'preview', label: 'Aperçu rapide', icon: Eye, shortcut: 'Espace', onSelect: () => preview(single) }] : []),
          ...(single.kind === 'html' ? [{ id: 'open-tab', label: 'Ouvrir en pleine fenêtre', icon: ExternalLink, onSelect: () => openInTab(single, context.apiBase) }] : []),
        ]
      : []

    if (context.mode !== 'owner') {
      return tidyMenu([
        ...openEntries,
        { kind: 'separator' },
        downloadable && { id: 'download', label: 'Télécharger', icon: Download, onSelect: () => download(items, context.apiBase) },
        context.mode === 'reader' && single && { id: 'details', label: 'Détails', icon: Info, onSelect: () => showDetails(single) },
      ])
    }

    const allStarred = items.every(item => item.starred)
    return tidyMenu([
      ...openEntries,
      { kind: 'separator' },
      single && { id: 'share', label: 'Partager', icon: Share2, shortcut: 'Mod+Alt+A', onSelect: () => dialogs.share(single) },
      single && { id: 'copy-link', label: 'Copier le lien', icon: Link, onSelect: () => copyLink(single) },
      { kind: 'separator' },
      { id: 'star', label: allStarred ? 'Retirer des favoris' : 'Ajouter aux favoris', icon: allStarred ? StarOff : Star, shortcut: 'S', onSelect: () => star(items, !allStarred) },
      { kind: 'separator' },
      single && { id: 'rename', label: 'Renommer', icon: Pencil, shortcut: 'F2', onSelect: () => dialogs.rename(single) },
      { id: 'move', label: 'Déplacer', icon: FolderInput, onSelect: () => dialogs.move(items) },
      downloadable && { id: 'download', label: 'Télécharger', icon: Download, onSelect: () => download(items) },
      { kind: 'separator' },
      single && { id: 'details', label: 'Détails', icon: Info, onSelect: () => showDetails(single, 'details') },
      single && { id: 'activity', label: 'Activité', icon: History, onSelect: () => showDetails(single, 'activity') },
      { kind: 'separator' },
      { id: 'trash', label: 'Déplacer vers la corbeille', icon: Trash2, shortcut: 'Suppr', danger: true, onSelect: () => trash(items) },
    ])
  }

  return { refresh, preview, openInTab, star, trash, restore, deleteForever, emptyTrash, moveTo, copyLink, download, showDetails, menuFor, patchInCaches }
}
