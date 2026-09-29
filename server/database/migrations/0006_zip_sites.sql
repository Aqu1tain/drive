CREATE TABLE "site_files" (
	"resource_id" uuid NOT NULL,
	"path" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	CONSTRAINT "site_files_resource_id_path_pk" PRIMARY KEY("resource_id","path")
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "site_checksum" text;--> statement-breakpoint
ALTER TABLE "site_files" ADD CONSTRAINT "site_files_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;