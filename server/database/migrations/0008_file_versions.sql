CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"size" bigint NOT NULL,
	"checksum" text NOT NULL,
	"mime_type" text,
	"label" text,
	"saved_at" timestamp with time zone NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "versioning" boolean;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_versions_resource_idx" ON "file_versions" USING btree ("resource_id","saved_at");