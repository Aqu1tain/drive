import type { ResourceItem } from '#shared/types/api'

export type DetailsTab = 'details' | 'access' | 'activity' | 'versions'

const state = reactive({ tab: 'details' as DetailsTab, pinned: null as ResourceItem | null })

/** The right-hand details panel: its visibility is a preference, its tab and focus are not. */
export function useDetailsPanel() {
  const preferences = usePreferences()
  return {
    state,
    open: computed(() => preferences.detailsOpen),
    show(item: ResourceItem | null, tab: DetailsTab = 'details') {
      state.pinned = item
      state.tab = tab
      preferences.detailsOpen = true
    },
    toggle() {
      preferences.detailsOpen = !preferences.detailsOpen
    },
    close() {
      preferences.detailsOpen = false
    },
  }
}
