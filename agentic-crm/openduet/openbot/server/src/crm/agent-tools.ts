import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "../auth/guards";
import type { OpenBotRole } from "../auth/roles";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import type { McpCallResult, McpTool } from "../plugins/mcp";
import { MAX_RESULT_CHARS } from "../plugins/mcp";
import { CrmQueryError } from "./filters";
import {
  type CrmRecords,
  CrmRefusal,
  type CrmRow,
  createCrmRecords,
} from "./records";
import { CRM_RESOURCES } from "./resources";
import {
  companiesSummary,
  contactNotes,
  contactsSummary,
  dealNotes,
  deals,
  tasks,
} from "./schema";
import { globalSearch, SEARCH_RESOURCES, type SearchResource } from "./search";

/**
 * The CRM's tools for Bots, as the builtin transport of the "crm" catalogue entry (like Routines).
 *
 * The plugin store grants, gates and audits every call before it gets here, so a write has already
 * been approved by the person. Whose CRM user a call acts as comes from the connection, never from
 * the arguments, and every read and write goes through the same rules as the CRM's screens
 * (records.ts).
 */

export const CRM_WRITE_TOOLS = ["create_record", "update_record"] as const;

const READABLE = [
  "contacts",
  "companies",
  "deals",
  "tasks",
  "contact_notes",
  "deal_notes",
  "meetings",
  "proposals",
  "tags",
  "emails",
  "deal_stage_history",
] as const;
const READ_ONLY = new Set<string>(["tags", "emails", "deal_stage_history"]);
const WRITABLE = READABLE.filter((name) => !READ_ONLY.has(name));
const MAX_ROWS = 50;
// Unread by a model, or held as files: the rows are clearer without them.
const DROPPED_FIELDS = new Set(["avatar", "logo", "email_fts", "phone_fts"]);
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
]);

const RECORD_SHAPES = [
  "Fields by resource (send only the ones you mean to set):",
  '- contacts: first_name, last_name, title, company_id, status ("cold", "warm", "hot" or "in-contract"), lifecycle_stage ("lead", "prospect", "client" or "former-client"), lead_source, lead_source_detail, background, linkedin_url, email_jsonb as [{"email": "ada@acme.com", "type": "Work"}], phone_jsonb as [{"number": "+1 555 0100", "type": "Work"}], tags (tag ids), custom_fields (object).',
  "- companies: name, sector, website, phone_number, address, city, zipcode, country, description, lifecycle_stage, lead_source, custom_fields.",
  '- deals: name, company_id, contact_ids, stage ("opportunity", "proposal-sent", "in-negociation", "won", "lost" or "delayed" unless the CRM was set up otherwise), amount (whole number), expected_closing_date (YYYY-MM-DD), description, lead_source, custom_fields.',
  '- meetings: title, contact_id, deal_id, company_id, start_at and end_at (ISO 8601), location, status ("scheduled", "completed", "no_show" or "canceled"), outcome, outcome_notes.',
  "- proposals: deal_id, contact_id, title, body (Markdown), amount, valid_until (YYYY-MM-DD). Sending one is the person's to do from the deal.",
  "- tasks: contact_id, text, type (such as email, call or meeting), due_date (ISO 8601), done_date.",
  "- contact_notes: contact_id, text, status. deal_notes: deal_id, text.",
].join("\n");

const resourceProperty = (names: readonly string[]) => ({
  type: "string",
  enum: [...names],
  description: "Which kind of record.",
});

const TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "search",
    description:
      "Search the CRM by words: contacts, companies, deals, open tasks and notes. Returns each match's resource, id and title. Use it to find a record before reading or changing it.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for." },
        resources: {
          type: "array",
          items: { type: "string", enum: [...SEARCH_RESOURCES] },
          description: "Only these kinds of record. Omit for all.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "find_contact",
    description:
      "Find the CRM contacts with an email address, and the companies whose website matches its domain. Use it to tell who an email is from. When you take care of an email from a contact, offer to log it on them as a note; when nobody matches and the sender looks like a customer or a prospect, offer to add them as a contact.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "The email address." },
      },
      required: ["email"],
    },
  },
  {
    name: "list_records",
    description: [
      "List CRM records of one kind, filtered and sorted, at most 50.",
      'A filter is an object of fields: {"status": "hot"} matches exactly, and an operator after @ compares:',
      '{"due_date@lt": "2026-11-01"}, {"done_date@is": null}, {"name@ilike": "acme"}, {"contact_id@in": "(4,7)"}, {"tags@cs": "{3}"}.',
      'For example, a contact\'s open tasks: resource "tasks", filter {"contact_id": 4, "done_date@is": null}.',
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        resource: resourceProperty(READABLE),
        filter: { type: "object", description: "Fields to match." },
        sort: { type: "string", description: "A field to sort by." },
        order: { type: "string", enum: ["ASC", "DESC"] },
        limit: { type: "number", description: "At most 50. Defaults to 20." },
      },
      required: ["resource"],
    },
  },
  {
    name: "get_record",
    description:
      "Read one CRM record by id. A contact comes with its recent notes and open tasks, a company with its contacts and deals, and a deal with its recent notes and contacts.",
    inputSchema: {
      type: "object",
      properties: {
        resource: resourceProperty(READABLE),
        id: { type: "number" },
      },
      required: ["resource", "id"],
    },
  },
  {
    name: "create_record",
    description: `Add a record to the CRM, such as a contact, a note on a contact or a task. The person approves it first. New records belong to the person.\n\n${RECORD_SHAPES}`,
    inputSchema: {
      type: "object",
      properties: {
        resource: resourceProperty(WRITABLE),
        values: { type: "object", description: "The record's fields." },
      },
      required: ["resource", "values"],
    },
  },
  {
    name: "update_record",
    description: `Change fields of one CRM record. The person approves it first. Only the fields given change.\n\n${RECORD_SHAPES}`,
    inputSchema: {
      type: "object",
      properties: {
        resource: resourceProperty(WRITABLE),
        id: { type: "number" },
        values: { type: "object", description: "The fields to change." },
      },
      required: ["resource", "id", "values"],
    },
  },
]);

