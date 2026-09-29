import { sql } from 'drizzle-orm'
import { bigint, bigserial, boolean, customType, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { user } from './auth'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}

export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: uuid('parent_id').references((): AnyPgColumn => resources.id, { onDelete: 'cascade' }),
  ancestorIds: uuid('ancestor_ids').array().notNull().default(sql`'{}'::uuid[]`),
  type: text('type', { enum: ['file', 'folder'] }).notNull(),
  name: text('name').notNull(),
  nameLower: text('name_lower').notNull(),
  searchKey: text('search_key').notNull(),
  extension: text('extension'),
  mimeType: text('mime_type'),
  size: bigint('size', { mode: 'number' }).notNull().default(0),
  storageKey: text('storage_key'),
  checksum: text('checksum'),
  thumbnailKey: text('thumbnail_key'),
  thumbnailStatus: text('thumbnail_status', { enum: ['none', 'pending', 'ready', 'failed'] }).notNull().default('none'),
  previewKey: text('preview_key'),
  siteChecksum: text('site_checksum'),
  processedChecksum: text('processed_checksum'),
  width: integer('width'),
  height: integer('height'),
  starred: boolean('starred').notNull().default(false),
  tagIds: uuid('tag_ids').array().notNull().default(sql`'{}'::uuid[]`),
  inheritAccess: boolean('inherit_access').notNull().default(true),
  allowScripts: boolean('allow_scripts').notNull().default(false),
  /** Folders only: true keeps earlier versions of the files inside, false stops, null follows the parent folder. */
  versioning: boolean('versioning'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ownerOpenedAt: timestamp('owner_opened_at', { withTimezone: true }),
  lastExternalViewAt: timestamp('last_external_view_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('resources_parent_idx').on(t.parentId, t.deletedAt),
  index('resources_ancestors_idx').using('gin', t.ancestorIds),
  index('resources_search_idx').using('gin', sql`${t.searchKey} gin_trgm_ops`),
  index('resources_deleted_idx').on(t.deletedAt),
  index('resources_starred_idx').on(t.starred),
  index('resources_tags_idx').using('gin', t.tagIds),
  index('resources_recent_idx').on(t.updatedAt),
  uniqueIndex('resources_unique_name_idx')
    .on(sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`, t.nameLower)
    .where(sql`${t.deletedAt} is null`),
])

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

/** Words extracted from a file, kept apart so that listings never load them. */
export const resourceTexts = pgTable('resource_texts', {
  resourceId: uuid('resource_id').primaryKey().references(() => resources.id, { onDelete: 'cascade' }),
  words: tsvector('words').notNull(),
}, t => [
  index('resource_texts_words_idx').using('gin', t.words),
])

/** Earlier contents of a file, kept when it is replaced in a folder with version history, or when a version is restored. */
export const fileVersions = pgTable('file_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  resourceId: uuid('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  checksum: text('checksum').notNull(),
  mimeType: text('mime_type'),
  label: text('label'),
  savedAt: timestamp('saved_at', { withTimezone: true }).notNull(),
  replacedAt: timestamp('replaced_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('file_versions_resource_idx').on(t.resourceId, t.savedAt),
])

/** Files of a static site uploaded as a zip, extracted once so that each one is served straight from storage. */
export const siteFiles = pgTable('site_files', {
  resourceId: uuid('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
}, t => [
  primaryKey({ columns: [t.resourceId, t.path] }),
])

/** The owner's labels; resources point to them through `tag_ids`, so listings need no extra query. */
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nameLower: text('name_lower').notNull().unique(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Readers' own favorites: the owner's stay a column on resources, since there is only one owner. */
export const favorites = pgTable('favorites', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.userId, t.resourceId] }),
])

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name'),
  mode: text('mode', { enum: ['account', 'link'] }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  tokenSealed: text('token_sealed').notNull(),
  status: text('status', { enum: ['pending', 'accepted', 'revoked'] }).notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  acceptedByUserId: text('accepted_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  ...timestamps,
}, t => [
  index('invitations_email_idx').on(t.email),
])

export const accessRules = pgTable('access_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  resourceId: uuid('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['user', 'invitation', 'link'] }).notNull(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').unique(),
  tokenSealed: text('token_sealed'),
  allowDownload: boolean('allow_download').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  ...timestamps,
}, t => [
  index('access_rules_resource_idx').on(t.resourceId),
  index('access_rules_user_idx').on(t.userId),
  index('access_rules_invitation_idx').on(t.invitationId),
  uniqueIndex('access_rules_user_unique').on(t.resourceId, t.userId).where(sql`${t.kind} = 'user'`),
  uniqueIndex('access_rules_invitation_unique').on(t.resourceId, t.invitationId).where(sql`${t.kind} = 'invitation'`),
  uniqueIndex('access_rules_link_unique').on(t.resourceId).where(sql`${t.kind} = 'link'`),
])

export const accessEvents = pgTable('access_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['view', 'download', 'share_added', 'share_removed', 'share_updated', 'link_created', 'link_updated', 'link_removed', 'invite_accepted', 'access_denied'],
  }).notNull(),
  actorKind: text('actor_kind', { enum: ['owner', 'user', 'invitation', 'link'] }).notNull(),
  actorLabel: text('actor_label').notNull(),
  targetLabel: text('target_label'),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'set null' }),
  accessRuleId: uuid('access_rule_id').references(() => accessRules.id, { onDelete: 'set null' }),
  visitorId: text('visitor_id'),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('access_events_resource_idx').on(t.resourceId, t.createdAt),
  index('access_events_created_idx').on(t.createdAt),
  index('access_events_user_idx').on(t.userId, t.createdAt),
])

export type Resource = typeof resources.$inferSelect
export type AccessRule = typeof accessRules.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type Tag = typeof tags.$inferSelect
export type FileVersion = typeof fileVersions.$inferSelect
export type AccessEvent = typeof accessEvents.$inferSelect
