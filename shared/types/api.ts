import type { FileKind } from '../utils/search'

export type Role = 'owner' | 'reader'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}

export interface AccessPerson {
  kind: 'user' | 'invitation'
  label: string
  email: string
}

export interface AccessSummary {
  level: 'private' | 'shared' | 'public'
  people: AccessPerson[]
  userCount: number
  invitationCount: number
  hasLink: boolean
  inherited: boolean
}

export interface ResourceItem {
  id: string
  parentId: string | null
  type: 'file' | 'folder'
  kind: FileKind
  name: string
  extension: string | null
  mimeType: string | null
  size: number
  createdAt: string
  updatedAt: string
  thumbnailUrl: string | null
  starred?: boolean
  access?: AccessSummary
  lastExternalViewAt?: string | null
  ownerOpenedAt?: string | null
  deletedAt?: string | null
  canDownload: boolean
  location?: string
}

export interface Crumb {
  id: string | null
  name: string
}

export interface FolderListing {
  folder: ResourceItem | null
  breadcrumbs: Crumb[]
  items: ResourceItem[]
}

export interface AccessEntry {
  ruleId: string
  kind: 'user' | 'invitation' | 'link'
  label: string
  email: string | null
  status?: 'active' | 'pending' | 'disabled'
  invitationMode?: 'account' | 'link'
  allowDownload: boolean
  expiresAt: string | null
  inheritedFrom: Crumb | null
  createdAt: string
}

export interface LinkInfo {
  ruleId: string
  url: string
  allowDownload: boolean
  expiresAt: string | null
  createdAt: string
}

export interface ResourceAccess {
  resourceId: string
  inheritAccess: boolean
  parent: Crumb | null
  entries: AccessEntry[]
  link: LinkInfo | null
  inheritedLink: (LinkInfo & { inheritedFrom: Crumb }) | null
}

export interface ActivityStats {
  views: number
  visitors: number
  downloads: number
  lastViewAt: string | null
  lastViewBy: string | null
}

export type ActivityType = 'view' | 'download' | 'share_added' | 'share_removed' | 'share_updated' | 'link_created' | 'link_updated' | 'link_removed' | 'invite_accepted' | 'access_denied'

export interface ActivityEvent {
  id: number
  type: ActivityType
  actorKind: 'owner' | 'user' | 'invitation' | 'link'
  actorLabel: string
  targetLabel: string | null
  resource: { id: string, name: string, type: 'file' | 'folder', kind: FileKind } | null
  createdAt: string
}

export interface ResourceDetails {
  item: ResourceItem
  path: Crumb[]
  stats: ActivityStats | null
}

export interface PreviewInfo {
  kind: FileKind
  contentUrl: string
  downloadUrl: string | null
  frameUrl: string | null
}

export interface Person {
  id: string
  kind: 'user' | 'invitation'
  name: string | null
  email: string
  status: 'active' | 'disabled' | 'pending' | 'accepted' | 'revoked'
  invitationMode?: 'account' | 'link'
  shareCount: number
  lastSeenAt: string | null
  createdAt: string
}
