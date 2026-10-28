ALTER TABLE "crm"."contacts" ALTER COLUMN "first_seen" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "crm"."contacts" ALTER COLUMN "last_seen" SET DEFAULT now();