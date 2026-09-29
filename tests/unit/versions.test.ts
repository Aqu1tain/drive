import { describe, expect, it } from 'vitest'
import { MAX_VERSIONS, cleanVersionLabel, versionsToPrune } from '../../shared/utils/versions'

const now = new Date('2026-09-30T12:00:00Z')
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000)
const version = (id: string, savedAt: Date, label: string | null = null) => ({ id, savedAt, label })

describe('versionsToPrune', () => {
  it('keeps every version of the last day', () => {
    expect(versionsToPrune([version('a', hoursAgo(1)), version('b', hoursAgo(2)), version('c', hoursAgo(23))], now)).toEqual([])
  })

  it('keeps the latest version of each day for a month', () => {
    const versions = [version('late', hoursAgo(30)), version('early', hoursAgo(34)), version('other-day', hoursAgo(60))]
    expect(versionsToPrune(versions, now)).toEqual(['early'])
  })

  it('keeps the latest version of each week after a month', () => {
    const day = 24
    const versions = [version('newest', hoursAgo(40 * day)), version('same-week', hoursAgo(41 * day)), version('older-week', hoursAgo(50 * day))]
    const pruned = versionsToPrune(versions, now)
    expect(pruned).not.toContain('newest')
    expect(pruned).not.toContain('older-week')
  })

  it('never removes a named version', () => {
    expect(versionsToPrune([version('named', hoursAgo(34), 'Signed'), version('late', hoursAgo(30))], now)).toEqual([])
  })

  it('keeps at most the limit, oldest unnamed first to go', () => {
    const versions = Array.from({ length: MAX_VERSIONS + 5 }, (_, i) => version(`v${i}`, hoursAgo(i / 10)))
    const pruned = versionsToPrune([...versions, version('named', hoursAgo(20), 'Keep')], now)
    expect(pruned).toHaveLength(6)
    expect(pruned).toContain(`v${MAX_VERSIONS + 4}`)
    expect(pruned).not.toContain('v0')
  })
})

describe('cleanVersionLabel', () => {
  it('tidies what people type', () => {
    expect(cleanVersionLabel('  Version   signée\n')).toBe('Version signée')
    expect(cleanVersionLabel('x'.repeat(300))).toHaveLength(100)
  })
})
