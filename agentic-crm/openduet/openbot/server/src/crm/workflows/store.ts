import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { CrmRefusal } from "../records";
import { installs, workflowRuns, workflows } from "../schema";
import { type WorkflowInput, workflowInput } from "./definition";
import { checkTrigger } from "./engine";
import { RECIPES } from "./recipes";

const RECIPES_INSTALL = "workflow-recipes";
const RUNS_PER_PAGE = 25;

type WorkflowRow = typeof workflows.$inferSelect;

const parse = (body: unknown): WorkflowInput => {
  const input = workflowInput.parse(body);
  const problem = checkTrigger(input.trigger);
  if (problem) throw new CrmRefusal(problem, 400);
  return input;
};

const withNeeds = (row: WorkflowRow) => ({
  ...row,
  needs: RECIPES.find((recipe) => recipe.key === row.recipe)?.needs ?? [],
});

export function createWorkflowStore(deps: { database: Database }) {
  const { database } = deps;

  const find = async (id: number) => {
    const [row] = await database
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    if (!row) throw new CrmRefusal("Not found.", 404);
    return row;
  };

  return {
    async list() {
      const rows = await database
        .select()
        .from(workflows)
        .orderBy(workflows.id);
      const counts = rows.length
        ? await database
            .select({
              workflow_id: workflowRuns.workflow_id,
              status: workflowRuns.status,
              runs: count(),
            })
            .from(workflowRuns)
            .where(
              and(
                inArray(
                  workflowRuns.workflow_id,
                  rows.map((row) => row.id),
                ),
                sql`${workflowRuns.created_at} > now() - interval '30 days'`,
              ),
            )
            .groupBy(workflowRuns.workflow_id, workflowRuns.status)
        : [];
      return rows.map((row) => ({
        ...withNeeds(row),
        runs: Object.fromEntries(
          counts
            .filter((entry) => entry.workflow_id === row.id)
            .map((entry) => [entry.status, entry.runs]),
        ),
      }));
    },

    get: async (id: number) => withNeeds(await find(id)),

    async create(salesId: number, body: unknown) {
      const input = parse(body);
      const [row] = await database
        .insert(workflows)
        .values({
          ...input,
          sales_id: salesId,
          enabled_at: input.enabled ? new Date().toISOString() : null,
        })
        .returning();
      if (!row) throw new Error("Could not save the automation.");
      return withNeeds(row);
    },

    /** Saves a change. New steps or a new trigger are a new version; runs underway keep theirs. */
    async update(id: number, body: unknown) {
      const current = await find(id);
      const input = parse({ ...current, ...(body as object) });
      const changed =
        JSON.stringify(current.trigger) !== JSON.stringify(input.trigger) ||
        JSON.stringify(current.steps) !== JSON.stringify(input.steps);
      const switchedOn = input.enabled && !current.enabled;
      const [row] = await database
        .update(workflows)
        .set({
          name: input.name,
          description: input.description,
          trigger: input.trigger,
          steps: input.steps,
          enabled: input.enabled,
          version: changed ? current.version + 1 : current.version,
          // A trigger counts from when it was switched on, so nothing fires for the past.
          ...(switchedOn ? { enabled_at: new Date().toISOString() } : {}),
        })
        .where(eq(workflows.id, id))
        .returning();
      if (!row) throw new CrmRefusal("Not found.", 404);
      return withNeeds(row);
    },

    async remove(id: number) {
      await find(id);
      await database.delete(workflows).where(eq(workflows.id, id));
    },

    async runs(workflowId: number, page = 1) {
      const where = eq(workflowRuns.workflow_id, workflowId);
      const [rows, [total]] = await Promise.all([
        database
          .select({
            id: workflowRuns.id,
            status: workflowRuns.status,
            trigger: workflowRuns.trigger,
            error: workflowRuns.error,
            wake_at: workflowRuns.wake_at,
            created_at: workflowRuns.created_at,
            finished_at: workflowRuns.finished_at,
            workflow_version: workflowRuns.workflow_version,
          })
          .from(workflowRuns)
          .where(where)
          .orderBy(desc(workflowRuns.id))
          .limit(RUNS_PER_PAGE)
          .offset((Math.max(1, page) - 1) * RUNS_PER_PAGE),
        database.select({ total: count() }).from(workflowRuns).where(where),
      ]);
      return { data: rows, total: total?.total ?? 0 };
    },

    async run(id: number) {
      const [row] = await database
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, id));
      if (!row) throw new CrmRefusal("Not found.", 404);
      return row;
    },

    /** The ready-made automations, made once per deployment and switched off. */
    async installRecipes(salesId: number | null = null) {
      const [done] = await database
        .select({ name: installs.name })
        .from(installs)
        .where(eq(installs.name, RECIPES_INSTALL));
      if (done) return;
      for (const { key, needs: _, ...recipe } of RECIPES) {
        const [existing] = await database
          .select({ id: workflows.id })
          .from(workflows)
          .where(eq(workflows.recipe, key));
        if (existing) continue;
        await database
          .insert(workflows)
          .values({ ...recipe, recipe: key, sales_id: salesId });
      }
      await database
        .insert(installs)
        .values({ name: RECIPES_INSTALL })
        .onConflictDoNothing();
    },
  };
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>;
