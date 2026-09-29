import type { Component } from 'vue'

export interface MenuAction {
  kind?: 'action'
  id: string
  label: string
  icon?: Component
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  /** An on/off setting: shows a check mark and reads as a checkbox. */
  checked?: boolean
  onSelect: () => void
}

export interface MenuSeparator {
  kind: 'separator'
}

export type MenuEntry = MenuAction | MenuSeparator

export const isAction = (entry: MenuEntry): entry is MenuAction => entry.kind !== 'separator'

/** Drops leading, trailing and doubled separators left behind by conditional entries. */
export function tidyMenu(entries: Array<MenuEntry | false | null | undefined | ''>) {
  const result: MenuEntry[] = []
  for (const entry of entries) {
    if (!entry) continue
    if (entry.kind === 'separator' && (result.length === 0 || result.at(-1)?.kind === 'separator')) continue
    result.push(entry)
  }
  if (result.at(-1)?.kind === 'separator') result.pop()
  return result
}

/** Long menus scroll instead of running off a short screen. */
export const MENU_CONTENT = 'z-(--z-menu) min-w-56 max-h-[var(--reka-dropdown-menu-content-available-height,var(--reka-context-menu-content-available-height,80vh))] overflow-y-auto rounded-lg border border-line-weak bg-raised p-1 shadow-lifted animate-pop-in origin-(--reka-dropdown-menu-content-transform-origin) focus:outline-none'
export const MENU_ITEM = 'flex h-9 cursor-pointer select-none items-center gap-3 rounded-md px-2.5 text-base text-ink outline-none data-highlighted:bg-hover data-disabled:opacity-40'
