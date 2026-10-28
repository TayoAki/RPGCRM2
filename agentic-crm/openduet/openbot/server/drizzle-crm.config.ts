import { defineConfig } from "drizzle-kit";
import { CRM_MIGRATIONS_JOURNAL } from "./src/crm/journal";

// The CRM's tables (src/crm/schema.ts) keep their own migrations, apart from OpenDuet's in drizzle/.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/crm/schema.ts"],
  schemaFilter: ["crm"],
  out: "./drizzle-crm",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  migrations: {
    schema: CRM_MIGRATIONS_JOURNAL.migrationsSchema,
    table: CRM_MIGRATIONS_JOURNAL.migrationsTable,
  },
});
