import { sql } from 'drizzle-orm'
import type { ResourceItem } from '#shared/types/api'

const PREVIEWS_PER_FOLDER = 4

/**
 * Gives each folder the thumbnails of its latest images and videos, those placed right in it first, then those of its
 * subfolders, for a mosaic in the grid. Nothing below a trashed subfolder shows. Readers only get files whose access flows
 * down from the folder through every subfolder, which they can therefore open; the thumbnail route checks again anyway.
 */
export async function withFolderPreviews(viewer: Viewer, items: ResourceItem[]) {
  const folderIds = items.filter(item => item.type === 'folder').map(item => item.id)
  if (folderIds.length === 0) return items

  const { resources } = tables
  const isOwner = viewer.ctx.isOwner
  const rows = await useDB().execute<{ folder_id: string, id: string, checksum: string }>(sql`
    select folder_id, id, checksum from (
      select folder.id as folder_id, file.id, file.checksum,
        row_number() over (partition by folder.id order by file.parent_id = folder.id desc, file.updated_at desc) as rank
      from unnest(${uuidArray(folderIds)}) as folder(id)
      join ${resources} as file on file.ancestor_ids @> array[folder.id]
      where file.type = 'file' and file.deleted_at is null and file.thumbnail_status = 'ready'
        and file.checksum is not null and file.mime_type ~ '^(image|video)/'
        ${isOwner ? sql`` : sql`and file.inherit_access`}
        and not exists (
          select 1 from ${resources} as between_folder
          where between_folder.id = any(file.ancestor_ids) and between_folder.ancestor_ids @> array[folder.id]
            and (between_folder.deleted_at is not null ${isOwner ? sql`` : sql`or not between_folder.inherit_access`})
        )
    ) as latest
    where rank <= ${PREVIEWS_PER_FOLDER}
  `)
  const previews = Map.groupBy(rows, row => row.folder_id)
  return items.map((item) => {
    const found = previews.get(item.id)
    return found ? { ...item, previews: found.map(row => thumbnailUrl(row.id, row.checksum, viewer.apiBase)) } : item
  })
}
