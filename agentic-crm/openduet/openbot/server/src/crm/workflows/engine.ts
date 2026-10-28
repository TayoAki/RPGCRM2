import { timingSafeEqual } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../../db/client";
import { CrmRefusal } from "../records";
import {
  companies,
  contactNotes,
  contacts,
  dealNotes,
  deals,
  emails,
  meetings,
  proposals,
  recordEvents,
  sales,
  tasks,
  workflowFirings,
  workflowRuns,
  workflows,
} from "../schema";
import { groupHolds } from "./conditions";
import type { Step, Trigger, WorkflowObject } from "./definition";
import type { RunContext, RunTrigger, ScopeLoader } from "./scope";
import { asStepError, executeStep, type StepDeps } from "./steps";

type Row = Record<string, unknown>;
type WorkflowRow = typeof workflows.$inferSelect;
type RunRow = typeof workflowRuns.$inferSelect;
type Cursor = (number | "if_true" | "if_false")[];

const TABLES: Record<WorkflowObject, PgTable> = {
  contacts,
  companies,
  deals,
  tasks,
  contact_notes: contactNotes,
  deal_notes: dealNotes,
  meetings,
  proposals,
  emails,
};

// Automations started by automations stop here, so two of them can't feed each other forever.
export const MAX_DEPTH = 5;
const MAX_TRIES = 3;
const RETRY_AFTER_MS = [60_000, 10 * 60_000];
const STEPS_PER_CLAIM = 50;
const LEASE = "5 minutes";
const EVENTS_PER_PASS = 200;
const SCHEDULE_GRACE_MS = 10 * 60_000;
const DATE_LOOKBACK = "1 day";
const MAX_FAN_OUT = 1000;
const SCAN_PAGE = 500;
const MAX_SCAN = 50_000;
const MAX_LOG = 200;

/** The date and time fields of each object a date trigger can watch. */
export const DATE_FIELDS: Record<WorkflowObject, string[]> = Object.fromEntries(
  Object.entries(TABLES).map(([object, table]) => [
    object,
    Object.entries(getTableColumns(table))
      .filter(([, column]) =>
        /timestamp|^date$/.test((column as PgColumn).getSQLType()),
      )
      .map(([name]) => name),
  ]),
) as Record<WorkflowObject, string[]>;

/** A trigger that names a field its object doesn't have is refused when saved. */
export function checkTrigger(trigger: Trigger): string | null {
  if (
    trigger.type === "date" &&
    !DATE_FIELDS[trigger.object].includes(trigger.field)
  ) {
    return `${trigger.object} has no date field ${trigger.field}. Use one of ${DATE_FIELDS[trigger.object].join(", ")}.`;
  }
  return null;
}

function listAt(steps: Step[], prefix: Cursor): Step[] {
  let list = steps;
  for (let index = 0; index < prefix.length; index += 2) {
    const parent = list[prefix[index] as number];
    if (parent?.type !== "if") return [];
    list = parent[prefix[index + 1] as "if_true" | "if_false"];
  }
  return list;
}

export function stepAt(steps: Step[], cursor: Cursor): Step | undefined {
  return listAt(steps, cursor.slice(0, -1))[cursor.at(-1) as number];
}

/** The step after this one, leaving finished branches; past the last step when the run is done. */
export function advance(steps: Step[], cursor: Cursor): Cursor {
  const prefix = cursor.slice(0, -1);
  const next = [...prefix, (cursor.at(-1) as number) + 1];
  if (prefix.length === 0 || stepAt(steps, next)) return next;
  return advance(steps, prefix.slice(0, -1));
}

function enter(
  steps: Step[],
  cursor: Cursor,
  branch: "if_true" | "if_false",
): Cursor {
  const inside: Cursor = [...cursor, branch, 0];
  return stepAt(steps, inside) ? inside : advance(steps, cursor);
}

// workflow:<id>:<run> from the event's actor.
function workflowOrigin(actor: string | null) {
  const match = /^workflow:(\d+):(\d+)$/.exec(actor ?? "");
  return match
    ? { workflowId: Number(match[1]), runId: Number(match[2]) }
    : null;
}

export const sameToken = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Runs automations. Every pass is safe on several replicas at once: events and runs are claimed with
 * `for update skip locked`, and date and schedule firings are written once each.
 */
