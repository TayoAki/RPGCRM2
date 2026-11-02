import { and, count, eq, gte } from "drizzle-orm";
import type { Database } from "../../db/client";
import { routineRuns, routines } from "../../db/schema";
import { contacts, dealStageHistory, emails, meetings } from "../schema";

/** The last seven days: what this person's Bots ran, what came of it, and what waits on them. */
export async function weekReport(
  database: Database,
  person: { userId: string; salesId: number | null },
  now: Date = new Date(),
) {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const sinceIso = since.toISOString();
  const total = (rows: { total: number }[]) => Number(rows[0]?.total ?? 0);

  const [runs, newContacts, meetingsBooked, moved, won, replies, drafts] =
    await Promise.all([
      database
        .select({ status: routineRuns.status, total: count() })
        .from(routineRuns)
        .innerJoin(routines, eq(routines.id, routineRuns.routineId))
        .where(
          and(
            eq(routines.ownerUserId, person.userId),
            gte(routineRuns.startedAt, since),
          ),
        )
        .groupBy(routineRuns.status),
      database
        .select({ total: count() })
        .from(contacts)
        .where(gte(contacts.first_seen, sinceIso)),
      database
        .select({ total: count() })
        .from(meetings)
        .where(gte(meetings.created_at, sinceIso)),
      database
        .select({ total: count() })
        .from(dealStageHistory)
        .where(gte(dealStageHistory.changed_at, sinceIso)),
      database
        .select({ total: count() })
        .from(dealStageHistory)
        .where(
          and(
            gte(dealStageHistory.changed_at, sinceIso),
            eq(dealStageHistory.to_stage, "won"),
          ),
        ),
      database
        .select({ total: count() })
        .from(emails)
        .where(
          and(eq(emails.direction, "in"), gte(emails.created_at, sinceIso)),
        ),
      person.salesId === null
        ? Promise.resolve([{ total: 0 }])
        : database
            .select({ total: count() })
            .from(emails)
            .where(
              and(
                eq(emails.sales_id, person.salesId),
                eq(emails.direction, "out"),
                eq(emails.status, "draft"),
              ),
            ),
    ]);

  const byStatus = (status: string | null) =>
    Number(runs.find((row) => row.status === status)?.total ?? 0);
  return {
    since: sinceIso,
    botRuns: {
      total: runs.reduce((sum, row) => sum + Number(row.total), 0),
      succeeded: byStatus("succeeded"),
      failed: byStatus("failed"),
      waiting: byStatus("waiting"),
    },
    results: {
      newContacts: total(newContacts),
      meetingsBooked: total(meetingsBooked),
      dealsMoved: total(moved),
      dealsWon: total(won),
      replies: total(replies),
    },
    waiting: { drafts: total(drafts) },
  };
}

export type WeekReport = Awaited<ReturnType<typeof weekReport>>;
