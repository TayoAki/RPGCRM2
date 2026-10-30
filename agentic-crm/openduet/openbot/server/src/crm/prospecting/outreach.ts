import { and, count, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedActor } from "../../auth/guards";
import type { Database } from "../../db/client";
import type { CrmRecords, CrmRow } from "../records";
import { emails, mailboxes } from "../schema";
import { TIERS, type Tier, tierTag } from "./leads";
import { outreachFooter } from "./settings";

/*
 * Scoring leads and writing to them. A Bot drafts; the person approves before anything is sent, and
 * sends go out spaced apart from the person's own mailbox, at most DAILY_LIMIT a day. Every email
 * ends with an opt-out line and the sender's postal address, as US law (CAN-SPAM) requires.
 */

export const OPT_OUT =
  "If you'd rather not hear from me, just reply and say so, and I won't email you again.";
export const DO_NOT_CONTACT = "Do not contact";
export const DAILY_LIMIT = 50;
const RECENTLY_MS = 30 * 86_400_000;
const TIER_COLOR = "#dbe7f0";

type Outcome = { ok: true; value: unknown } | { ok: false; message: string };

const invalid = (error: z.ZodError): Outcome => ({
  ok: false,
  message: `That isn't valid: ${error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".")} ${issue.message}`)
    .join("; ")}`,
});

async function tagsNamed(
  records: CrmRecords,
  actor: AuthenticatedActor,
  words: string,
) {
  const { data } = await records.list(actor, "tags", {
    filter: { "name@ilike": words },
    perPage: 50,
  });
  return new Map(data.map((tag) => [String(tag.name), Number(tag.id)]));
}

async function tierTagIds(records: CrmRecords, actor: AuthenticatedActor) {
  const known = await tagsNamed(records, actor, "ICP tier");
  const ids = new Map<Tier, number>();
  for (const tier of TIERS) {
    const name = tierTag(tier);
    const id =
      known.get(name) ??
      Number(
        (
          (await records.create(actor, "tags", {
            name,
            color: TIER_COLOR,
          })) as CrmRow
        ).id,
      );
    ids.set(tier, id);
  }
  return ids;
}

/** A contact's tags with its tier swapped for the new one. */
export function withTier(
  current: number[],
  tierIds: Map<Tier, number>,
  tier: Tier,
): number[] {
  const others = new Set(tierIds.values());
  return [
    ...current.filter((id) => !others.has(id)),
    tierIds.get(tier) as number,
  ];
}

const scoresSchema = z.object({
  scores: z
    .array(
      z.object({
        contact_id: z.number().int(),
        tier: z.enum(TIERS),
        score: z.number().int().min(0).max(100).optional(),
        reason: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(50),
});

export async function scoreLeads(
  records: CrmRecords,
  actor: AuthenticatedActor,
  args: unknown,
): Promise<Outcome> {
  const parsed = scoresSchema.safeParse(args);
  if (!parsed.success) return invalid(parsed.error);
  const tierIds = await tierTagIds(records, actor);
  const done: Record<Tier, number> = { A: 0, B: 0, C: 0, D: 0 };
  const skipped: number[] = [];
  for (const entry of parsed.data.scores) {
    const contact = await records.get(actor, "contacts", entry.contact_id);
    if (!contact) {
      skipped.push(entry.contact_id);
      continue;
    }
    await records.update(actor, "contacts", entry.contact_id, {
      tags: withTier(
        (contact.tags as number[] | null) ?? [],
        tierIds,
        entry.tier,
      ),
    });
    await records.create(actor, "contact_notes", {
      contact_id: entry.contact_id,
      text: `ICP tier ${entry.tier}${entry.score === undefined ? "" : ` (${entry.score}/100)`}: ${entry.reason}`,
    });
    done[entry.tier] += 1;
  }
  return { ok: true, value: { scored: done, skipped_contact_ids: skipped } };
}

/** Tags a lead with its tier, for add_leads. */
export async function tagTier(
  records: CrmRecords,
  actor: AuthenticatedActor,
  tier: Tier,
) {
  return (await tierTagIds(records, actor)).get(tier) as number;
}

const draftsSchema = z.object({
  emails: z
    .array(
      z.object({
        contact_id: z.number().int(),
        subject: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1).max(5000),
      }),
    )
    .min(1)
    .max(25),
});

const emailOf = (contact: CrmRow) =>
  ((contact.email_jsonb as { email?: string }[] | null) ?? [])
    .map((entry) => entry.email?.trim())
    .find((email): email is string => !!email);

async function blockedTagIds(records: CrmRecords, actor: AuthenticatedActor) {
  const id = (await tagsNamed(records, actor, DO_NOT_CONTACT)).get(
    DO_NOT_CONTACT,
  );
  return id === undefined ? new Set<number>() : new Set([id]);
}

const isBlocked = (contact: CrmRow, blocked: Set<number>) =>
  ((contact.tags as number[] | null) ?? []).some((id) => blocked.has(id));

export async function draftOutreach(
  database: Database,
  records: CrmRecords,
  actor: AuthenticatedActor,
  args: unknown,
): Promise<Outcome> {
  const parsed = draftsSchema.safeParse(args);
  if (!parsed.success) return invalid(parsed.error);
  const footer = await outreachFooter(database);
  if (!footer) {
    return {
      ok: false,
      message:
        "Outreach emails must end with the sender's business name and postal address. Ask the person for them, save them with save_outreach_footer, then draft again.",
    };
  }
  const sale = await records.sale(actor);
  const blocked = await blockedTagIds(records, actor);
  const since = new Date(Date.now() - RECENTLY_MS).toISOString();
  const drafted: { email_id: number; contact_id: number; to: string }[] = [];
  const skipped: { contact_id: number; why: string }[] = [];
  for (const draft of parsed.data.emails) {
    const contact = await records.get(actor, "contacts", draft.contact_id);
    const to = contact ? emailOf(contact) : undefined;
    let why: string | null = null;
    if (!contact) why = "No such contact";
    else if (!to) why = "No email address";
    else if (isBlocked(contact, blocked)) why = `Tagged ${DO_NOT_CONTACT}`;
    else {
      const [recent] = await database
        .select({ id: emails.id })
        .from(emails)
        .where(
          and(
            eq(emails.direction, "out"),
            sql`lower(${emails.to_address}) = ${to.toLowerCase()}`,
            gte(emails.created_at, since),
          ),
        )
        .limit(1);
      if (recent) why = "Already emailed in the last 30 days";
    }
    if (why || !to) {
      skipped.push({
        contact_id: draft.contact_id,
        why: why ?? "No email address",
      });
      continue;
    }
    const [row] = await database
      .insert(emails)
      .values({
        direction: "out",
        status: "draft",
        to_address: to,
        subject: draft.subject,
        body: `${draft.body}\n\n${OPT_OUT}\n${footer}`,
        contact_id: draft.contact_id,
        sales_id: sale.id,
      })
      .returning({ id: emails.id });
    if (row)
      drafted.push({ email_id: row.id, contact_id: draft.contact_id, to });
  }
  return {
    ok: true,
    value: {
      drafted,
      skipped,
      review:
        "Each draft is on its contact's page under Emails, with Send now and Delete. Nothing has been sent.",
    },
  };
}

const sendSchema = z.object({
  email_ids: z.array(z.number().int()).min(1).max(DAILY_LIMIT),
  spacing_minutes: z.number().int().min(2).max(60).default(4),
});

export async function sendOutreach(
  database: Database,
  records: CrmRecords,
  actor: AuthenticatedActor,
  args: unknown,
  now: Date = new Date(),
): Promise<Outcome> {
  const parsed = sendSchema.safeParse(args);
  if (!parsed.success) return invalid(parsed.error);
  const sale = await records.sale(actor);
  // The person's own mailbox, else the shared one, as the CRM's mail sends.
  const [mailbox] = await database
    .select({ from: mailboxes.from_address })
    .from(mailboxes)
    .where(or(eq(mailboxes.sales_id, sale.id), isNull(mailboxes.sales_id)))
    .orderBy(sql`${mailboxes.sales_id} is null`)
    .limit(1);
  if (!mailbox) {
    return {
      ok: false,
      message:
        "No mailbox is connected to send from. Connect one in the CRM's settings under Mailboxes, then send again.",
    };
  }
  const [{ total } = { total: 0 }] = await database
    .select({ total: count() })
    .from(emails)
    .where(
      and(
        eq(emails.sales_id, sale.id),
        eq(emails.direction, "out"),
        inArray(emails.status, ["scheduled", "sending", "sent"]),
        gte(emails.send_at, new Date(now.getTime() - 86_400_000).toISOString()),
      ),
    );
  let room = Math.max(0, DAILY_LIMIT - Number(total));
  const drafts = await database
    .select()
    .from(emails)
    .where(
      and(
        inArray(emails.id, parsed.data.email_ids),
        eq(emails.sales_id, sale.id),
        eq(emails.direction, "out"),
        eq(emails.status, "draft"),
      ),
    );
  const byId = new Map(drafts.map((row) => [row.id, row]));
  const blocked = await blockedTagIds(records, actor);
  const scheduled: { email_id: number; to: string; send_at: string }[] = [];
  const skipped: { email_id: number; why: string }[] = [];
  for (const id of parsed.data.email_ids) {
    const row = byId.get(id);
    if (!row) {
      skipped.push({ email_id: id, why: "Not one of your drafts" });
      continue;
    }
    const contact = row.contact_id
      ? await records.get(actor, "contacts", row.contact_id)
      : undefined;
    if (contact && isBlocked(contact, blocked)) {
      skipped.push({ email_id: id, why: `Tagged ${DO_NOT_CONTACT}` });
      continue;
    }
    if (room === 0) {
      skipped.push({
        email_id: id,
        why: `Over today's limit of ${DAILY_LIMIT}. Send it tomorrow.`,
      });
      continue;
    }
    room -= 1;
    const sendAt = new Date(
      now.getTime() + scheduled.length * parsed.data.spacing_minutes * 60_000,
    ).toISOString();
    await database
      .update(emails)
      .set({ status: "scheduled", send_at: sendAt })
      .where(eq(emails.id, id));
    scheduled.push({ email_id: id, to: row.to_address, send_at: sendAt });
  }
  return {
    ok: true,
    value: {
      from: mailbox.from,
      scheduled,
      skipped,
      note: `They go out one every ${parsed.data.spacing_minutes} minutes. A scheduled email can still be deleted from its contact's page until it sends.`,
    },
  };
}
