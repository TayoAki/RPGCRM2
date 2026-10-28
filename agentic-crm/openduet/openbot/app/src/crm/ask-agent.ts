import type { CrmRecordRef } from "atomic-crm/embed";

const KIND: Record<CrmRecordRef["resource"], string> = {
  contacts: "contact",
  companies: "company",
  deals: "deal",
};

/** What the Bot is told about the record, outside the person's own words. */
export function askAgentContext(record: CrmRecordRef): string {
  const title = record.title.replace(/\s+/g, " ").trim().slice(0, 80);
  return `This is about the CRM ${KIND[record.resource]} “${title || "untitled"}” (${record.resource} id ${record.id}). Read it with the CRM tools before acting on it.`;
}
