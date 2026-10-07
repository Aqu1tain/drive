-- E-books become their own kind: derive a cover, a reader page and search text for those already stored.
UPDATE "resources" SET "processed_checksum" = NULL, "thumbnail_status" = 'pending' WHERE "mime_type" = 'application/epub+zip' AND "type" = 'file';
