import type { Catalog } from '..'
import type en from '../en/format'

export default {
  bytes: { one: '{count} octet', other: '{count} octets' },
  kb: 'Ko',
  mb: 'Mo',
  gb: 'Go',
  tb: 'To',
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  todayAt: 'Aujourd’hui, {time}',
  yesterdayAt: 'Hier, {time}',
  dateAt: '{date}, {time}',
} satisfies Catalog<typeof en>
