import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
import type { Database } from "../db/client";
import {
  configuration,
  contacts,
  contactsSummary,
  dealStageHistory,
  deals,
  sales,
  tasks,
} from "./schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const STALLED_AFTER = 14 * DAY;
const COOLING_AFTER = 7 * DAY;
const CLOSED_STAGES = ["won", "lost"];

/** One CRM row of the morning brief: what it is, why it's there, and where it is in the CRM. */
export type CrmBriefItem = {
  id: string;
  kind: "task" | "deal" | "contact";
  title: string;
  why: string;
  href: string;
};

type Stage = { value: string; label: string };
type CrmConfig = { dealStages?: Stage[]; dealPipelineStatuses?: string[] };

function span(milliseconds: number): string {
  if (milliseconds < HOUR) return "less than an hour";
  const hours = Math.round(milliseconds / HOUR);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(milliseconds / DAY);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

const nameOf = (person: {
  first_name: string | null;
  last_name: string | null;
}) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed";

const shorten = (text: string, length = 80) =>
  text.length > length ? `${text.slice(0, length - 1)}…` : text;

/**
 * What the person's own CRM records ask of them today: tasks overdue or due within a day, deals that
 * changed stage in the last day, open deals nobody has touched in two weeks, and hot contacts not
 * heard from in a week. Read-only: someone who has never opened the CRM owns nothing and gets nothing.
 */
export async function crmFollowUps(
  database: Database,
  actorId: string,
  now = new Date(),
): Promise<CrmBriefItem[]> {
  const [sale] = await database
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.user_id, actorId))
    .limit(1);
  if (!sale) return [];
  const [settings] = await database
    .select({ config: configuration.config })
    .from(configuration)
    .limit(1);
  const config = (settings?.config ?? {}) as CrmConfig;
  const closed = [...CLOSED_STAGES, ...(config.dealPipelineStatuses ?? [])];
  const stageLabel = (stage: string) =>
    config.dealStages?.find((known) => known.value === stage)?.label ??
    stage.charAt(0).toUpperCase() + stage.slice(1).replaceAll("-", " ");
  const at = (offset: number) => new Date(now.getTime() + offset).toISOString();

  const [dueTasks, movedDeals, stalledDeals, coolingContacts] =
    await Promise.all([
      database
        .select({
          id: tasks.id,
          text: tasks.text,
          due_date: tasks.due_date,
          contact_id: tasks.contact_id,
          first_name: contacts.first_name,
          last_name: contacts.last_name,
        })
        .from(tasks)
        .leftJoin(contacts, eq(contacts.id, tasks.contact_id))
        .where(
          and(
            eq(tasks.sales_id, sale.id),
            isNull(tasks.done_date),
            lt(tasks.due_date, at(DAY)),
          ),
        )
        .orderBy(asc(tasks.due_date))
        .limit(10),
      database
        .selectDistinctOn([dealStageHistory.deal_id], {
          id: deals.id,
          name: deals.name,
          from_stage: dealStageHistory.from_stage,
          to_stage: dealStageHistory.to_stage,
          changed_at: dealStageHistory.changed_at,
        })
        .from(dealStageHistory)
        .innerJoin(deals, eq(deals.id, dealStageHistory.deal_id))
        .where(
          and(
            eq(deals.sales_id, sale.id),
            isNotNull(dealStageHistory.from_stage),
            gte(dealStageHistory.changed_at, at(-DAY)),
            lte(dealStageHistory.changed_at, at(0)),
          ),
        )
        .orderBy(dealStageHistory.deal_id, desc(dealStageHistory.changed_at))
        .limit(5),
      database
        .select({
          id: deals.id,
          name: deals.name,
          stage: deals.stage,
          updated_at: deals.updated_at,
        })
        .from(deals)
        .where(
          and(
            eq(deals.sales_id, sale.id),
            isNull(deals.archived_at),
            notInArray(deals.stage, closed),
            lt(deals.updated_at, at(-STALLED_AFTER)),
          ),
        )
        .orderBy(asc(deals.updated_at))
        .limit(5),
      database
        .select({
          id: contacts.id,
          first_name: contacts.first_name,
          last_name: contacts.last_name,
          last_seen: contacts.last_seen,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.sales_id, sale.id),
            eq(contacts.status, "hot"),
            lt(contacts.last_seen, at(-COOLING_AFTER)),
          ),
        )
        .orderBy(asc(contacts.last_seen))
        .limit(5),
    ]);

  const since = (moment: string | null) =>
    now.getTime() - new Date(moment ?? now).getTime();
  return [
    ...dueTasks.map((task): CrmBriefItem => {
      const late = since(task.due_date);
      return {
        id: `task-${task.id}`,
        kind: "task",
        title: `${shorten(task.text?.trim() || "Task")} · ${nameOf(task)}`,
        why: late >= 0 ? `Overdue by ${span(late)}` : `Due in ${span(-late)}`,
        href: `/crm/contacts/${task.contact_id}/show`,
      };
    }),
    ...movedDeals.map((deal): CrmBriefItem => {
      const ago = span(since(deal.changed_at));
      return {
        id: `moved-${deal.id}`,
        kind: "deal",
        title: deal.name,
        why: CLOSED_STAGES.includes(deal.to_stage)
          ? `${stageLabel(deal.to_stage)} ${ago} ago`
          : `Moved from ${stageLabel(deal.from_stage ?? "")} to ${stageLabel(deal.to_stage)} ${ago} ago`,
        href: `/crm/deals/${deal.id}/show`,
      };
    }),
    ...stalledDeals.map(
      (deal): CrmBriefItem => ({
        id: `deal-${deal.id}`,
        kind: "deal",
        title: deal.name,
        why: `${stageLabel(deal.stage)}, no change in ${span(since(deal.updated_at))}`,
        href: `/crm/deals/${deal.id}/show`,
      }),
    ),
    ...coolingContacts.map(
      (contact): CrmBriefItem => ({
        id: `contact-${contact.id}`,
        kind: "contact",
        title: nameOf(contact),
        why: `Hot, last contact ${span(since(contact.last_seen))} ago`,
        href: `/crm/contacts/${contact.id}/show`,
      }),
    ),
  ];
}

