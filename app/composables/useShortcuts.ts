const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** App-wide shortcuts. List-level keys (arrows, Enter, Space, F2, Delete…) live in the file browser. */
export function useShortcuts() {
  const dialogs = useDialogs()
  const selection = useSelectionContext()

  function onKeydown(event: KeyboardEvent) {
    const mod = event.metaKey || event.ctrlKey
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      dialogs.palette(!dialogs.state.palette)
      return
    }
    if (mod && event.key === '/') {
      event.preventDefault()
      dialogs.state.shortcuts = !dialogs.state.shortcuts
      return
    }
    if (dialogs.anyOpen.value || isTyping(event.target)) return
    if (event.key === '/' && !mod) {
      event.preventDefault()
      document.dispatchEvent(new CustomEvent('drive:focus-search'))
      return
    }
    if (mod && event.altKey && event.code === 'KeyA' && selection.state.items.length === 1 && selection.state.mode === 'member') {
      event.preventDefault()
      dialogs.share(selection.state.items[0]!)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
