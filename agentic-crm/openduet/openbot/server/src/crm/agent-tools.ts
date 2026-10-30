import { desc, eq, or } from "drizzle-orm";
import type { AuthenticatedActor } from "../auth/guards";
import type { OpenBotRole } from "../auth/roles";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import type { McpCallResult, McpTool } from "../plugins/mcp";
import { MAX_RESULT_CHARS } from "../plugins/mcp";
import { CrmQueryError } from "./filters";
import { chartInput, runReport } from "./platform-routes";
import type { ProspectingConfig } from "./prospecting/settings";
import {
  OUTREACH_TOOLS,
  PROSPECTING_TOOLS,
  PROSPECTING_WRITE_TOOLS,
  runProspectingTool,
} from "./prospecting/tools";
import {
  type CrmRecords,
  CrmRefusal,
  type CrmRow,
  createCrmRecords,
} from "./records";
import { CRM_RESOURCES } from "./resources";
import { dashboards } from "./schema";
import { globalSearch, SEARCH_RESOURCES, type SearchResource } from "./search";

/**
 * The CRM's tools for Bots, as the builtin transport of the "crm" catalogue entry (like Routines).
 *
 * The plugin store grants, gates and audits every call before it gets here, so a write has already
 * been approved by the person. Whose CRM user a call acts as comes from the connection, never from
 * the arguments, and every read and write goes through the same rules as the CRM's screens
 * (records.ts).
 */

export const CRM_WRITE_TOOLS = [
  "create_record",
  "update_record",
  "make_chart",
  ...PROSPECTING_WRITE_TOOLS,
] as const;

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
    name: "run_report",
    description: [
      "Count, add up or average CRM records, overall or per group, to answer questions such as how many deals each stage holds or how much was won each month.",
      'Group by a field ("stage", "lead_source", "sales_id") or by a date field with a bucket (day, week, month, quarter, year).',
      'Custom fields of contacts, companies, deals, meetings and proposals are "custom_fields.<name>"; a custom object\'s fields are their names.',
      "The filter is the same as list_records'. Returns at most 100 groups, largest first, or by date when bucketed.",
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        object: {
          type: "string",
          description:
            "contacts, companies, deals, meetings, proposals, tasks, or a custom object's name.",
        },
        fn: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
        field: {
          type: "string",
          description: "The number to add up or average. Not needed for count.",
        },
        group_by: { type: "string" },
        bucket: {
          type: "string",
          enum: ["day", "week", "month", "quarter", "year"],
        },
        filter: { type: "object" },
      },
      required: ["object"],
    },
  },
  {
    name: "list_reports",
    description:
      "The person's reports (dashboards of charts) and the team's shared ones, each with its charts' titles and its address in the CRM.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "make_chart",
    description: [
      "Add a chart to one of the person's reports, or to a new report, in the CRM's Reports. The person approves it first.",
      'type is "number" (one figure), "bar" (groups compared, or periods with a bucket), "line" (a value over time; group by a date field with a bucket), "pie" (shares of a whole: a count or sum grouped by a non-date field) or "list" (groups as a table).',
      "Check the numbers with run_report first. Returns the report's address to give the person.",
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: {
          type: "string",
          enum: ["number", "bar", "line", "pie", "list"],
        },
        object: { type: "string" },
        fn: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
        field: { type: "string" },
        group_by: { type: "string" },
        bucket: {
          type: "string",
          enum: ["day", "week", "month", "quarter", "year"],
        },
        filter: { type: "object" },
        width: {
          type: "number",
          description: "1 (narrow), 2 or 3 (full width).",
        },
        report_id: {
          type: "number",
          description: "An existing report to add it to.",
        },
        report_name: { type: "string", description: "Or a new report's name." },
        shared: {
          type: "boolean",
          description: "Whether a new report is shared with the team.",
        },
      },
      required: ["title", "type", "object"],
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
  prospecting?: ProspectingConfig;
  fetch?: typeof fetch;
};

let installed: { deps: CrmToolDeps; records: CrmRecords } | null = null;

/** Hands this module the database once, at boot, as `useRoutineTools` does for Routines. */
export function useCrmTools(deps: CrmToolDeps | null): void {
  installed = deps ? { deps, records: createCrmRecords(deps.database) } : null;
}

export async function listTools(): Promise<McpTool[]> {
  return [...TOOLS, ...PROSPECTING_TOOLS, ...OUTREACH_TOOLS].map((tool) => ({
    ...tool,
  }));
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

function asText(text: string): McpCallResult {
  return text.length <= MAX_RESULT_CHARS
    ? { text, isError: false, truncated: false }
    : {
        text: `${text.slice(0, MAX_RESULT_CHARS)}\n\n[truncated]`,
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

// What a role can't see is left out, rather than failing the whole read.
async function readable<TResult>(
  read: () => Promise<TResult>,
  fallback: TResult,
) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof CrmRefusal) return fallback;
    throw error;
  }
}

