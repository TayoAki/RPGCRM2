import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables, AuthenticatedActor } from "../../auth/guards";
import { RoutineRefusedError, type RoutineStore } from "../../routines/store";
import type { CrmRecords } from "../records";
import { readBrief } from "./brief";
import {
  itemSummary,
  type PlanItem,
  readPlan,
  routineFor,
  routineInstruction,
  type WorkPlan,
} from "./plan";
import { weekReport } from "./report";
import { actionLabel, ensureBot, syncAllowed, type TeamDeps } from "./team";

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

/** What "Plan the Bots' work" asks the Bot to do. */
export const PLAN_INSTRUCTION = [
  "Plan the team of Bots and the standing work they do for this business.",
  "1. Call business_brief. With no brief, ask the person about the business and save one first.",
  "2. Propose 3 to 7 jobs that move the brief's goals, using only the tools business_brief lists. Good ones: a weekly lead list or bid search; morning inbox triage with reply drafts, if mail is connected; prep before each day's meetings, if the calendar is; a nudge on deals or bids with no activity in 14 days; a Friday pipeline review. Leave out jobs you lack the tools for, and say what to connect to get them.",
  "3. Group the jobs into 2 to 4 specialist Bots by area, such as Front desk, Sales or Bookkeeping. Give each a name, a one-line title, a standing role, and only the tools its jobs need, at most 10.",
  "4. For each job give a title, why it serves a goal, its Bot, a five-field cron in the person's time zone, the whole instruction its Bot gets when it runs, and the write tools it uses as actions. Every write still asks the person unless an admin lets that Bot do it without asking.",
  "5. Keep the plan under about 100 runs a month, and say the total.",
  "6. Show the team and the jobs as a short list, then save them with save_work_plan. Tell the person to turn jobs on from Today, which creates each Bot.",
].join("\n");

export function createWorkPlanRoutes(
  deps: {
    requireUser: MiddlewareHandler<Variables>;
    records: CrmRecords;
    routines: Pick<RoutineStore, "create" | "listFor" | "remove">;
    directChannel: (
      ownerUserId: string,
      agentId: string,
    ) => Promise<{ id: string }>;
  } & Pick<TeamDeps, "database" | "primaryBotId"> &
    Partial<Omit<TeamDeps, "database" | "primaryBotId">>,
) {
  const routes = new Hono<Variables>();
  routes.use("*", deps.requireUser);
  const team: TeamDeps | null =
    deps.bots && deps.heldTools && deps.grant && deps.rules
      ? {
          database: deps.database,
          primaryBotId: deps.primaryBotId,
          bots: deps.bots,
          heldTools: deps.heldTools,
          grant: deps.grant,
          rules: deps.rules,
        }
      : null;

  const timezoneOf = (body: unknown) => {
    const timezone = (body as { timezone?: unknown } | null)?.timezone;
    return typeof timezone === "string" && timezone.length < 64
      ? timezone
      : "UTC";
  };

  /** The Bot an item runs on: its team member's, made when first needed, or the main Bot. */
  async function botFor(
    actor: AuthenticatedActor,
    plan: WorkPlan,
    item: PlanItem,
  ) {
    const member = plan.team.find((each) => each.key === item.bot);
    if (!member || !team) return { botId: deps.primaryBotId, member: null };
    const { botId } = await ensureBot(team, actor, member);
    return { botId, member: { ...member, botId } };
  }

  async function turnOn(
    actor: AuthenticatedActor,
    plan: WorkPlan,
    item: PlanItem,
    timezone: string,
  ) {
    const { botId, member } = await botFor(actor, plan, item);
    const channel = await deps.directChannel(actor.id, botId);
    const routine = await deps.routines.create({
      ownerUserId: actor.id,
      agentId: botId,
      channelId: channel.id,
      instruction: routineInstruction(item),
      cron: item.cron,
      timezone,
    });
    return { routine, botId, member };
  }

  routes.get("/", async (context) => {
    const actor = context.var.actor;
    const [brief, plan, routines, salesId] = await Promise.all([
      readBrief(deps.database),
      readPlan(deps.database),
      deps.routines.listFor(actor.id),
      deps.records
        .sale(actor)
        .then((sale) => sale.id)
        .catch(() => null),
    ]);
    const items = (plan?.items ?? []).map((item) => {
      const routine = routineFor(item, routines);
      const summary = itemSummary(item, routine?.timezone);
      const member = plan?.team.find((each) => each.key === item.bot);
      return {
        id: item.id,
        title: item.title,
        why: item.why,
        bot: member?.key ?? null,
        schedule: routine?.schedule ?? summary.schedule,
        runsPerMonth: summary.runs_per_month,
        on: !!routine,
        nextRunAt: routine?.nextRunAt ?? null,
        lastRun: routine?.lastRun ?? null,
        actions: item.actions.map((ref) => ({
          ref,
          label: actionLabel(ref),
          withoutAsking: !!member?.allowed.includes(ref),
        })),
      };
    });
    return context.json({
      data: {
        botId: deps.primaryBotId,
        canAllow: actor.role === "admin" && !!team,
        brief: brief && {
          updatedAt: brief.updatedAt,
          preview: brief.text.slice(0, 280),
        },
        plan: plan && {
          savedAt: plan.savedAt,
          team: plan.team.map((member) => ({
            key: member.key,
            name: member.name,
            title: member.title,
            botId: member.botId ?? null,
            tools: member.tools.length,
          })),
          items,
        },
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
    const body = (await context.req.json().catch(() => null)) as {
      timezone?: unknown;
      withoutAsking?: unknown;
    } | null;
    const plan = await readPlan(deps.database);
    const item = plan?.items.find(
      (each) => each.id === context.req.param("id"),
    );
    if (!plan || !item)
      return context.json({ error: "That job isn't in the plan." }, 404);
    const chosen = Array.isArray(body?.withoutAsking)
      ? body.withoutAsking.filter(
          (ref): ref is string =>
            typeof ref === "string" && item.actions.includes(ref),
        )
      : null;
    if (chosen?.length && actor.role !== "admin") {
      return context.json(
        { error: "Only an admin can let a Bot act without asking." },
        403,
      );
    }
    if (routineFor(item, await deps.routines.listFor(actor.id))) {
      return context.json({ error: "That job is already on." }, 409);
    }
    try {
      const { routine, botId, member } = await turnOn(
        actor,
        plan,
        item,
        timezoneOf(body),
      );
      if (member && team && chosen && actor.role === "admin") {
        const others = member.allowed.filter(
          (ref) => !item.actions.includes(ref),
        );
        await syncAllowed(team, actor, member, botId, [...others, ...chosen]);
      }
      return context.json({ data: { id: routine.id, botId } }, 201);
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
    const timezone = timezoneOf(await context.req.json().catch(() => null));
    const routines = await deps.routines.listFor(actor.id);
    let turnedOn = 0;
    for (const item of plan.items) {
      if (routineFor(item, routines)) continue;
      try {
        // Re-read, so a Bot made for one job is reused by the next.
        await turnOn(
          actor,
          (await readPlan(deps.database)) ?? plan,
          item,
          timezone,
        );
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
      await deps.routines.listFor(actor.id),
    );
    if (routine) await deps.routines.remove(actor.id, routine.id);
    return context.json({ data: { removed: !!routine } });
  });

  return routes;
}
