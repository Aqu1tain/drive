import { describe, expect, it } from 'vitest'
import { generateToken, hashIp, hashToken, openToken, sealToken, signPayload, verifyPayload } from '../../server/lib/crypto'

const secret = 'test-secret-with-enough-entropy-000000'

describe('tokens', () => {
  it('generates unguessable url-safe tokens', () => {
    const token = generateToken()
    expect(token).toMatch(/^[\w-]{32}$/)
    expect(generateToken()).not.toBe(token)
  })

  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('seals and opens tokens', () => {
    const sealed = sealToken('my-token', secret)
    expect(sealed).not.toContain('my-token')
    expect(openToken(sealed, secret)).toBe('my-token')
  })

  it('refuses to open a sealed token with another secret', () => {
    expect(() => openToken(sealToken('my-token', secret), 'another-secret')).toThrow()
  })

  it('refuses a tampered sealed token', () => {
    const sealed = Buffer.from(sealToken('my-token', secret), 'base64url')
    sealed[sealed.length - 1] ^= 1
    expect(() => openToken(sealed.toString('base64url'), secret)).toThrow()
  })
})

describe('signed payloads', () => {
  it('round-trips a payload', () => {
    const token = signPayload({ r: 'res', e: 1 }, secret, 'usercontent')
    expect(verifyPayload(token, secret, 'usercontent')).toEqual({ r: 'res', e: 1 })
  })

  it('rejects a modified payload', () => {
    const [, signature] = signPayload({ r: 'res' }, secret, 'usercontent').split('.')
    const forged = `${Buffer.from(JSON.stringify({ r: 'other' })).toString('base64url')}.${signature}`
    expect(verifyPayload(forged, secret, 'usercontent')).toBeNull()
  })

  it('rejects a payload signed for another purpose', () => {
    expect(verifyPayload(signPayload({ r: 'res' }, secret, 'a'), secret, 'b')).toBeNull()
  })

  it('rejects garbage', () => {
    for (const token of ['', 'abc', 'a.b', '..']) expect(verifyPayload(token, secret, 'usercontent')).toBeNull()
  })
})

describe('hashIp', () => {
  it('groups addresses of the same network', () => {
    expect(hashIp('203.0.113.7', secret)).toBe(hashIp('203.0.113.99', secret))
    expect(hashIp('203.0.113.7', secret)).not.toBe(hashIp('198.51.100.7', secret))
  })

  it('never contains the address', () => {
    expect(hashIp('203.0.113.7', secret)).not.toContain('203')
  })
})