async function related(
  records: CrmRecords,
  actor: AuthenticatedActor,
  resource: string,
  id: number,
) {
  const rows = (name: string, filter: Record<string, unknown>, extra = {}) =>
    readable(
      async () =>
        (
          await records.list(actor, name, {
            filter,
            perPage: MAX_ROWS,
            ...extra,
          })
        ).data,
      [] as CrmRow[],
    );
  const newest = { sort: "date", order: "DESC", perPage: 10 };
  if (resource === "contacts") {
    const [notes, openTasks] = await Promise.all([
      rows("contact_notes", { contact_id: id }, newest),
      rows("tasks", { contact_id: id, "done_date@is": null }),
    ]);
    return { recent_notes: notes.map(slim), open_tasks: openTasks.map(slim) };
  }
  if (resource === "companies") {
    const [people, companyDeals] = await Promise.all([
      rows("contacts_summary", { company_id: id }),
      rows("deals", { company_id: id }),
    ]);
    return {
      contacts: people.map(({ id, first_name, last_name, title, status }) => ({
        id,
        first_name,
        last_name,
        title,
        status,
      })),
      deals: companyDeals.map(({ id, name, stage }) => ({ id, name, stage })),
    };
  }
  if (resource === "deals") {
    const deal = await records.get(actor, "deals", id);
    const contactIds = (deal?.contact_ids as number[] | null) ?? [];
    const [notes, people] = await Promise.all([
      rows("deal_notes", { deal_id: id }, newest),
      contactIds.length ? rows("contacts_summary", { id: contactIds }) : [],
    ]);
    return {
      recent_notes: notes.map(slim),
      contacts: people.map(({ id, first_name, last_name }) => ({
        id,
        first_name,
        last_name,
      })),
    };
  }
  return {};
}

async function findContact(
  records: CrmRecords,
  actor: AuthenticatedActor,
  email: string,
) {
  const address = email.trim().toLowerCase();
  const domain = address.split("@")[1] ?? "";
  const [people, companies] = await Promise.all([
    readable(
      async () =>
        (
          await records.list(actor, "contacts_summary", {
            filter: { "email_fts@ilike": address },
            perPage: 10,
          })
        ).data.filter((contact) =>
          ((contact.email_jsonb as { email?: string }[] | null) ?? []).some(
            (entry) => entry.email?.toLowerCase() === address,
          ),
        ),
      [] as CrmRow[],
    ),
    domain && !FREE_MAIL.has(domain)
      ? readable(
          async () =>
            (
              await records.list(actor, "companies_summary", {
                filter: { "website@ilike": domain },
                perPage: 5,
              })
            ).data.map(({ id, name, website }) => ({ id, name, website })),
          [] as CrmRow[],
        )
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

async function makeChart(
  deps: CrmToolDeps,
  records: CrmRecords,
  actor: AuthenticatedActor,
  args: Args,
): Promise<McpCallResult> {
  const parsed = chartInput.safeParse({
    ...args,
    id: crypto.randomUUID().slice(0, 8),
    width: Math.min(3, Math.max(1, Number(args.width) || 1)),
  });
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return failure(`${issue?.path.join(".") ?? "chart"}: ${issue?.message}`);
  }
  const chart = parsed.data;
  // A chart that can't be drawn is refused here, with the reason, rather than saved broken.
  await runReport(records, actor, chart);
  const sale = await records.sale(actor);
  if (typeof args.report_id === "number") {
    const [report] = await deps.database
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, args.report_id));
    if (!report || (report.sales_id !== sale.id && actor.role !== "admin")) {
      return failure(
        "That report isn't one this person can change. Name a new one with report_name.",
      );
    }
    await deps.database
      .update(dashboards)
      .set({ widgets: [...((report.widgets as unknown[]) ?? []), chart] })
      .where(eq(dashboards.id, report.id));
    return asResult({
      report_id: report.id,
      url: `/crm/reports/${report.id}`,
      chart,
    });
  }
  const name =
    typeof args.report_name === "string" && args.report_name.trim()
      ? args.report_name.trim().slice(0, 80)
      : chart.title || "Report";
  const [report] = await deps.database
    .insert(dashboards)
    .values({
      name,
      shared: args.shared === true,
      widgets: [chart],
      sales_id: sale.id,
    })
    .returning({ id: dashboards.id });
  return asResult({
    report_id: report?.id,
    url: `/crm/reports/${report?.id}`,
    chart,
  });
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
          await records.accessFor(actor),
        ),
      );
    }
    case "find_contact":
      return typeof args.email === "string" && args.email.includes("@")
        ? asResult(await findContact(records, actor, args.email))
        : failure("Give the email address to look for.");
    case "list_records": {
      const resource = oneOf(READABLE, args.resource);
      if (!resource)
        return failure(`resource is one of ${READABLE.join(", ")}.`);
      const limit = Math.min(MAX_ROWS, Math.max(1, Number(args.limit) || 20));
      const { data, total } = await records.list(actor, resource, {
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
      const row = await records.get(actor, resource, id);
      if (!row) return failure(`There is no ${resource} record ${id}.`);
      return asResult({
        ...slim(row),
        ...(await related(records, actor, resource, id)),
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
    case "run_report":
      return asResult({
        groups: await runReport(records, actor, {
          ...args,
          ...(isObject(args.filter) ? {} : { filter: undefined }),
        }),
      });
    case "list_reports": {
      const sale = await records.sale(actor);
      const rows = await deps.database
        .select()
        .from(dashboards)
        .where(
          or(eq(dashboards.sales_id, sale.id), eq(dashboards.shared, true)),
        )
        .orderBy(desc(dashboards.id));
      return asResult(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          shared: row.shared,
          yours: row.sales_id === sale.id,
          charts: ((row.widgets as { title?: string }[] | null) ?? []).map(
            (chart) => chart.title,
          ),
          url: `/crm/reports/${row.id}`,
        })),
      );
    }
    case "make_chart":
      return makeChart(deps, records, actor, args);
    default: {
      const outcome = await runProspectingTool(
        deps,
        records,
        actor,
        toolName,
        args,
      );
      if (!outcome) return failure(`The CRM has no tool named ${toolName}.`);
      if (!outcome.ok) return failure(outcome.message);
      return typeof outcome.value === "string"
        ? asText(outcome.value)
        : asResult(outcome.value);
    }
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
