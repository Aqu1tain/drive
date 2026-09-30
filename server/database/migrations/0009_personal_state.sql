CREATE TABLE "resource_opens" (
	"user_id" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_opens_user_id_resource_id_pk" PRIMARY KEY("user_id","resource_id")
);
--> statement-breakpoint
DROP INDEX "resources_starred_idx";--> statement-breakpoint
ALTER TABLE "resource_opens" ADD CONSTRAINT "resource_opens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_opens" ADD CONSTRAINT "resource_opens_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "resource_opens" ("user_id", "resource_id", "opened_at")
	SELECT "user"."id", "resources"."id", "resources"."owner_opened_at" FROM "resources" CROSS JOIN "user"
	WHERE "user"."role" = 'owner' AND "resources"."owner_opened_at" IS NOT NULL;--> statement-breakpoint
INSERT INTO "favorites" ("user_id", "resource_id")
	SELECT "user"."id", "resources"."id" FROM "resources" CROSS JOIN "user"
	WHERE "user"."role" = 'owner' AND "resources"."starred"
	ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "starred";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "owner_opened_at";