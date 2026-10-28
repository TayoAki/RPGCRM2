UPDATE "crm"."deals" SET "amount" = 0 WHERE "amount" IS NULL;--> statement-breakpoint
ALTER TABLE "crm"."deals" ALTER COLUMN "amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "crm"."deals" ALTER COLUMN "amount" SET NOT NULL;
