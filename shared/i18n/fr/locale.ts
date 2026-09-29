import type { Catalog } from '..'
import type en from '../en/locale'

export default {
  en: 'English',
  fr: 'Français',
} satisfies Catalog<typeof en>
