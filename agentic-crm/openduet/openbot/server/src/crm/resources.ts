import {
  type Column,
  getTableColumns,
  getViewSelectedFields,
  is,
} from "drizzle-orm";
import { type PgTable, PgView } from "drizzle-orm/pg-core";
import type { Columns } from "./filters";
import {
  activityLog,
  companies,
  companiesSummary,
  configuration,
  contactNotes,
  contacts,
  contactsSummary,
  dealNotes,
  dealStageHistory,
  deals,
  emails,
  meetings,
  proposals,
  sales,
  tags,
  tasks,
} from "./schema";

export type CrmResource = {
  source: PgTable | PgView;
  columns: Columns;
  table?: PgTable;
  writable: Set<string>;
  // Only an admin may change it. Everybody signed in may read every resource, as in Atomic CRM.
  adminOnly?: boolean;
  // New records belong to the person creating them unless the form says otherwise.
  ownedBySales?: boolean;
};

// Kept by the database, never set by a write.
const MANAGED_COLUMNS = new Set(["id", "updated_at", "token"]);

function readable(source: PgTable | PgView): Columns {
  return (
    is(source, PgView) ? getViewSelectedFields(source) : getTableColumns(source)
  ) as Columns;
}

function resource(
  source: PgTable | PgView,
  table: PgTable | undefined,
  options: Pick<CrmResource, "adminOnly" | "ownedBySales"> = {},
): CrmResource {
  const writable = table
    ? Object.entries(getTableColumns(table))
        .filter(
          ([name, column]) =>
            !MANAGED_COLUMNS.has(name) && !(column as Column).generated,
        )
        .map(([name]) => name)
    : [];
  return {
    source,
    columns: readable(source),
    ...(table ? { table } : {}),
    writable: new Set(writable),
    ...options,
  };
}

const owned = { ownedBySales: true };
const companyResource = resource(companiesSummary, companies, owned);
const contactResource = resource(contactsSummary, contacts, owned);

export const CRM_RESOURCES: Record<string, CrmResource> = {
  companies: companyResource,
  companies_summary: companyResource,
  contacts: contactResource,
  contacts_summary: contactResource,
  contact_notes: resource(contactNotes, contactNotes, owned),
  deals: resource(deals, deals, owned),
  deal_notes: resource(dealNotes, dealNotes, owned),
  tasks: resource(tasks, tasks, owned),
  tags: resource(tags, tags),
  meetings: resource(meetings, meetings, owned),
  proposals: resource(proposals, proposals, owned),
  // Written by the mail sender (email.ts), which checks the mailbox and the recipient.
  emails: resource(emails, undefined),
  deal_stage_history: resource(dealStageHistory, undefined),
  sales: resource(sales, sales, { adminOnly: true }),
  configuration: resource(configuration, configuration, { adminOnly: true }),
  activity_log: resource(activityLog, undefined),
};
