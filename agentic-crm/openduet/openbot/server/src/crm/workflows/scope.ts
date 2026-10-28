import { and, desc, eq, inArray, max } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  companies,
  configuration,
  contacts,
  deals,
  emails,
  meetings,
  proposals,
  sales,
  tasks,
} from "../schema";
import type { WorkflowObject } from "./definition";
import type { RenderOptions } from "./render";

type Row = Record<string, unknown>;

/** What a run carries between steps: each step's output, and records steps found or made. */
export type RunContext = {
  steps: Record<string, unknown>;
  links?: { contact_id?: number; deal_id?: number; proposal_id?: number };
};

export type RunTrigger = {
  object?: WorkflowObject;
  recordId?: number;
  action?: string;
  previous?: Row | null;
  // The record as it was, for a run about a record that has been deleted.
  snapshot?: Row | null;
  payload?: unknown;
};

/** What a run's steps and conditions can read. */
export type Scope = {
  record?: Row;
  previous?: Row;
  contact?: Row;
  contacts?: Row[];
  company?: Row;
  deal?: Row;
  meeting?: Row;
  proposal?: Row;
  task?: Row;
  // The record a for_each step is on.
  item?: Row;
  owner?: Row;
  trigger: { payload?: unknown; action?: string; object?: string };
  steps: Record<string, unknown>;
  crm: { title: string; url: string };
};

const TABLES = {
  contacts,
  companies,
  deals,
  tasks,
  meetings,
  proposals,
  emails,
} as const;

const firstEmail = (row: Row | undefined) => {
  const list = row?.email_jsonb;
  return Array.isArray(list) ? (list[0] as Row | undefined)?.email : undefined;
};
const firstPhone = (row: Row | undefined) => {
  const list = row?.phone_jsonb;
  return Array.isArray(list) ? (list[0] as Row | undefined)?.number : undefined;
};

export function createScopeLoader(deps: {
  database: Database;
  publicUrl: string;
}) {
  const { database } = deps;

  const one = async (
    object: keyof typeof TABLES,
    id: unknown,
  ): Promise<Row | undefined> => {
    if (typeof id !== "number" && typeof id !== "string") return undefined;
    const table = TABLES[object];
    const [row] = await database
      .select()
      .from(table)
      .where(eq(table.id, Number(id)))
      .limit(1);
    return row as Row | undefined;
  };

  const withContactFields = async (row: Row | undefined) => {
    if (!row) return undefined;
    const [received] = await database
      .select({ at: max(emails.sent_at) })
      .from(emails)
      .where(
        and(eq(emails.contact_id, Number(row.id)), eq(emails.direction, "in")),
      );
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
    return {
      ...row,
      name,
      email: firstEmail(row),
      phone: firstPhone(row),
      last_email_received_at: received?.at ?? null,
    };
  };

  const proposalFields = (row: Row | undefined) =>
    row
      ? { ...row, url: `${deps.publicUrl}/proposal/${row.token}` }
      : undefined;

  const latestProposal = async (dealId: unknown) => {
    if (dealId == null) return undefined;
    const [row] = await database
      .select()
      .from(proposals)
      .where(eq(proposals.deal_id, Number(dealId)))
      .orderBy(desc(proposals.id))
      .limit(1);
    return row as Row | undefined;
  };

  return {
    async options(): Promise<RenderOptions & { title: string }> {
      const [row] = await database.select().from(configuration).limit(1);
      const config = (row?.config ?? {}) as Row;
      return {
        timezone: typeof config.timezone === "string" ? config.timezone : "UTC",
        currency: typeof config.currency === "string" ? config.currency : "USD",
        title: typeof config.title === "string" ? config.title : "",
      };
    },

    /** The run's record and what it leads to: its contact, company, deal, meeting, proposal, owner. */
    async load(trigger: RunTrigger, context: RunContext, title: string) {
      const links = context.links ?? {};
      const scope: Scope = {
        trigger: {
          payload: trigger.payload,
          ...(trigger.action ? { action: trigger.action } : {}),
          ...(trigger.object ? { object: trigger.object } : {}),
        },
        steps: context.steps,
        crm: { title, url: deps.publicUrl },
        ...(trigger.previous ? { previous: trigger.previous } : {}),
      };
      const object = trigger.object;
      const record =
        (object && object in TABLES && trigger.recordId != null
          ? await one(object as keyof typeof TABLES, trigger.recordId)
          : undefined) ??
        trigger.snapshot ??
        undefined;
      if (record) scope.record = record;

      switch (object) {
        case "contacts":
          scope.contact = record;
          break;
        case "companies":
          scope.company = record;
          break;
        case "deals":
          scope.deal = record;
          break;
        case "meetings":
          scope.meeting = record;
          break;
        case "proposals":
          scope.proposal = record;
          break;
        case "tasks":
          scope.task = record;
          break;
      }
      const from = (key: string) =>
        [record, scope.meeting, scope.proposal, scope.task].find(
          (row) => row?.[key] != null,
        )?.[key];

      scope.deal ??= await one("deals", from("deal_id") ?? links.deal_id);
      if (!scope.contact) {
        const contactId =
          from("contact_id") ??
          links.contact_id ??
          (Array.isArray(scope.deal?.contact_ids)
            ? scope.deal.contact_ids[0]
            : undefined);
        scope.contact = await one("contacts", contactId);
      }
      scope.company ??= await one(
        "companies",
        from("company_id") ??
          scope.contact?.company_id ??
          scope.deal?.company_id,
      );
      scope.proposal ??=
        (await one("proposals", links.proposal_id)) ??
        (await latestProposal(scope.deal?.id));

      const dealContactIds = Array.isArray(scope.deal?.contact_ids)
        ? (scope.deal.contact_ids as number[])
        : [];
      scope.contacts = dealContactIds.length
        ? ((await database
            .select()
            .from(contacts)
            .where(inArray(contacts.id, dealContactIds))) as Row[])
        : scope.contact
          ? [scope.contact]
          : [];
      scope.contact = await withContactFields(scope.contact);
      scope.proposal = proposalFields(scope.proposal);

      const ownerId =
        record?.sales_id ?? scope.deal?.sales_id ?? scope.contact?.sales_id;
      if (ownerId != null) {
        const [owner] = await database
          .select()
          .from(sales)
          .where(eq(sales.id, Number(ownerId)));
        if (owner) {
          scope.owner = {
            ...owner,
            name: `${owner.first_name} ${owner.last_name}`.trim(),
          };
        }
      }
      return scope;
    },
  };
}

export type ScopeLoader = ReturnType<typeof createScopeLoader>;
