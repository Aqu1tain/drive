import { createPublicKey, verify } from 'node:crypto'

/** Keys are signed offline with the matching private key, which never leaves the licensor: nothing is checked over the network. */
const LICENSOR_KEY = createPublicKey(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAYs1821dmYLV7FjZ6Vl3qUHX5mKtVupxGtWG3m8d39GQ=
-----END PUBLIC KEY-----`)

/** After expiry, members keep everything they had: only adding people and roles waits for a renewal. */
export const GRACE_DAYS = 14

export interface License {
  id: string
  organization: string
  seats: number
  expiresAt: Date
}

interface Claims {
  v: 1
  id: string
  org: string
  seats: number
  exp: string
}

const isClaims = (value: unknown): value is Claims => {
  const claims = value as Claims
  return claims?.v === 1 && typeof claims.id === 'string' && typeof claims.org === 'string'
    && Number.isInteger(claims.seats) && claims.seats > 0 && !Number.isNaN(Date.parse(claims.exp))
}

/** A key is `payload.signature`, both in base64url; anything malformed or not signed by the licensor is no license at all. */
export function readLicense(key: string, publicKey = LICENSOR_KEY): License | null {
  const [payload, signature, extra] = key.trim().split('.')
  if (!payload || !signature || extra !== undefined) return null
  try {
    if (!verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64url'))) return null
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!isClaims(claims)) return null
    return { id: claims.id, organization: claims.org, seats: claims.seats, expiresAt: new Date(claims.exp) }
  }
  catch {
    return null
  }
}

export function licenseActive(license: License | null, now = new Date()) {
  return !!license && now.getTime() < license.expiresAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000
}
