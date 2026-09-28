import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'

const deriveKey = (secret: string, purpose: string) =>
  Buffer.from(hkdfSync('sha256', secret, 'drive', purpose, 32))

export const generateToken = (bytes = 24) => randomBytes(bytes).toString('base64url')

/** Tokens carry at least 192 bits of entropy, so a fast hash is enough for lookups. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function sealToken(token: string, secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, 'token-seal'), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

export function openToken(sealed: string, secret: string) {
  const raw = Buffer.from(sealed, 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret, 'token-seal'), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}

export function signPayload(payload: object, secret: string, purpose: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', deriveKey(secret, purpose)).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyPayload<T>(token: string, secret: string, purpose: string): T | null {
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = createHmac('sha256', deriveKey(secret, purpose)).update(body).digest()
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  }
  catch {
    return null
  }
}

/** Keeps a /24 (IPv4) or /48 (IPv6) prefix, then hashes it: enough to spot distinct networks, not to identify a person. */
export function hashIp(ip: string, secret: string) {
  const prefix = ip.includes(':')
    ? ip.split(':').slice(0, 3).join(':')
    : ip.split('.').slice(0, 3).join('.')
  return createHmac('sha256', deriveKey(secret, 'ip')).update(prefix).digest('hex').slice(0, 16)
}
