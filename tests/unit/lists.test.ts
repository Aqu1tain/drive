import { describe, expect, it } from 'vitest'
import type { ResourceItem } from '../../shared/types/api'
import { mapCachedLists } from '../../app/utils/lists'

const item = (id: string) => ({ id, name: id }) as ResourceItem
const drop = (id: string) => (items: ResourceItem[]) => items.filter(entry => entry.id !== id)

describe('mapCachedLists', () => {
  it('updates a folder listing', () => {
    expect(mapCachedLists({ folder: null, items: [item('a'), item('b')] }, drop('a'))).toEqual({ folder: null, items: [item('b')] })
  })

  it('updates the home page, whose lists have other names', () => {
    const home = { folders: [item('a')], files: [item('a'), item('b')], activity: [{ id: 'a' }] }
    expect(mapCachedLists(home, drop('a'))).toEqual({ folders: [], files: [item('b')], activity: [{ id: 'a' }] })
  })

  it('leaves anything else untouched', () => {
    expect(mapCachedLists(undefined, drop('a'))).toBeUndefined()
    const tags = [{ id: 'tag' }]
    expect(mapCachedLists(tags, drop('tag'))).toBe(tags)
    const stats = { views: 3 }
    expect(mapCachedLists(stats, drop('a'))).toBe(stats)
  })
})
