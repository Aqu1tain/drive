export interface Preferences {
  view: 'list' | 'grid'
  density: 'comfortable' | 'compact'
  sortBy: 'name' | 'updatedAt' | 'size' | 'lastExternalViewAt'
  sortDir: 'asc' | 'desc'
  detailsOpen: boolean
  sidebarCollapsed: boolean
  uploadsCollapsed: boolean
}

const DEFAULTS: Preferences = {
  view: 'list',
  density: 'comfortable',
  sortBy: 'name',
  sortDir: 'asc',
  detailsOpen: false,
  sidebarCollapsed: false,
  uploadsCollapsed: false,
}

const KEY = 'drive-preferences'

function load(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  }
  catch {
    return { ...DEFAULTS }
  }
}

let state: Preferences | undefined

/** View preferences survive reloads; navigation state (folder, selection, preview) never does. */
export function usePreferences() {
  if (!state) {
    state = reactive(import.meta.client ? load() : { ...DEFAULTS })
    if (import.meta.client) {
      watch(state, (value) => {
        try {
          localStorage.setItem(KEY, JSON.stringify(value))
        }
        catch {}
      }, { deep: true })
    }
  }
  return state
}
