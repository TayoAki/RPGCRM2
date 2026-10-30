import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import type { Database } from "../../db/client";
import { RoutineRefusedError, type RoutineStore } from "../../routines/store";
import type { CrmRecords } from "../records";
import { LEAD_SOURCE } from "./leads";
import {
  type ProspectingConfig,
  savedProfile,
  spentThisMonth,
} from "./settings";

type Variables = { Variables: AppVariables };

// Mondays at 8:00 in the person's own time zone.
const WEEKLY = "0 8 * * 1";
const LEADS_PER_LIST = 15;

// The routine is found again by this first line, so keep it stable.
const FIRST_LINE = "Build this week's lead list.";

/** What the weekly routine, and Find leads now, ask the Bot to do. Under the 2,000 characters a routine allows. */
export const LEAD_LIST_INSTRUCTION = [
  FIRST_LINE,
  "1. Call customer_profile. If there's a saved profile, use it. If not, write one from the facts: who to look for, the signals that matter, who to leave out. Save it with save_customer_profile. With no saved profile and no won deals, ask the person to describe their best customers and stop.",
  `2. Find about ${LEADS_PER_LIST} companies that fit and aren't customers yet. Use find_data_tools to pick lookups for company discovery and buying signals (for example brands running many paid social ads), read prices with data_tool_details, and call them with look_up_data.`,
  "3. For each company, find one decision maker with treg.people.search, then their work email with treg.people.email.find and verify set to true. Leave out people whose email doesn't verify.",
  "4. Give each lead one or two sentences on why it fits, naming the signal you found.",
  "5. Add them all with one add_leads call named after today's date. Don't email anyone.",
  "Stop if the lookup budget runs out, add what you have, and say how far you got and what it cost.",
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
    const [routine, spent, profile, leads] = await Promise.all([
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
    ]);
    return context.json({
      data: {
        available: !!deps.prospecting.tregApiKey,
        botId: deps.primaryBotId,
        instruction: LEAD_LIST_INSTRUCTION,
        leadSource: LEAD_SOURCE,
        profile,
        leadsThisWeek: leads,
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
