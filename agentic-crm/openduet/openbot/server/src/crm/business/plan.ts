import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { describeCron, nextOccurrence } from "../../routines/schedule";
import type { RoutineSummary } from "../../routines/store";
import { ensureRow, readConfig } from "../prospecting/settings";

/*
 * The work plan: the specialist Bots a Bot proposed from the company brief, and the standing jobs
 * each one does. The plan is the company's; each job runs as a routine of whoever turns it on, on
 * its Bot, found again by its first line.
 */

const KEY = "work_plan";
const MAX_ITEMS = 10;
const MAX_TEAM = 5;
// Bots with up to 12 tools are offered all of them on every run (plugins/selection.ts).
export const MAX_BOT_TOOLS = 10;
// Routines allow 2,000 characters; the first line is the marker.
const MAX_INSTRUCTION = 1800;

export type TeamMember = {
  key: string;
  name: string;
  title: string;
  role: string;
  /** Tool refs (`<server>/<tool>`) this Bot is granted, out of what the planning Bot holds. */
  tools: string[];
  /** The write tools an admin let it use without asking. */
  allowed: string[];
  /** Set once the Bot exists. */
  botId?: string;
};

export type PlanItem = {
  id: string;
  title: string;
  why: string;
  cron: string;
  instruction: string;
  /** The team member that does it; absent runs on the main Bot. */
  bot?: string;
  /** The write tools this job uses, offered as "can do without asking". */
  actions: string[];
};

export type WorkPlan = {
  team: TeamMember[];
  items: PlanItem[];
  savedAt: string;
  savedBy: string | null;
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

// Models often name a CRM tool without its app; anything else still needs the full ref.
const toolRef = z
  .string()
  .trim()
  .transform((ref) => (ref.includes("/") ? ref : `crm/${ref}`))
  .pipe(
    z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9_.-]*\/[A-Za-z0-9_.-]+$/,
        "is not a tool ref like crm/find_bids",
      ),
  );

export const planSchema = z.object({
  team: z
    .array(
      z.object({
        key: z.string().trim().max(40).optional(),
        name: z.string().trim().min(1).max(40),
        title: z.string().trim().min(1).max(80),
        role: z.string().trim().min(1).max(1000),
        tools: z.array(toolRef).min(1).max(MAX_BOT_TOOLS),
      }),
    )
    .max(MAX_TEAM)
    .default([]),
  items: z
    .array(
      z.object({
        id: z.string().trim().max(40).optional(),
        title: z.string().trim().min(1).max(80),
        why: z.string().trim().min(1).max(300),
        cron: z.string().trim().min(9).max(60),
        instruction: z.string().trim().min(1).max(MAX_INSTRUCTION),
        bot: z.string().trim().max(40).optional(),
        actions: z.array(toolRef).max(8).default([]),
      }),
    )
    .min(1)
    .max(MAX_ITEMS),
});

/** The first line of the routine an item runs as. */
export const markerOf = (item: Pick<PlanItem, "id" | "title">) =>
  `Work plan item ${item.id}: ${item.title}.`;

export const routineInstruction = (item: PlanItem) =>
  `${markerOf(item)}\n${item.instruction}`;

export function routineFor<
  TRoutine extends Pick<RoutineSummary, "instruction">,
>(item: Pick<PlanItem, "id">, routines: TRoutine[]): TRoutine | null {
  const prefix = `Work plan item ${item.id}:`;
  return (
    routines.find((routine) => routine.instruction.startsWith(prefix)) ?? null
  );
}

/** How many times a schedule fires in the next 30 days, at most 120. */
export function runsPerMonth(cron: string, timezone = "UTC", now = new Date()) {
  const end = now.getTime() + 30 * 86_400_000;
  let at = now;
  let runs = 0;
  while (runs < 120) {
    at = nextOccurrence(cron, timezone, at);
    if (at.getTime() > end) break;
    runs += 1;
  }
  return runs;
}

export type PlanCheck =
  | { ok: true; plan: PlanItem[]; team: TeamMember[] }
  | { ok: false; message: string };

const uniqueSlug = (text: string, seen: Set<string>, fallback: string) => {
  const base = slug(text) || fallback;
  let id = base;
  for (let n = 2; seen.has(id); n += 1) id = `${base}-${n}`;
  seen.add(id);
  return id;
};

