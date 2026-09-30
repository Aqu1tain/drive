// Issues a Drive for Organizations license key. Only the licensor can run it: it needs the private signing key.
// node scripts/issue-license.mjs --org "Acme" --seats 10 --days 365
import { createPrivateKey, randomUUID, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    org: { type: 'string' },
    seats: { type: 'string' },
    days: { type: 'string', default: '365' },
    key: { type: 'string', default: process.env.DRIVE_LICENSE_PRIVATE_KEY ?? join(homedir(), '.config/drive-license/private.pem') },
  },
})

const seats = Number(values.seats)
const days = Number(values.days)
if (!values.org || !Number.isInteger(seats) || seats < 1 || !Number.isInteger(days) || days < 1) {
  console.error('Usage: node scripts/issue-license.mjs --org "Organization name" --seats 10 [--days 365] [--key private.pem]')
  process.exit(1)
}

const claims = { v: 1, id: randomUUID(), org: values.org, seats, exp: new Date(Date.now() + days * 86_400_000).toISOString() }
const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
const signature = sign(null, Buffer.from(payload), createPrivateKey(readFileSync(values.key))).toString('base64url')
console.log(`${payload}.${signature}`)
