import { join } from "node:path";
import type { Sql } from "postgres";
import { applyMigrations } from "../db/apply-migrations";
import { CRM_MIGRATIONS_JOURNAL } from "./journal";

export const CRM_MIGRATIONS_FOLDER = join(
  import.meta.dir,
  "..",
  "..",
  "drizzle-crm",
);

export function applyCrmMigrations(client: Sql): Promise<void> {
  return applyMigrations(client, CRM_MIGRATIONS_FOLDER, CRM_MIGRATIONS_JOURNAL);
}