export function createWorkflowEngine(
  deps: StepDeps & { scopes: ScopeLoader; owner: string },
) {
  const { database, scopes } = deps;

  async function startRun(
    workflow: WorkflowRow,
    trigger: RunTrigger,
    depth = 0,
    runner: Database = database,
  ): Promise<number> {
    const [run] = await runner
      .insert(workflowRuns)
      .values({
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        definition: workflow.steps,
        trigger,
        context: { steps: {}, links: {} } satisfies RunContext,
        depth,
      })
      .returning({ id: workflowRuns.id });
    if (!run) throw new Error("Could not start the run.");
    return run.id;
  }

  const enabledWith = async (type: Trigger["type"]) =>
    (
      await database.select().from(workflows).where(eq(workflows.enabled, true))
    ).filter((workflow) => (workflow.trigger as Trigger).type === type);

  async function dispatchEvents(): Promise<number> {
    return database.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      const events = await tx
        .select()
        .from(recordEvents)
        .where(isNull(recordEvents.processed_at))
        .orderBy(asc(recordEvents.id))
        .limit(EVENTS_PER_PASS)
        .for("update", { skipLocked: true });
      if (events.length === 0) return 0;
      const watching = (
        await tx.select().from(workflows).where(eq(workflows.enabled, true))
      ).filter((workflow) => (workflow.trigger as Trigger).type === "record");
      const { title, ...options } = await scopes.options();
      for (const event of events) {
        const matching = watching.filter((workflow) => {
          const trigger = workflow.trigger as Extract<
            Trigger,
            { type: "record" }
          >;
          return (
            trigger.object === event.object &&
            trigger.on.includes(
              event.action as "created" | "updated" | "deleted",
            )
          );
        });
        if (matching.length === 0) continue;
        const origin = workflowOrigin(event.actor);
        const [parent] = origin
          ? await tx
              .select({ depth: workflowRuns.depth })
              .from(workflowRuns)
              .where(eq(workflowRuns.id, origin.runId))
          : [];
        const depth = parent ? parent.depth + 1 : 0;
        if (depth > MAX_DEPTH) continue;
        const trigger: RunTrigger = {
          object: event.object as WorkflowObject,
          recordId: event.record_id,
          action: event.action,
          previous: (event.old as Row | null) ?? null,
          ...(event.action === "deleted" ? { snapshot: event.old as Row } : {}),
        };
        const scope = await scopes.load(trigger, { steps: {} }, title);
        for (const workflow of matching) {
          if (origin?.workflowId === workflow.id) continue;
          const when = (
            workflow.trigger as Extract<Trigger, { type: "record" }>
          ).when;
          if (!groupHolds(when, scope as unknown as Row, options)) continue;
          await startRun(workflow, trigger, depth, tx);
        }
      }
      await tx
        .update(recordEvents)
        .set({ processed_at: sql`now()` })
        .where(
          inArray(
            recordEvents.id,
            events.map((event) => event.id),
          ),
        );
      return events.length;
    });
  }

  async function fireOnce(
    workflowId: number,
    recordId: number,
    moment: string,
  ) {
    const [fired] = await database
      .insert(workflowFirings)
      .values({ workflow_id: workflowId, record_id: recordId, moment })
      .onConflictDoNothing()
      .returning({ id: workflowFirings.workflow_id });
    return Boolean(fired);
  }

  async function sweepDates(): Promise<number> {
    let started = 0;
    const { title, ...options } = await scopes.options();
    for (const workflow of await enabledWith("date")) {
      const trigger = workflow.trigger as Extract<Trigger, { type: "date" }>;
      if (checkTrigger(trigger)) continue;
      const table = TABLES[trigger.object];
      const columns = getTableColumns(table) as Record<string, PgColumn>;
      const field = columns[trigger.field] as PgColumn;
      const firesAt = sql`(${field}::timestamptz + make_interval(mins => ${trigger.offset_minutes}))`;
      const since = sql`greatest(${workflow.enabled_at ?? new Date().toISOString()}::timestamptz, now() - ${DATE_LOOKBACK}::interval)`;
      const rows = (await database
        .select()
        .from(table)
        .where(
          and(
            sql`${firesAt} > ${since}`,
            sql`${firesAt} <= now()`,
            // A moment that passed before the record existed isn't a reminder anyone wants.
            columns.created_at
              ? sql`${firesAt} >= ${columns.created_at}`
              : sql`true`,
          ),
        )
        .limit(MAX_FAN_OUT)) as Row[];
      for (const row of rows) {
        const runTrigger: RunTrigger = {
          object: trigger.object,
          recordId: Number(row.id),
        };
        const scope = await scopes.load(runTrigger, { steps: {} }, title);
        if (!groupHolds(trigger.when, scope as unknown as Row, options))
          continue;
        if (
          !(await fireOnce(
            workflow.id,
            Number(row.id),
            String(row[trigger.field]),
          ))
        )
          continue;
        await startRun(workflow, runTrigger);
        started++;
      }
    }
    return started;
  }

  async function sweepSchedules(now = new Date()): Promise<number> {
    let started = 0;
    const { timezone, currency } = await scopes.options();
    for (const workflow of await enabledWith("schedule")) {
      const trigger = workflow.trigger as Extract<
        Trigger,
        { type: "schedule" }
      >;
      const due = CronExpressionParser.parse(trigger.cron, {
        tz: trigger.timezone ?? timezone,
        currentDate: now,
      })
        .prev()
        .toDate();
      const earliest = Math.max(
        Date.parse(workflow.enabled_at ?? now.toISOString()),
        now.getTime() - SCHEDULE_GRACE_MS,
      );
      if (due.getTime() < earliest) continue;
      const moment = due.toISOString();
      if (!trigger.object) {
        if (await fireOnce(workflow.id, 0, moment)) {
          await startRun(workflow, {});
          started++;
        }
        continue;
      }
      const table = TABLES[trigger.object];
      const id = (getTableColumns(table) as Record<string, PgColumn>)
        .id as PgColumn;
      let after = 0;
      let fannedOut = 0;
      for (let scanned = 0; scanned < MAX_SCAN && fannedOut < MAX_FAN_OUT; ) {
        const rows = (await database
          .select()
          .from(table)
          .where(sql`${id} > ${after}`)
          .orderBy(asc(id))
          .limit(SCAN_PAGE)) as Row[];
        for (const row of rows) {
          // Only the record's own fields: loading everything about every record each minute won't do.
          if (
            !groupHolds(trigger.when, { record: row }, { timezone, currency })
          )
            continue;
          if (!(await fireOnce(workflow.id, Number(row.id), moment))) continue;
          await startRun(workflow, {
            object: trigger.object,
            recordId: Number(row.id),
          });
          started++;
          if (++fannedOut >= MAX_FAN_OUT) break;
        }
        scanned += rows.length;
        if (rows.length < SCAN_PAGE) break;
        after = Number(rows.at(-1)?.id);
      }
    }
    return started;
  }

  async function claim(limit: number): Promise<RunRow[]> {
    const due = sql`select id from ${workflowRuns}
      where (status in ('queued', 'waiting') and wake_at <= now())
         or (status = 'running' and lease_until < now())
      order by wake_at limit ${limit} for update skip locked`;
    return (await database
      .update(workflowRuns)
      .set({
        status: "running",
        lease_until: sql`now() + ${LEASE}::interval`,
        claimed_by: deps.owner,
        attempts: sql`${workflowRuns.attempts} + 1`,
      })
      .where(sql`${workflowRuns.id} in (${due})`)
      .returning()) as RunRow[];
  }

  async function execute(run: RunRow) {
    const [workflow] = await database
      .select({
        id: workflows.id,
        name: workflows.name,
        sales_id: workflows.sales_id,
        user_id: sales.user_id,
      })
      .from(workflows)
      .leftJoin(sales, eq(sales.id, workflows.sales_id))
      .where(eq(workflows.id, run.workflow_id));
    if (!workflow) return;
    const steps = run.definition as Step[];
    const context = run.context as RunContext;
    context.links ??= {};
    let cursor = run.cursor as Cursor;
    // This step's try, counting this one: claims count them, a finished step starts the next at one.
    let tries = run.attempts;
    const log = [...((run.log as Row[]) ?? [])];
    const options = await scopes.options();
    const actor = {
      service: "workflow",
      salesId: workflow.sales_id,
      workflow: { id: workflow.id, runId: run.id },
    };
    const save = (values: Partial<typeof workflowRuns.$inferInsert>) =>
      database
        .update(workflowRuns)
        .set({ cursor, context, log: log.slice(-MAX_LOG), ...values })
        .where(eq(workflowRuns.id, run.id));
    const note = (step: Step, status: string, message: string) =>
      log.push({
        at: new Date().toISOString(),
        step: step.id,
        type: step.type,
        status,
        message,
      });

    for (let count = 0; count < STEPS_PER_CLAIM; count++) {
      const step = stepAt(steps, cursor);
      if (!step) {
        await save({
          status: "completed",
          finished_at: sql`now()` as never,
          error: null,
        });
        return;
      }
      const scope = await scopes.load(
        run.trigger as RunTrigger,
        context,
        options.title,
      );
      try {
        const outcome = await executeStep(
          {
            step,
            scope,
            options,
            actor,
            runId: run.id,
            workflow: {
              id: workflow.id,
              name: workflow.name,
              ownerUserId: workflow.user_id,
            },
            previous: context.steps[step.id],
            remember: async (output) => {
              context.steps[step.id] = output;
              await save({});
            },
          },
          deps,
        );
        note(step, outcome.kind, outcome.message);
        tries = 1;
        switch (outcome.kind) {
          case "done":
            context.steps[step.id] = outcome.output ?? true;
            Object.assign(context.links, outcome.links ?? {});
            cursor = advance(steps, cursor);
            break;
          case "skipped":
            cursor = advance(steps, cursor);
            break;
          case "branch":
            cursor = enter(steps, cursor, outcome.branch);
            break;
          case "stop":
            await save({
              status: "completed",
              finished_at: sql`now()` as never,
              error: null,
            });
            return;
          case "wait":
            cursor = advance(steps, cursor);
            await save({
              status: "waiting",
              wake_at: outcome.until,
              attempts: 0,
              error: null,
            });
            return;
        }
        await save({
          attempts: 1,
          lease_until: sql`now() + ${LEASE}::interval` as never,
        });
      } catch (error) {
        const failure = asStepError(error);
        note(step, "failed", failure.message);
        if (failure.retryable && tries < MAX_TRIES) {
          const wait = RETRY_AFTER_MS[tries - 1] ?? 60_000;
          await save({
            status: "waiting",
            wake_at: new Date(Date.now() + wait).toISOString(),
            attempts: tries,
            error: failure.message,
          });
        } else {
          await save({
            status: "failed",
            error: failure.message,
            finished_at: sql`now()` as never,
          });
        }
        return;
      }
    }
    await save({ status: "queued", wake_at: sql`now()` as never, attempts: 0 });
  }

  async function runDue(limit = 10): Promise<number> {
    const runs = await claim(limit);
    for (const run of runs) {
      await execute(run).catch(async (error) => {
        await database
          .update(workflowRuns)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            finished_at: sql`now()`,
          })
          .where(eq(workflowRuns.id, run.id));
      });
    }
    return runs.length;
  }

  return {
    startRun,
    dispatchEvents,
    sweepDates,
    sweepSchedules,
    runDue,

    /** A person ran a manual automation on a record. */
    async runManually(workflowId: number, recordId: number) {
      const [workflow] = await database
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId));
      const trigger = workflow?.trigger as Trigger | undefined;
      if (!workflow || trigger?.type !== "manual") {
        throw new CrmRefusal("That automation isn't run by hand.", 400);
      }
      if (!workflow.enabled) {
        throw new CrmRefusal("That automation is switched off.", 400);
      }
      return startRun(workflow, {
        object: trigger.object,
        recordId,
        action: "manual",
      });
    },

    /** An outside system called a webhook automation's address. */
    async receiveWebhook(workflowId: number, token: string, payload: unknown) {
      const [workflow] = await database
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId));
      if (
        !workflow?.enabled ||
        (workflow.trigger as Trigger).type !== "webhook" ||
        !sameToken(workflow.webhook_token, token)
      ) {
        return null;
      }
      return startRun(workflow, { payload, action: "webhook" });
    },

    async cancel(runId: number) {
      const [run] = await database
        .update(workflowRuns)
        .set({ status: "canceled", finished_at: sql`now()` })
        .where(
          and(
            eq(workflowRuns.id, runId),
            inArray(workflowRuns.status, ["queued", "waiting"]),
          ),
        )
        .returning({ id: workflowRuns.id });
      if (!run)
        throw new CrmRefusal(
          "Only a run that is waiting can be canceled.",
          400,
        );
    },

    /** Processed events older than a week are dropped: runs keep what they need. */
    async purgeEvents() {
      await database
        .delete(recordEvents)
        .where(sql`${recordEvents.processed_at} < now() - interval '7 days'`);
    },
  };
}

export type WorkflowEngine = ReturnType<typeof createWorkflowEngine>;
