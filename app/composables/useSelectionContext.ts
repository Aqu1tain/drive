import type { ResourceItem } from '#shared/types/api'

const state = reactive({
  items: [] as ResourceItem[],
  mode: 'owner' as BrowserMode,
  folder: null as { id: string | null, name: string } | null,
  open: null as ((item: ResourceItem) => void) | null,
})

/** What the current view has selected, so the palette and global shortcuts can act on it. */
export function useSelectionContext() {
  return { state }
}
