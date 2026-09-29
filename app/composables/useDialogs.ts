import type { ResourceItem, TagInfo } from '#shared/types/api'

export interface ConflictChoice {
  strategy: 'replace' | 'keep' | 'skip'
  applyToAll: boolean
}

export interface ConflictRequest {
  name: string
  kind: 'file' | 'folder'
  /** Replacing keeps the current file in its version history. */
  versioned?: boolean
  remaining: number
  resolve: (choice: ConflictChoice) => void
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  resolve: (confirmed: boolean) => void
}

export interface ShareTarget {
  id: string
  name: string
  type: 'file' | 'folder'
}

interface DialogState {
  share: ShareTarget | null
  rename: ResourceItem | null
  move: ResourceItem[] | null
  tags: ResourceItem[] | null
  tagEdit: TagInfo | null
  newFolder: { parentId: string | null } | null
  conflict: ConflictRequest | null
  confirm: ConfirmRequest | null
  shortcuts: boolean
  palette: boolean
}

const state = reactive<DialogState>({
  share: null,
  rename: null,
  move: null,
  tags: null,
  tagEdit: null,
  newFolder: null,
  conflict: null,
  confirm: null,
  shortcuts: false,
  palette: false,
})

export function useDialogs() {
  return {
    state,
    anyOpen: computed(() => !!(state.share || state.rename || state.move || state.tags || state.tagEdit || state.newFolder || state.conflict || state.confirm || state.shortcuts || state.palette)),
    share: (item: ShareTarget) => (state.share = { id: item.id, name: item.name, type: item.type }),
    rename: (item: ResourceItem) => (state.rename = item),
    move: (items: ResourceItem[]) => (state.move = items),
    tags: (items: ResourceItem[]) => (state.tags = items),
    tagEdit: (tag: TagInfo) => (state.tagEdit = tag),
    newFolder: (parentId: string | null) => (state.newFolder = { parentId }),
    shortcuts: () => (state.shortcuts = true),
    palette: (open = true) => (state.palette = open),
    conflict: (request: Omit<ConflictRequest, 'resolve'>) =>
      new Promise<ConflictChoice>(resolve => (state.conflict = { ...request, resolve })),
    confirm: (request: Omit<ConfirmRequest, 'resolve'>) =>
      new Promise<boolean>(resolve => (state.confirm = { ...request, resolve })),
  }
}
