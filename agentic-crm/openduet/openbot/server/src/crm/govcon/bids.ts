import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { bids } from "../schema";
import { bidTotals } from "./bid-math";
import type {
  BidDetails,
  Breakdown,
  Deal,
  Opportunity,
  PricingModel,
  Stage,
  Subcontractor,
} from "./kontract-api";

export const STAGES = [
  "found",
  "sourcing",
  "quoted",
  "submitted",
  "won",
  "lost",
] as const satisfies readonly Stage[];

export type BidRow = typeof bids.$inferSelect;

export const daysLeft = (deadline: string | null | undefined, now: Date) => {
  const at = deadline ? Date.parse(deadline) : Number.NaN;
  return Number.isNaN(at) ? null : Math.ceil((at - now.getTime()) / 86_400_000);
};

export async function bidByNotice(database: Database, noticeId: string) {
  const [row] = await database
    .select()
    .from(bids)
    .where(eq(bids.notice_id, noticeId));
  return row ?? null;
}

export async function bidById(database: Database, id: number) {
  const [row] = await database.select().from(bids).where(eq(bids.id, id));
  return row ?? null;
}

/** Which of these notices are tracked, by notice id. */
export async function trackedIds(database: Database, noticeIds: string[]) {
  if (!noticeIds.length) return new Map<string, number>();
  const rows = await database
    .select({ id: bids.id, notice_id: bids.notice_id })
    .from(bids)
    .where(inArray(bids.notice_id, noticeIds));
  return new Map(rows.map((row) => [row.notice_id, row.id]));
}

export async function listBids(database: Database, stage?: Stage) {
  return database
    .select()
    .from(bids)
    .where(stage ? eq(bids.stage, stage) : undefined)
    .orderBy(sql`${bids.response_deadline} asc nulls last`, asc(bids.id));
}

/** Tracks a notice, or returns the bid that already tracks it. */
export async function trackBid(
  database: Database,
  opportunity: Opportunity,
  salesId: number,
  notes: string,
): Promise<{ row: BidRow; created: boolean }> {
  const [row] = await database
    .insert(bids)
    .values({
      notice_id: opportunity.id,
      title: opportunity.title,
      agency: opportunity.agency ?? "",
      response_deadline: opportunity.responseDeadline,
      opportunity,
      notes,
      sales_id: salesId,
    })
    .onConflictDoNothing({ target: bids.notice_id })
    .returning();
  if (row) return { row, created: true };
  const existing = await bidByNotice(database, opportunity.id);
  if (!existing)
    throw new Error("A bid for that notice vanished while tracking it.");
  return { row: existing, created: false };
}

export type BidChanges = Partial<{
  stage: Stage;
  notes: string;
  details: BidDetails;
  breakdown: Breakdown;
  pricing: PricingModel;
  subs: Subcontractor[];
  scope: string;
  proposal: string;
}>;

export async function updateBid(
  database: Database,
  id: number,
  changes: BidChanges,
  now: Date = new Date(),
) {
  const submitted =
    changes.stage === "submitted" ? { submitted_at: now.toISOString() } : {};
  const [row] = await database
    .update(bids)
    .set({ ...changes, ...submitted })
    .where(eq(bids.id, id))
    .returning();
  return row ?? null;
}

/** Caches a document read or breakdown on the notice's bid, if it is tracked. */
export async function rememberOnBid(
  database: Database,
  noticeId: string,
  changes: Pick<BidChanges, "details" | "breakdown">,
) {
  const rows = await database
    .update(bids)
    .set(changes)
    .where(eq(bids.notice_id, noticeId))
    .returning({ id: bids.id });
  return rows[0]?.id ?? null;
}

/** A bid in Kontract's Deal shape, which its drafts are written from. */
export function dealOf(row: BidRow): Deal {
  return {
    id: row.notice_id,
    opportunity: row.opportunity as Opportunity,
    stage: row.stage as Stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.submitted_at ? { submittedAt: row.submitted_at } : {}),
    notes: row.notes,
    ...(row.breakdown ? { breakdown: row.breakdown as Breakdown } : {}),
    ...(row.details ? { details: row.details as BidDetails } : {}),
    ...(row.scope ? { sow: row.scope } : {}),
    ...(row.proposal ? { proposal: row.proposal } : {}),
    subs: (row.subs as Subcontractor[] | null) ?? [],
    pricing: (row.pricing as PricingModel | null) ?? {
      periods: 1,
      periodLabel: "contract",
      lines: [],
    },
  };
}

/** What a Bot sees of a tracked bid. */
export function bidSummary(row: BidRow, now: Date = new Date()) {
  const pricing = row.pricing as PricingModel | null;
  const totals = pricing?.lines.length ? bidTotals(pricing) : null;
  const subs = (row.subs as Subcontractor[] | null) ?? [];
  return {
    bid_id: row.id,
    notice_id: row.notice_id,
    title: row.title,
    agency: row.agency,
    stage: row.stage,
    deadline: row.response_deadline,
    days_left: daysLeft(row.response_deadline, now),
    documents_read: !!row.details,
    pricing: totals && {
      periods: pricing?.periods,
      per: pricing?.periodLabel,
      sub_cost_per_period: totals.subPerPeriod,
      price_per_period: totals.pricePerPeriod,
      profit_total: totals.profitTotal,
      margin:
        totals.margin === null ? null : Math.round(totals.margin * 1000) / 10,
    },
    subs: subs.map((sub) => ({
      name: sub.name,
      status: sub.status,
      ...(sub.quote === undefined ? {} : { quote: sub.quote }),
    })),
    has_scope: !!row.scope,
    has_proposal: !!row.proposal,
    notes: row.notes || undefined,
  };
}
