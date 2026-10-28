UPDATE "crm"."contacts" SET "tags" = '{}' WHERE "tags" IS NULL;--> statement-breakpoint
ALTER TABLE "crm"."contacts" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "crm"."contacts" ALTER COLUMN "tags" SET NOT NULL;
