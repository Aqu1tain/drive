import type { FileKind } from '../utils/search'

export type Role = 'owner' | 'reader'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  twoFactorEnabled?: boolean
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
  /** Thumbnails of the latest images in a folder. */
  previews?: string[]
  starred?: boolean
  tagIds?: string[]
  /** Folders listed for the owner: whether files replaced inside keep their earlier versions. */
  versioning?: boolean
  allowScripts?: boolean
  access?: AccessSummary
  lastExternalViewAt?: string | null
  ownerOpenedAt?: string | null
  deletedAt?: string | null
  canDownload: boolean
  location?: string
}

export interface TagInfo {
  id: string
  name: string
  color: string
  count: number
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
  status: 'active' | 'pending' | 'disabled' | 'expired' | 'revoked'
  invitationMode: 'account' | 'link' | null
  allowDownload: boolean
  expiresAt: string | null
  inheritedFrom: Crumb | null
  createdAt: string
  inviteUrl: string | null
}

export interface LinkInfo {
  ruleId: string
  url: string
  publishedUrl: string | null
  allowDownload: boolean
  expiresAt: string | null
  createdAt: string
}

export interface ResourceAccess {
  resourceId: string
  resourceName: string
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

export interface VersioningState {
  enabled: boolean
  /** The folder whose choice applies, null when no folder decided (off). */
  source: Crumb | null
}

export interface FileVersionItem {
  id: string
  size: number
  mimeType: string | null
  label: string | null
  savedAt: string
  replacedAt: string
  contentUrl: string
  downloadUrl: string
}

export interface VersionHistory {
  versioning: VersioningState
  current: { size: number, mimeType: string | null, savedAt: string }
  versions: FileVersionItem[]
  totalSize: number
}

export interface ResourceDetails {
  item: ResourceItem
  path: Crumb[]
  stats: ActivityStats | null
  /** For the owner: whether earlier versions are kept, for a folder's files or for this file. */
  versioning?: VersioningState
}

export interface PreviewInfo {
  item: ResourceItem
  kind: FileKind
  scripts: boolean
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