/**
 * Validates a proposed plan: ids and team keys are unique slugs, every job's Bot is on the team and
 * every action is one of its tools, and every schedule is one routines accept. A team member that
 * keeps its key keeps its Bot and what an admin allowed, while those tools are still its jobs'.
 */
export function checkPlan(
  input: unknown,
  previous: WorkPlan | null = null,
  now = new Date(),
): PlanCheck {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: `The plan isn't valid: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    };
  }
  const keys = new Set<string>();
  const team: TeamMember[] = parsed.data.team.map((member) => {
    const key = uniqueSlug(member.key || member.name, keys, "bot");
    const before = previous?.team.find((each) => each.key === key);
    return {
      key,
      name: member.name,
      title: member.title,
      role: member.role,
      tools: [...new Set(member.tools)],
      allowed: before?.allowed ?? [],
      ...(before?.botId ? { botId: before.botId } : {}),
    };
  });
  const seen = new Set<string>();
  const plan: PlanItem[] = [];
  for (const item of parsed.data.items) {
    const id = uniqueSlug(item.id || item.title, seen, "job");
    const member = item.bot
      ? team.find((each) => each.key === slug(item.bot ?? ""))
      : undefined;
    if (item.bot && !member) {
      return {
        ok: false,
        message: `"${item.title}" is given to ${item.bot}, who isn't on the team.`,
      };
    }
    const missing = item.actions.find(
      (action) => member && !member.tools.includes(action),
    );
    if (member && missing) {
      return {
        ok: false,
        message: `"${item.title}" uses ${missing}, which isn't one of ${member.name}'s tools.`,
      };
    }
    try {
      nextOccurrence(item.cron, "UTC", now);
    } catch (error) {
      return {
        ok: false,
        message: `"${item.title}" has a schedule routines can't run (${item.cron}): ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    plan.push({
      id,
      title: item.title,
      why: item.why,
      cron: item.cron,
      instruction: item.instruction,
      ...(member ? { bot: member.key } : {}),
      actions: [...new Set(item.actions)],
    });
  }
  for (const member of team) {
    const used = new Set(
      plan
        .filter((item) => item.bot === member.key)
        .flatMap((item) => item.actions),
    );
    member.allowed = member.allowed.filter((ref) => used.has(ref));
  }
  return { ok: true, plan, team };
}

export async function readPlan(database: Database): Promise<WorkPlan | null> {
  const saved = (await readConfig(database))[KEY] as
    | Partial<WorkPlan>
    | undefined;
  return Array.isArray(saved?.items) && saved.items.length
    ? {
        team: Array.isArray(saved.team) ? saved.team : [],
        items: (saved.items as PlanItem[]).map((item) => ({
          ...item,
          actions: item.actions ?? [],
        })),
        savedAt: String(saved.savedAt ?? ""),
        savedBy: saved.savedBy ?? null,
      }
    : null;
}

export async function savePlan(
  database: Database,
  content: Pick<WorkPlan, "team" | "items">,
  savedBy: string | null,
  now: Date = new Date(),
): Promise<WorkPlan> {
  const plan = { ...content, savedAt: now.toISOString(), savedBy };
  await ensureRow(database);
  await database.execute(sql`
    update crm.configuration
    set config = jsonb_set(coalesce(config, '{}'::jsonb), ${`{${KEY}}`}::text[], ${JSON.stringify(plan)}::text::jsonb)
    where id = 1`);
  return plan;
}

/** What a person sees of one item. */
export function itemSummary(item: PlanItem, timezone = "UTC") {
  return {
    id: item.id,
    title: item.title,
    why: item.why,
    schedule: describeCron(item.cron),
    runs_per_month: runsPerMonth(item.cron, timezone),
  };
}

/** Records a team member's Bot, or what it may do without asking, on the saved plan. */
export async function updateMember(
  database: Database,
  key: string,
  patch: Partial<Pick<TeamMember, "botId" | "allowed">>,
): Promise<WorkPlan | null> {
  const plan = await readPlan(database);
  if (!plan?.team.some((member) => member.key === key)) return plan;
  return savePlan(
    database,
    {
      team: plan.team.map((member) =>
        member.key === key ? { ...member, ...patch } : member,
      ),
      items: plan.items,
    },
    plan.savedBy,
    new Date(plan.savedAt || Date.now()),
  );
}
