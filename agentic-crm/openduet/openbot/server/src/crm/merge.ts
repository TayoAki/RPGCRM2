import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { EXTENSIBLE } from "./metadata";
import { type CrmActor, type CrmRecords, originOf } from "./records";
import { CrmRefusal } from "./refusal";
import {
  contactNotes,
  contacts,
  emails,
  meetings,
  proposals,
  records as customRecords,
  tasks,
} from "./schema";

type Contact = typeof contacts.$inferSelect;
type Entry = Record<string, unknown>;

const LIFECYCLE = ["lead", "prospect", "client", "former-client"];

function unique(entries: Entry[], key: string): Entry[] {
  const seen = new Map<string, Entry>();
  for (const entry of entries) {
    const value = String(entry[key] ?? "")
      .trim()
      .toLowerCase();
    if (value && !seen.has(value)) seen.set(value, entry);
  }
  return [...seen.values()];
}

const latest = (one: string | null, other: string | null) =>
  !one ? other : !other ? one : one > other ? one : other;
const earliest = (one: string | null, other: string | null) =>
  !one ? other : !other ? one : one < other ? one : other;

// The kept contact's values win; the other fills what it lacks, and lists are combined.
function mergedValues(winner: Contact, loser: Contact) {
  const avatar = winner.avatar as { src?: string } | null;
  return {
    first_name: winner.first_name ?? loser.first_name,
    last_name: winner.last_name ?? loser.last_name,
    gender: winner.gender ?? loser.gender,
    title: winner.title ?? loser.title,
    company_id: winner.company_id ?? loser.company_id,
    background: winner.background ?? loser.background,
    linkedin_url: winner.linkedin_url || loser.linkedin_url,
    avatar: avatar?.src ? winner.avatar : loser.avatar,
    has_newsletter: winner.has_newsletter ?? loser.has_newsletter,
    status: winner.status ?? loser.status,
    sales_id: winner.sales_id ?? loser.sales_id,
    lead_source: winner.lead_source ?? loser.lead_source,
    lead_source_detail: winner.lead_source_detail ?? loser.lead_source_detail,
    lifecycle_stage:
      LIFECYCLE.indexOf(loser.lifecycle_stage) >
      LIFECYCLE.indexOf(winner.lifecycle_stage)
        ? loser.lifecycle_stage
        : winner.lifecycle_stage,
    first_seen: earliest(winner.first_seen, loser.first_seen),
    last_seen: latest(winner.last_seen, loser.last_seen),
    email_jsonb: unique(
      [
        ...((winner.email_jsonb as Entry[] | null) ?? []),
        ...((loser.email_jsonb as Entry[] | null) ?? []),
      ],
      "email",
    ),
    phone_jsonb: unique(
      [
        ...((winner.phone_jsonb as Entry[] | null) ?? []),
        ...((loser.phone_jsonb as Entry[] | null) ?? []),
      ],
      "number",
    ),
    tags: [...new Set([...(winner.tags ?? []), ...(loser.tags ?? [])])],
    custom_fields: {
      ...((loser.custom_fields as Entry | null) ?? {}),
      ...((winner.custom_fields as Entry | null) ?? {}),
    },
  };
}

/**
 * Merges a duplicate contact into the one kept: its notes, tasks, meetings, proposals, email, deals and
 * the custom records that link to it move over, its details fill the kept contact's gaps, and it is
 * deleted. One transaction, so a failure leaves both contacts as they were.
 */
export async function mergeContacts(
  database: Database,
  records: CrmRecords,
  actor: CrmActor,
  keepId: number,
  duplicateId: number,
) {
  if (keepId === duplicateId) {
    throw new CrmRefusal("Pick two different contacts.", 400);
  }
  if (
    !(await records.reaches(actor, "contacts", keepId, "update")) ||
    !(await records.reaches(actor, "contacts", duplicateId, "delete"))
  ) {
    throw new CrmRefusal(
      "Your role doesn't let you change both of these contacts.",
      403,
    );
  }
  const relations = (await records.metadata.load()).fields.filter(
    (field) =>
      field.type === "relation" &&
      field.options.target === "contacts" &&
      !field.standard,
  );

  await database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('crm.actor', ${originOf(actor)}, true)`,
    );
    const [winner] = await transaction
      .select()
      .from(contacts)
      .where(eq(contacts.id, keepId))
      .for("update");
    const [loser] = await transaction
      .select()
      .from(contacts)
      .where(eq(contacts.id, duplicateId))
      .for("update");
    if (!winner || !loser) throw new CrmRefusal("Not found.", 404);

    for (const table of [contactNotes, tasks, meetings, proposals, emails]) {
      await transaction
        .update(table)
        .set({ contact_id: keepId })
        .where(eq(table.contact_id, duplicateId));
    }
    await transaction.execute(sql`
      update crm.deals
      set contact_ids = (
        select array_agg(distinct id order by id)
        from unnest(array_replace(contact_ids, ${duplicateId}::bigint, ${keepId}::bigint)) as id
      )
      where ${duplicateId}::bigint = any(contact_ids)`);
    for (const field of relations) {
      if (EXTENSIBLE.has(field.object)) {
        await transaction.execute(sql`
          update ${sql.identifier("crm")}.${sql.identifier(field.object)}
          set custom_fields = jsonb_set(custom_fields, ${`{${field.name}}`}::text[], to_jsonb(${keepId}::bigint))
          where (custom_fields ->> ${field.name})::bigint = ${duplicateId}::bigint`);
      } else {
        await transaction
          .update(customRecords)
          .set({
            data: sql`jsonb_set(${customRecords.data}, ${`{${field.name}}`}::text[], to_jsonb(${keepId}::bigint))`,
          })
          .where(
            and(
              eq(customRecords.object, field.object),
              sql`(${customRecords.data} ->> ${field.name})::bigint = ${duplicateId}::bigint`,
            ),
          );
      }
    }
    await transaction
      .update(contacts)
      .set(mergedValues(winner, loser))
      .where(eq(contacts.id, keepId));
    await transaction.delete(contacts).where(eq(contacts.id, duplicateId));
  });

  return records.get(actor, "contacts", keepId);
}
