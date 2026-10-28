CREATE TABLE "crm"."installs" (
	"name" text PRIMARY KEY NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
