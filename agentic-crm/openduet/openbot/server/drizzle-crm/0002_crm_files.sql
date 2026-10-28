CREATE TABLE "crm"."files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"sales_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."files" ADD CONSTRAINT "files_sales_id_sales_id_fk" FOREIGN KEY ("sales_id") REFERENCES "crm"."sales"("id") ON DELETE no action ON UPDATE no action;