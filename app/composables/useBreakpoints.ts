const QUERIES = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  coarse: '(pointer: coarse)',
} as const

type Name = keyof typeof QUERIES

const state = reactive<Record<Name, boolean>>({ sm: true, md: true, lg: true, xl: true, coarse: false })
let started = false

export function useBreakpoints() {
  if (!started && import.meta.client) {
    started = true
    for (const [name, query] of Object.entries(QUERIES) as Array<[Name, string]>) {
      const media = window.matchMedia(query)
      state[name] = media.matches
      media.addEventListener('change', event => (state[name] = event.matches))
    }
  }
  return state
}
