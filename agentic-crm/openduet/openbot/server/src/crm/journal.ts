import {
  MIGRATIONS_JOURNAL,
  type MigrationsJournal,
} from "../db/apply-migrations";

// Its own ledger beside OpenDuet's, so the two migration sequences never interleave.
export const CRM_MIGRATIONS_JOURNAL: MigrationsJournal = {
  ...MIGRATIONS_JOURNAL,
  migrationsTable: [MIGRATIONS_JOURNAL.migrationsTable, "crm"].join("_"),
};