/** Who a sender is in the CRM. */
export type CrmSender = {
  contactId: number;
  name: string;
  company: string | null;
};

/** The CRM contacts with these email addresses, by lowercased address. */
export async function crmSenders(
  database: Database,
  addresses: string[],
): Promise<Map<string, CrmSender>> {
  const wanted = [
    ...new Set(addresses.map((address) => address.toLowerCase())),
  ];
  if (wanted.length === 0) return new Map();
  const rows = (await database.execute(sql`
    select c.id, c.first_name, c.last_name, c.company_name, lower(e->>'email') as email
    from ${contactsSummary} c, jsonb_array_elements(coalesce(c.email_jsonb, '[]'::jsonb)) e
    where lower(e->>'email') = any(${sql.param(wanted)}::text[])
    order by c.id`)) as unknown as {
    id: number | string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string;
  }[];
  const found = new Map<string, CrmSender>();
  for (const row of rows) {
    if (found.has(row.email)) continue;
    found.set(row.email, {
      contactId: Number(row.id),
      name: nameOf(row),
      company: row.company_name,
    });
  }
  return found;
}

type Mail = { address?: string };

/**
 * The brief with the CRM in it: the person's follow-ups, and who each sender is in the CRM. When the
 * CRM can't be read the brief still arrives, saying so.
 */
export async function withCrm<
  TBrief extends {
    needsYou: Mail[];
    canWait: Mail[];
    couldNotCheck: { source: string; why: string }[];
  },
>(
  database: Database,
  actorId: string,
  brief: TBrief,
): Promise<TBrief & { crm?: CrmBriefItem[] }> {
  try {
    const [crm, senders] = await Promise.all([
      crmFollowUps(database, actorId),
      crmSenders(
        database,
        [...brief.needsYou, ...brief.canWait].flatMap((mail) =>
          mail.address ? [mail.address] : [],
        ),
      ),
    ]);
    const known = <TMail extends Mail>(mail: TMail) => {
      const sender = mail.address ? senders.get(mail.address) : undefined;
      return sender ? { ...mail, crm: sender } : mail;
    };
    return {
      ...brief,
      needsYou: brief.needsYou.map(known),
      canWait: brief.canWait.map(known),
      ...(crm.length ? { crm } : {}),
    };
  } catch (error) {
    console.error(
      JSON.stringify({ type: "crm-brief-failed", detail: String(error) }),
    );
    return {
      ...brief,
      couldNotCheck: [
        ...brief.couldNotCheck,
        { source: "CRM", why: "The CRM couldn't be read just now." },
      ],
    };
  }
}
