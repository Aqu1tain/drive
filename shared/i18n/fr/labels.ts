import type { Catalog } from '..'
import type en from '../en/labels'

export default {
  sharedWithMe: 'Partagé avec moi',
  sharedWithYou: 'Partagé avec vous',
  theOwner: 'Le propriétaire',
  publicLink: 'Lien public',
  access: 'Accès',
  inheritRestored: 'Accès hérités rétablis',
  inheritRemoved: 'Accès hérités retirés',
  aiAssistant: 'assistant IA',
  viaAssistant: '{name} via {app}',
} satisfies Catalog<typeof en>