export type CrmToolDeps = {
  database: Database;
  roleOf: (userId: string) => Promise<OpenBotRole>;
};

let installed: { deps: CrmToolDeps; records: CrmRecords } | null = null;

/** Hands this module the database once, at boot, as `useRoutineTools` does for Routines. */
export function useCrmTools(deps: CrmToolDeps | null): void {
  installed = deps ? { deps, records: createCrmRecords(deps.database) } : null;
}

export async function listTools(): Promise<McpTool[]> {
  return TOOLS.map((tool) => ({ ...tool }));
}

export const listNeedsCredential = false;

type Connection = {
  url: string;
  token?: string;
  actorId?: string;
  botId?: string;
};
type Args = Record<string, unknown>;

const failure = (text: string): McpCallResult => ({
  text,
  isError: true,
  truncated: false,
});

function asResult(value: unknown): McpCallResult {
  const text = JSON.stringify(value);
  return text.length <= MAX_RESULT_CHARS
    ? { text, isError: false, truncated: false }
    : {
        text: `${text.slice(0, MAX_RESULT_CHARS)}\n\n[truncated: ask for fewer records]`,
        isError: false,
        truncated: true,
      };
}

const isObject = (value: unknown): value is Args =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const slim = (row: CrmRow | undefined) =>
  row &&
  Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !DROPPED_FIELDS.has(key))
      .map(([key, value]) =>
        key === "attachments" && Array.isArray(value)
          ? [key, value.map((file) => (file as Args)?.title)]
          : [key, value],
      ),
  );

const oneOf = <TName extends string>(names: readonly TName[], value: unknown) =>
  names.find((name) => name === value);

