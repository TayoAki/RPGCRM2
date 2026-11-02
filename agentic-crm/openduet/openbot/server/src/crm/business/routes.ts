import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import type { Database } from "../../db/client";
import { RoutineRefusedError, type RoutineStore } from "../../routines/store";
import type { CrmRecords } from "../records";
import { readBrief } from "./brief";
import {
  itemSummary,
  type PlanItem,
  readPlan,
  routineFor,
  routineInstruction,
} from "./plan";
import { weekReport } from "./report";

type Variables = { Variables: AppVariables };

// Team's included runs per seat (COGS.md), for the estimate next to the plan.
const RUNS_PER_SEAT = 400;

/** What "Tell Magpie about your business" asks the Bot to do. */
export const BRIEF_INSTRUCTION = [
  "Get to know this business and write its company brief.",
  "1. Call business_brief. If there is a brief, show it and ask what changed.",
  "2. Learn what you can before asking: the CRM's won deals and biggest companies, and, if you can read them, recent mail and the company's website.",
  "3. Then ask the person, a few questions at a time and only what you couldn't find: what the business sells and for how much; who buys (industry, size, role, place); how it wins work today; its goals for the next 90 days, with numbers; how it talks to customers; and what Bots must never do.",
  "4. Write the brief in these sections: What we do, Who we sell to, How we win work, Goals right now, How we talk, Never. Use only what you found or were told. Show it, then save it with save_business_brief.",
  "5. Offer to plan the work next.",
].join("\n");

/** What "Plan Magpie's work" asks the Bot to do. */
export const PLAN_INSTRUCTION = [
  "Plan the standing work Bots should do for this business.",
  "1. Call business_brief. With no brief, ask the person about the business and save one first.",
  "2. Propose 3 to 7 jobs that move the brief's goals, each using only tools you can see. Good ones: a weekly lead list, if you have lead list tools and the weekly lead list on Today isn't already on; morning inbox triage with reply drafts, if you can read mail; prep before each day's meetings, if you can read the calendar; a nudge on deals with no activity in 14 days; a Friday pipeline review; a weekly search for government bids, if you have find_bids. Leave out jobs you lack the tools for, and say what to connect to get them.",
  "3. For each job give a title, why it serves a goal, a schedule as a five-field cron in the person's time zone, and the whole instruction the Bot will get when it runs. Anything that writes to the CRM or sends must still ask the person first.",
  "4. Keep the plan under about 100 runs a month, and say the total.",
  "5. Show the plan as a short list, then save it with save_work_plan. Tell the person to turn jobs on from Today.",
].join("\n");

export function createWorkPlanRoutes(deps: {
  requireUser: MiddlewareHandler<Variables>;
  database: Database;
  records: CrmRecords;
  routines: Pick<RoutineStore, "create" | "listFor" | "remove">;
  directChannel: (
    ownerUserId: string,
    agentId: string,
  ) => Promise<{ id: string }>;
  primaryBotId: string;
}) {
  const routes = new Hono<Variables>();
  routes.use("*", deps.requireUser);

  const mine = async (ownerUserId: string) =>
    (await deps.routines.listFor(ownerUserId)).filter(
      (routine) => routine.agentId === deps.primaryBotId,
    );

  const timezoneOf = async (body: Promise<unknown>) => {
    const parsed = (await body.catch(() => ({}))) as { timezone?: unknown };
    return typeof parsed.timezone === "string" && parsed.timezone.length < 64
      ? parsed.timezone
      : "UTC";
  };

  async function turnOn(ownerUserId: string, item: PlanItem, timezone: string) {
    const channel = await deps.directChannel(ownerUserId, deps.primaryBotId);
    return deps.routines.create({
      ownerUserId,
      agentId: deps.primaryBotId,
      channelId: channel.id,
      instruction: routineInstruction(item),
      cron: item.cron,
      timezone,
    });
  }

  routes.get("/", async (context) => {
    const actor = context.var.actor;
    const [brief, plan, routines, salesId] = await Promise.all([
      readBrief(deps.database),
      readPlan(deps.database),
      mine(actor.id),
      deps.records
        .sale(actor)
        .then((sale) => sale.id)
        .catch(() => null),
    ]);
    const items = (plan?.items ?? []).map((item) => {
      const routine = routineFor(item, routines);
      const summary = itemSummary(item, routine?.timezone);
      return {
        id: item.id,
        title: item.title,
        why: item.why,
        schedule: routine?.schedule ?? summary.schedule,
        runsPerMonth: summary.runs_per_month,
        on: !!routine,
        nextRunAt: routine?.nextRunAt ?? null,
        lastRun: routine?.lastRun ?? null,
      };
    });
    return context.json({
      data: {
        botId: deps.primaryBotId,
        brief: brief && {
          updatedAt: brief.updatedAt,
          preview: brief.text.slice(0, 280),
        },
        plan: plan && { savedAt: plan.savedAt, items },
        runsPerMonthOn: items
          .filter((item) => item.on)
          .reduce((sum, item) => sum + item.runsPerMonth, 0),
        runsPerSeat: RUNS_PER_SEAT,
        instructions: { brief: BRIEF_INSTRUCTION, plan: PLAN_INSTRUCTION },
        week: await weekReport(deps.database, { userId: actor.id, salesId }),
      },
    });
  });

  routes.post("/items/:id", async (context) => {
    const actor = context.var.actor;
    const item = (await readPlan(deps.database))?.items.find(
      (each) => each.id === context.req.param("id"),
    );
    if (!item)
      return context.json({ error: "That job isn't in the plan." }, 404);
    if (routineFor(item, await mine(actor.id))) {
      return context.json({ error: "That job is already on." }, 409);
    }
    try {
      const routine = await turnOn(
        actor.id,
        item,
        await timezoneOf(context.req.json()),
      );
      return context.json({ data: { id: routine.id } }, 201);
    } catch (error) {
      if (error instanceof RoutineRefusedError) {
        return context.json({ error: error.message }, 409);
      }
      throw error;
    }
  });

  routes.post("/on", async (context) => {
    const actor = context.var.actor;
    const plan = await readPlan(deps.database);
    if (!plan) return context.json({ error: "There's no plan yet." }, 404);
    const timezone = await timezoneOf(context.req.json());
    const routines = await mine(actor.id);
    let turnedOn = 0;
    for (const item of plan.items) {
      if (routineFor(item, routines)) continue;
      try {
        await turnOn(actor.id, item, timezone);
        turnedOn += 1;
      } catch (error) {
        if (error instanceof RoutineRefusedError) {
          return context.json(
            { error: `${item.title}: ${error.message}`, turnedOn },
            409,
          );
        }
        throw error;
      }
    }
    return context.json({ data: { turnedOn } });
  });

  routes.delete("/items/:id", async (context) => {
    const actor = context.var.actor;
    const routine = routineFor(
      { id: context.req.param("id") },
      await mine(actor.id),
    );
    if (routine) await deps.routines.remove(actor.id, routine.id);
    return context.json({ data: { removed: !!routine } });
  });

  return routes;
}
