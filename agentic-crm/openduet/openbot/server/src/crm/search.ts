import { type SQL, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import type { Access } from "./access";

export const SEARCH_RESOURCES = [
  "companies",
  "contacts",
  "deals",
  "tasks",
  "contact_notes",
  "deal_notes",
] as const;

export type SearchResource = (typeof SEARCH_RESOURCES)[number];

export type SearchResult = {
  resource: SearchResource;
  record_id: number;
  title: string | null;
  subtitle: string | null;
  contact_id: number | null;
  deal_id: number | null;
  date: string | null;
  content: string | null;
};

// Every word as a prefix, all of them required: "acme sal" finds "Acme Sales".
export function searchQuery(text: string): string | undefined {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 10);
  return words.length
    ? words.map((word) => `${word}:*`).join(" & ")
    : undefined;
}

const matches = (document: SQL, query: string) =>
  sql`to_tsvector('simple', ${document}) @@ to_tsquery('simple', ${query})`;

type Branch = {
  object: string;
  // Who owns a row, for a role that reaches only its own.
  owner: SQL;
  // Matched on every field, or only on the title when the role hides some of this object's fields.
  full: (where: SQL) => SQL;
  titleOnly: (where: SQL) => SQL;
};

/**
 * Atomic CRM's global search (supabase/schemas/08_search.sql), with Postgres full-text search over
 * the same fields and the same result shape. The newest matches first, at most `limit` per resource.
 * With `access`, only what the person's role lets them see: no object they can't read, only their own
 * records where that is their reach, and no hidden field matched or shown.
 */