async function actorOf(
  deps: CrmToolDeps,
  userId: string,
): Promise<AuthenticatedActor | null> {
  const [user] = await deps.database
    .select({ email: users.email, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;
  return { id: userId, ...user, role: await deps.roleOf(userId) };
}

async function related(database: Database, resource: string, id: number) {
  if (resource === "contacts") {
    const [notes, openTasks] = await Promise.all([
      database
        .select()
        .from(contactNotes)
        .where(eq(contactNotes.contact_id, id))
        .orderBy(desc(contactNotes.date))
        .limit(10),
      database
        .select()
        .from(tasks)
        .where(and(eq(tasks.contact_id, id), isNull(tasks.done_date))),
    ]);
    return { recent_notes: notes.map(slim), open_tasks: openTasks };
  }
  if (resource === "companies") {
    const [people, companyDeals] = await Promise.all([
      database
        .select({
          id: contactsSummary.id,
          first_name: contactsSummary.first_name,
          last_name: contactsSummary.last_name,
          title: contactsSummary.title,
          status: contactsSummary.status,
        })
        .from(contactsSummary)
        .where(eq(contactsSummary.company_id, id))
        .limit(MAX_ROWS),
      database
        .select({ id: deals.id, name: deals.name, stage: deals.stage })
        .from(deals)
        .where(eq(deals.company_id, id))
        .limit(MAX_ROWS),
    ]);
    return { contacts: people, deals: companyDeals };
  }
  if (resource === "deals") {
    const [notes, [deal]] = await Promise.all([
      database
        .select()
        .from(dealNotes)
        .where(eq(dealNotes.deal_id, id))
        .orderBy(desc(dealNotes.date))
        .limit(10),
      database
        .select({ contact_ids: deals.contact_ids })
        .from(deals)
        .where(eq(deals.id, id)),
    ]);
    const contactIds = deal?.contact_ids ?? [];
    const people = contactIds.length
      ? await database
          .select({
            id: contactsSummary.id,
            first_name: contactsSummary.first_name,
            last_name: contactsSummary.last_name,
          })
          .from(contactsSummary)
          .where(inArray(contactsSummary.id, contactIds))
      : [];
    return { recent_notes: notes.map(slim), contacts: people };
  }
  return {};
}

async function findContact(database: Database, email: string) {
  const address = email.trim().toLowerCase();
  const domain = address.split("@")[1] ?? "";
  const [people, companies] = await Promise.all([
    database
      .select()
      .from(contactsSummary)
      .where(
        sql`${contactsSummary.email_jsonb} @> jsonb_build_array(jsonb_build_object('email', ${address}::text))`,
      )
      .limit(10),
    domain && !FREE_MAIL.has(domain)
      ? database
          .select({
            id: companiesSummary.id,
            name: companiesSummary.name,
            website: companiesSummary.website,
          })
          .from(companiesSummary)
          .where(
            ilike(
              companiesSummary.website,
              `%${domain.replace(/[\\%_]/g, "\\$&")}%`,
            ),
          )
          .limit(5)
      : [],
  ]);
  return { contacts: people.map(slim), companies };
}

function unknownFields(resource: string, values: Args): string | null {
  const writable = CRM_RESOURCES[resource]?.writable ?? new Set<string>();
  const unknown = Object.keys(values).filter((key) => !writable.has(key));
  return unknown.length
    ? `${resource} has no field ${unknown.join(", ")}. Its fields are ${[...writable].join(", ")}.`
    : null;
}

async function run(
  deps: CrmToolDeps,
  records: CrmRecords,
  actor: AuthenticatedActor,
  toolName: string,
  args: Args,
): Promise<McpCallResult> {
  const id = typeof args.id === "number" ? args.id : Number(args.id);
  const values = isObject(args.values) ? args.values : null;

  switch (toolName) {
    case "search": {
      const query = typeof args.query === "string" ? args.query : "";
      const wanted = Array.isArray(args.resources)
        ? args.resources.filter((name): name is SearchResource =>
            (SEARCH_RESOURCES as readonly string[]).includes(String(name)),
          )
        : [];
      return asResult(
        await globalSearch(
          deps.database,
          query,
          wanted.length ? wanted : SEARCH_RESOURCES,
          20,
        ),
      );
    }
    case "find_contact":
      return typeof args.email === "string" && args.email.includes("@")
        ? asResult(await findContact(deps.database, args.email))
        : failure("Give the email address to look for.");
    case "list_records": {
      const resource = oneOf(READABLE, args.resource);
      if (!resource)
        return failure(`resource is one of ${READABLE.join(", ")}.`);
      const limit = Math.min(MAX_ROWS, Math.max(1, Number(args.limit) || 20));
      const { data, total } = await records.list(resource, {
        filter: isObject(args.filter) ? args.filter : {},
        sort: typeof args.sort === "string" ? args.sort : null,
        order: args.order === "DESC" ? "DESC" : "ASC",
        perPage: limit,
      });
      return asResult({ total, records: data.map(slim) });
    }
    case "get_record": {
      const resource = oneOf(READABLE, args.resource);
      if (!resource)
        return failure(`resource is one of ${READABLE.join(", ")}.`);
      if (!Number.isSafeInteger(id)) return failure("Give the record's id.");
      const row = await records.get(resource, id);
      if (!row) return failure(`There is no ${resource} record ${id}.`);
      return asResult({
        ...slim(row),
        ...(await related(deps.database, resource, id)),
      });
    }
    case "create_record":
    case "update_record": {
      const resource = oneOf(WRITABLE, args.resource);
      if (!resource)
        return failure(`resource is one of ${WRITABLE.join(", ")}.`);
      if (!values) return failure("Give the record's fields as values.");
      const unknown = unknownFields(resource, values);
      if (unknown) return failure(unknown);
      if (toolName === "create_record") {
        return asResult({
          created: slim(await records.create(actor, resource, values)),
        });
      }
      if (!Number.isSafeInteger(id)) return failure("Give the record's id.");
      const row = await records.update(actor, resource, id, values);
      return row
        ? asResult({ updated: slim(row) })
        : failure(`There is no ${resource} record ${id}.`);
    }
    default:
      return failure(`The CRM has no tool named ${toolName}.`);
  }
}

export async function callTool(
  connection: Connection,
  toolName: string,
  args: Args,
): Promise<McpCallResult> {
  const actorId = connection.actorId?.trim();
  if (!actorId) {
    return failure(
      "The CRM acts for a person, and this run is not attributed to anybody.",
    );
  }
  if (!installed)
    return failure("The CRM is not available in this deployment.");
  const { deps, records } = installed;
  const actor = await actorOf(deps, actorId).catch(() => null);
  if (!actor) {
    return failure("The person this run is for can't use the CRM.");
  }
  try {
    return await run(deps, records, actor, toolName, args);
  } catch (error) {
    if (error instanceof CrmRefusal || error instanceof CrmQueryError) {
      return failure(error.message);
    }
    const cause = (
      error as { cause?: { errno?: string; code?: string; message?: string } }
    ).cause;
    if (/^2[23]/.test(String(cause?.errno ?? cause?.code ?? ""))) {
      return failure(
        `The CRM refused those values: ${cause?.message ?? "they don't fit"}.`,
      );
    }
    throw error;
  }
}
