import { and, count, eq } from "drizzle-orm";
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import type { Database } from "../../db/client";
import { RoutineRefusedError, type RoutineStore } from "../../routines/store";
import type { CrmRecords } from "../records";
import { emails } from "../schema";
import { LEAD_SOURCE } from "./leads";
import {
  type ProspectingConfig,
  savedProfile,
  spentThisMonth,
} from "./settings";

type Variables = { Variables: AppVariables };

// Mondays at 8:00 in the person's own time zone.
const WEEKLY = "0 8 * * 1";

// The routine is found again by this first line, so keep it stable.
const FIRST_LINE = "Build this week's lead list.";

/** What the weekly routine, and Find leads now, ask the Bot to do. Under the 2,000 characters a routine allows. */
export const LEAD_LIST_INSTRUCTION = [
  FIRST_LINE,
  "1. Call customer_profile and use the saved profile. If there is none, write one from the facts and save it with save_customer_profile. With no profile and no won deals, ask the person to describe their best customers and stop.",
  "2. Warm leads first. Pick 2 or 3 topics the profile's buyers post about. Find recent LinkedIn posts on them with look_up_data on harvestapi.linkedin.post.search, keep the 3 to 5 with the most comments, and get who engaged with fetchinio.linkedin.post.engagement. Keep people whose headline fits the profile, commenters first.",
  "3. Enrich: get each person's company domain with treg.linkedin.user.profile, then a work email with hunter.people.email.find, or apollo.people.bulk_enrich for up to 10 at once.",
  "4. Verify every email with treg.people.email.verify. Drop invalid ones and note accept-all as risky.",
  "5. Score each lead A to D: A fits industry, size and role and commented; B misses one; C partial; D poor. Leave D out.",
  `6. Add the A to C leads with one add_leads call named after today's date, with tier, score, the post as source_url and what they said as a signal. If LinkedIn gave fewer than 10, add companies that fit, found with find_data_tools.`,
  "7. For tier A and B, draft one email each with draft_outreach: under 120 words, opening with what they said or reacted to, one specific observation about their company and one simple question. No flattery and nothing made up. Don't send.",
  "Read data_tool_details before a tool's first use. Stop if the lookup budget runs out. End with leads by tier, drafts waiting and what it cost.",
].join("\n");

export function createProspectingRoutes(deps: {
  requireUser: MiddlewareHandler<Variables>;
  database: Database;
  records: CrmRecords;
  prospecting: ProspectingConfig;
  routines: Pick<RoutineStore, "create" | "listFor" | "remove">;
  directChannel: (
    ownerUserId: string,
    agentId: string,
  ) => Promise<{ id: string }>;
  primaryBotId: string;
}) {
  const routes = new Hono<Variables>();
  routes.use("*", deps.requireUser);

  const routineOf = async (ownerUserId: string) =>
    (await deps.routines.listFor(ownerUserId)).find(
      (routine) =>
        routine.agentId === deps.primaryBotId &&
        routine.instruction.startsWith(FIRST_LINE),
    ) ?? null;

  routes.get("/", async (context) => {
    const actor = context.var.actor;
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [routine, spent, profile, leads, drafts] = await Promise.all([
      routineOf(actor.id),
      spentThisMonth(deps.database),
      savedProfile(deps.database),
      deps.records
        .list(actor, "contacts", {
          filter: { lead_source: LEAD_SOURCE, "first_seen@gte": weekAgo },
          perPage: 1,
        })
        .then((page) => page.total)
        .catch(() => 0),
      deps.records
        .sale(actor)
        .then(async (sale) => {
          const [row] = await deps.database
            .select({ total: count() })
            .from(emails)
            .where(
              and(
                eq(emails.sales_id, sale.id),
                eq(emails.direction, "out"),
                eq(emails.status, "draft"),
              ),
            );
          return Number(row?.total ?? 0);
        })
        .catch(() => 0),
    ]);
    return context.json({
      data: {
        available: !!deps.prospecting.tregApiKey,
        botId: deps.primaryBotId,
        instruction: LEAD_LIST_INSTRUCTION,
        leadSource: LEAD_SOURCE,
        profile,
        leadsThisWeek: leads,
        draftsWaiting: drafts,
        budget: {
          monthlyUsd: deps.prospecting.monthlyBudgetUsd,
          spentUsd: Math.round(spent / 10_000) / 100,
        },
        routine: routine && {
          id: routine.id,
          schedule: routine.schedule,
          enabled: routine.enabled,
          nextRunAt: routine.nextRunAt,
        },
      },
    });
  });

  routes.post("/routine", async (context) => {
    const actor = context.var.actor;
    if (!deps.prospecting.tregApiKey) {
      return context.json(
        { error: "Lead lists aren't set up in this workspace yet." },
        409,
      );
    }
    if (await routineOf(actor.id)) {
      return context.json(
        { error: "Your weekly lead list is already on." },
        409,
      );
    }
    const body = (await context.req.json().catch(() => ({}))) as {
      timezone?: unknown;
    };
    const timezone =
      typeof body.timezone === "string" && body.timezone.length < 64
        ? body.timezone
        : "UTC";
    try {
      const channel = await deps.directChannel(actor.id, deps.primaryBotId);
      const routine = await deps.routines.create({
        ownerUserId: actor.id,
        agentId: deps.primaryBotId,
        channelId: channel.id,
        instruction: LEAD_LIST_INSTRUCTION,
        cron: WEEKLY,
        timezone,
      });
      return context.json({ data: { id: routine.id } }, 201);
    } catch (error) {
      if (error instanceof RoutineRefusedError) {
        return context.json({ error: error.message }, 409);
      }
      throw error;
    }
  });

  routes.delete("/routine", async (context) => {
    const actor = context.var.actor;
    const routine = await routineOf(actor.id);
    if (routine) await deps.routines.remove(actor.id, routine.id);
    return context.json({ data: { removed: !!routine } });
  });

  return routes;
}
