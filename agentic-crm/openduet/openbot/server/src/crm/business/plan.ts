import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { describeCron, nextOccurrence } from "../../routines/schedule";
import type { RoutineSummary } from "../../routines/store";
import { ensureRow, readConfig } from "../prospecting/settings";

/*
 * The work plan: the standing jobs a Bot proposed from the company brief. The plan is the company's;
 * each item runs as a routine of whoever turns it on, found again by its first line.
 */

const KEY = "work_plan";
const MAX_ITEMS = 10;
// Routines allow 2,000 characters; the first line is the marker.
const MAX_INSTRUCTION = 1800;

export type PlanItem = {
  id: string;
  title: string;
  why: string;
  cron: string;
  instruction: string;
};

export type WorkPlan = {
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

export const planSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().max(40).optional(),
        title: z.string().trim().min(1).max(80),
        why: z.string().trim().min(1).max(300),
        cron: z.string().trim().min(9).max(60),
        instruction: z.string().trim().min(1).max(MAX_INSTRUCTION),
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
  | { ok: true; plan: PlanItem[] }
  | { ok: false; message: string };

/** Validates a proposed plan: ids are unique slugs, and every schedule is one routines accept. */
export function checkPlan(input: unknown, now = new Date()): PlanCheck {
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
  const seen = new Set<string>();
  const plan: PlanItem[] = [];
  for (const item of parsed.data.items) {
    const base = slug(item.id || item.title) || "job";
    let id = base;
    for (let n = 2; seen.has(id); n += 1) id = `${base}-${n}`;
    seen.add(id);
    try {
      nextOccurrence(item.cron, "UTC", now);
    } catch (error) {
      return {
        ok: false,
        message: `"${item.title}" has a schedule routines can't run (${item.cron}): ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    plan.push({ ...item, id });
  }
  return { ok: true, plan };
}

export async function readPlan(database: Database): Promise<WorkPlan | null> {
  const saved = (await readConfig(database))[KEY] as
    | Partial<WorkPlan>
    | undefined;
  return Array.isArray(saved?.items) && saved.items.length
    ? {
        items: saved.items as PlanItem[],
        savedAt: String(saved.savedAt ?? ""),
        savedBy: saved.savedBy ?? null,
      }
    : null;
}

export async function savePlan(
  database: Database,
  items: PlanItem[],
  savedBy: string | null,
  now: Date = new Date(),
): Promise<WorkPlan> {
  const plan = { items, savedAt: now.toISOString(), savedBy };
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
