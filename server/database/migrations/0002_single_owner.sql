CREATE UNIQUE INDEX IF NOT EXISTS "user_single_owner_idx" ON "user" ("role") WHERE "role" = 'owner';
