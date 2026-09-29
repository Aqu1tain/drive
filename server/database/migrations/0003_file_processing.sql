CREATE TABLE "resource_texts" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"words" "tsvector" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "preview_key" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "processed_checksum" text;--> statement-breakpoint
ALTER TABLE "resource_texts" ADD CONSTRAINT "resource_texts_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_texts_words_idx" ON "resource_texts" USING gin ("words");