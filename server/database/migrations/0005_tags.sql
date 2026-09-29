CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_lower" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_lower_unique" UNIQUE("name_lower")
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "tag_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
CREATE INDEX "resources_tags_idx" ON "resources" USING gin ("tag_ids");