import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { GRACE_DAYS, licenseActive, readLicense } from '../../server/lib/license'

const licensor = generateKeyPairSync('ed25519')
const stranger = generateKeyPairSync('ed25519')

function issue(claims: object, privateKey = licensor.privateKey) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${sign(null, Buffer.from(payload), privateKey).toString('base64url')}`
}

const claims = { v: 1, id: 'lic-1', org: 'Acme', seats: 10, exp: '2027-01-01T00:00:00.000Z' }

describe('readLicense', () => {
  it('reads a key signed by the licensor', () => {
    expect(readLicense(issue(claims), licensor.publicKey)).toEqual({ id: 'lic-1', organization: 'Acme', seats: 10, expiresAt: new Date(claims.exp) })
  })

  it('refuses a key signed by anyone else', () => {
    expect(readLicense(issue(claims, stranger.privateKey), licensor.publicKey)).toBeNull()
  })

  it('refuses a key whose terms were changed after signing', () => {
    const [, signature] = issue(claims).split('.')
    const forged = Buffer.from(JSON.stringify({ ...claims, seats: 1000 })).toString('base64url')
    expect(readLicense(`${forged}.${signature}`, licensor.publicKey)).toBeNull()
  })

  it('refuses malformed keys and incomplete terms', () => {
    for (const key of ['', 'abc', 'a.b.c', issue({ ...claims, seats: 0 }), issue({ ...claims, exp: 'soon' }), issue({ ...claims, v: 2 })]) {
      expect(readLicense(key, licensor.publicKey)).toBeNull()
    }
  })
})

describe('licenseActive', () => {
  const license = readLicense(issue(claims), licensor.publicKey)
  const day = 24 * 60 * 60 * 1000

  it('stays active through a grace period after expiry', () => {
    expect(licenseActive(license, new Date('2026-12-31T00:00:00Z'))).toBe(true)
    expect(licenseActive(license, new Date(Date.parse(claims.exp) + (GRACE_DAYS - 1) * day))).toBe(true)
    expect(licenseActive(license, new Date(Date.parse(claims.exp) + (GRACE_DAYS + 1) * day))).toBe(false)
  })

  it('is inactive without a license', () => {
    expect(licenseActive(null)).toBe(false)
  })
})