export async function globalSearch(
  database: Database,
  text: string,
  resources: readonly SearchResource[],
  limit: number,
  access?: Access,
): Promise<SearchResult[]> {
  const query = searchQuery(text);
  if (!query || resources.length === 0) return [];

  const branches: Record<SearchResource, Branch> = {
    companies: {
      object: "companies",
      owner: sql`c.sales_id`,
      full: (
        where,
      ) => sql`(select 'companies', c.id, c.name, c.sector, null::bigint, null::bigint, c.created_at,
        concat_ws(' · ', c.sector, c.description, c.website, c.phone_number, c.zipcode, c.city, c.state_abbr)
      from crm.companies c
      where ${matches(sql`concat_ws(' ', c.name, c.sector, c.description, c.website, c.phone_number, c.zipcode, c.city, c.state_abbr)`, query)} and ${where}
      order by c.created_at desc limit ${limit})`,
      titleOnly: (
        where,
      ) => sql`(select 'companies', c.id, c.name, null, null::bigint, null::bigint, c.created_at, null
      from crm.companies c where ${matches(sql`c.name`, query)} and ${where}
      order by c.created_at desc limit ${limit})`,
    },
    contacts: {
      object: "contacts",
      owner: sql`co.sales_id`,
      full: (
        where,
      ) => sql`(select 'contacts', co.id, concat_ws(' ', co.first_name, co.last_name),
        (select cc.name from crm.companies cc where cc.id = co.company_id), co.id, null::bigint, co.first_seen,
        concat_ws(' · ', co.title, co.background,
          (select string_agg(e ->> 'email', ' ') from jsonb_array_elements(co.email_jsonb) e),
          (select string_agg(p ->> 'number', ' ') from jsonb_array_elements(co.phone_jsonb) p))
      from crm.contacts co
      where ${matches(sql`concat_ws(' ', co.first_name, co.last_name, co.title, co.background, co.email_jsonb::text, co.phone_jsonb::text)`, query)} and ${where}
      order by co.first_seen desc nulls last limit ${limit})`,
      titleOnly: (
        where,
      ) => sql`(select 'contacts', co.id, concat_ws(' ', co.first_name, co.last_name), null, co.id, null::bigint, co.first_seen, null
      from crm.contacts co where ${matches(sql`concat_ws(' ', co.first_name, co.last_name)`, query)} and ${where}
      order by co.first_seen desc nulls last limit ${limit})`,
    },
    deals: {
      object: "deals",
      owner: sql`d.sales_id`,
      full: (where) => sql`(select 'deals', d.id, d.name,
        (select dc.name from crm.companies dc where dc.id = d.company_id), null::bigint, d.id, d.created_at,
        concat_ws(' · ', array_to_string(d.categories, ' '), d.description)
      from crm.deals d
      where d.archived_at is null
        and ${matches(sql`concat_ws(' ', d.name, d.description, array_to_string(d.categories, ' '))`, query)} and ${where}
      order by d.created_at desc limit ${limit})`,
      titleOnly: (
        where,
      ) => sql`(select 'deals', d.id, d.name, null, null::bigint, d.id, d.created_at, null
      from crm.deals d where d.archived_at is null and ${matches(sql`d.name`, query)} and ${where}
      order by d.created_at desc limit ${limit})`,
    },
    tasks: {
      object: "tasks",
      owner: sql`t.sales_id`,
      full: (where) => sql`(select 'tasks', t.id, left(t.text, 200),
        (select concat_ws(' ', tc.first_name, tc.last_name) from crm.contacts tc where tc.id = t.contact_id),
        t.contact_id, null::bigint, t.created_at, concat_ws(' · ', t.text, t.type)
      from crm.tasks t
      where t.done_date is null and ${matches(sql`concat_ws(' ', t.text, t.type)`, query)} and ${where}
      order by t.created_at desc limit ${limit})`,
      titleOnly: (
        where,
      ) => sql`(select 'tasks', t.id, left(t.text, 200), null, t.contact_id, null::bigint, t.created_at, null
      from crm.tasks t where t.done_date is null and ${matches(sql`coalesce(t.text, '')`, query)} and ${where}
      order by t.created_at desc limit ${limit})`,
    },
    contact_notes: {
      object: "contacts",
      owner: sql`(select oc.sales_id from crm.contacts oc where oc.id = cn.contact_id)`,
      full: (where) => sql`(select 'contact_notes', cn.id, left(cn.text, 200),
        (select concat_ws(' ', nc.first_name, nc.last_name) from crm.contacts nc where nc.id = cn.contact_id),
        cn.contact_id, null::bigint, cn.date, cn.text
      from crm.contact_notes cn
      where ${matches(sql`coalesce(cn.text, '')`, query)} and ${where}
      order by cn.date desc nulls last limit ${limit})`,
      titleOnly: (
        where,
      ) => sql`(select 'contact_notes', cn.id, left(cn.text, 200), null, cn.contact_id, null::bigint, cn.date, cn.text
      from crm.contact_notes cn where ${matches(sql`coalesce(cn.text, '')`, query)} and ${where}
      order by cn.date desc nulls last limit ${limit})`,
    },
    deal_notes: {
      object: "deals",
      owner: sql`nd.sales_id`,
      full: (
        where,
      ) => sql`(select 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date, dn.text
      from crm.deal_notes dn join crm.deals nd on nd.id = dn.deal_id
      where nd.archived_at is null and ${matches(sql`coalesce(dn.text, '')`, query)} and ${where}
      order by dn.date desc nulls last limit ${limit})`,
      titleOnly: (
        where,
      ) => sql`(select 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date, dn.text
      from crm.deal_notes dn join crm.deals nd on nd.id = dn.deal_id
      where nd.archived_at is null and ${matches(sql`coalesce(dn.text, '')`, query)} and ${where}
      order by dn.date desc nulls last limit ${limit})`,
    },
  };

  const parts = resources.flatMap((name) => {
    const branch = branches[name];
    if (!access || access.full) return [branch.full(sql`true`)];
    const reach = access.reach(branch.object, "read");
    if (reach === "none") return [];
    const where =
      reach === "own" ? sql`${branch.owner} = ${access.salesId}` : sql`true`;
    return [
      access.hidden(branch.object).length
        ? branch.titleOnly(where)
        : branch.full(where),
    ];
  });
  if (parts.length === 0) return [];
  const union = sql.join(parts, sql` union all `);
  const rows = (await database.execute(
    sql`select * from (${union})
      as results(resource, record_id, title, subtitle, contact_id, deal_id, date, content)
      order by date desc nulls last`,
  )) as unknown as SearchResult[];
  // bigint arrives as text from the driver.
  return rows.map((row) => ({
    ...row,
    record_id: Number(row.record_id),
    contact_id: row.contact_id === null ? null : Number(row.contact_id),
    deal_id: row.deal_id === null ? null : Number(row.deal_id),
  }));
}
