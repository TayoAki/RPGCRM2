import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import { callTool, listTools, useCrmTools } from "../src/crm/agent-tools";
import { withBusinessBrief } from "../src/crm/business/brief";
import { createWorkPlanRoutes } from "../src/crm/business/routes";
import { createCrmRecords } from "../src/crm/records";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import type { RoutineInput } from "../src/routines/store";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `work-plan-${run}`,
  email: `plan-${run}@acme.test`,
  name: "Pia Plan",
};
const actor = { ...PERSON, image: null, role: "admin" as const };
const connection = { url: "builtin://crm/", actorId: PERSON.id, botId: "bot" };
type Json = Record<string, unknown>;

const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
  context,
  next,
) => {
  context.set("actor", actor as never);
  await next();
};

const made: (RoutineInput & { id: string })[] = [];
const app = createWorkPlanRoutes({
  requireUser,
  database,
  records: createCrmRecords(database),
  routines: {
    create: async (input: RoutineInput) => {
      const routine = { ...input, id: `routine-${made.length + 1}` };
      made.push(routine);
      return routine as never;
    },
    listFor: async (owner: string) =>
      made
        .filter((routine) => routine.ownerUserId === owner)
        .map((routine) => ({
          id: routine.id,
          agentId: routine.agentId,
          instruction: routine.instruction,
          schedule: "Mondays at 08:00",
          timezone: routine.timezone,
          enabled: true,
          nextRunAt: new Date("2026-11-09T16:00:00Z"),
          lastRun: null,
        })) as never,
    remove: async (_owner: string, id: string) => {
      made.splice(
        made.findIndex((routine) => routine.id === id),
        1,
      );
    },
  },
  directChannel: async () => ({ id: "channel-1" }),
  primaryBotId: "magpie",
});

async function call(tool: string, args: Json = {}) {
  const result = await callTool(connection, tool, args);
  return {
    ...result,
    json: result.isError ? null : (JSON.parse(result.text) as Json),
  };
}

const request = (path: string, method = "GET", body?: unknown) =>
  app.request(path, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });

const reset = () =>
  database.execute(
    sql`update crm.configuration set config = config - 'business_brief' - 'work_plan' where id = 1`,
  );

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
  useCrmTools({ database, roleOf: async () => "admin" });
  await reset();
});

afterAll(async () => {
  useCrmTools(null);
  await reset();
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

const BRIEF = [
  "What we do: UGC video ads for DTC skincare brands, $3k to $12k a month.",
  "Who we sell to: Heads of growth at Shopify brands doing $2M to $20M.",
  "Goals right now: 4 new retainers by January.",
  "Never: promise view counts.",
].join("\n");

test("every Bot gets the business tools, and the brief rides with each person's instructions", async () => {
  const names = (await listTools()).map((tool) => tool.name);
  const empty = await call("business_brief");
  await call("save_business_brief", { brief: BRIEF });
  const read = await call("business_brief");

  expect(names).toEqual(
    expect.arrayContaining([
      "business_brief",
      "save_business_brief",
      "save_work_plan",
    ]),
  );
  expect(empty.json).toMatchObject({ brief: null, work_plan: null });
  expect(read.json).toMatchObject({
    brief: BRIEF,
    crm: { open_deals: expect.any(Number) },
  });
  expect(
    await withBusinessBrief(
      database,
      Promise.resolve("Write in British English."),
    ),
  ).toBe(
    `The company brief, which every Bot here works from:\n${BRIEF}\n\nThis person's own instructions: Write in British English.`,
  );
  expect(await withBusinessBrief(database, Promise.resolve(null))).toBe(
    `The company brief, which every Bot here works from:\n${BRIEF}`,
  );
});

test("a saved plan is switched on from Today, one job or all, as the person's own routines", async () => {
  const refused = await call("save_work_plan", {
    items: [
      {
        title: "Inbox triage",
        why: "Replies faster.",
        cron: "every morning",
        instruction: "Triage.",
      },
    ],
  });
  const saved = await call("save_work_plan", {
    items: [
      {
        title: "Monday lead list",
        why: "Feeds the 4-retainer goal.",
        cron: "0 8 * * 1",
        instruction: "Build this week's lead list.",
      },
      {
        title: "Friday pipeline review",
        why: "Keeps deals moving.",
        cron: "0 16 * * 5",
        instruction: "Review the pipeline.",
      },
    ],
  });
  const before = (await (await request("/")).json()) as { data: Json };
  const one = await request("/items/monday-lead-list", "POST", {
    timezone: "America/Chicago",
  });
  const again = await request("/items/monday-lead-list", "POST", {});
  const all = (await (
    await request("/on", "POST", { timezone: "America/Chicago" })
  ).json()) as { data: Json };
  const after = (await (await request("/")).json()) as { data: Json };
  const routinesMade = made.map((routine) => [
    routine.cron,
    routine.timezone,
    routine.instruction.split("\n")[0],
  ]);
  await request("/items/monday-lead-list", "DELETE");
  const off = (await (await request("/")).json()) as {
    data: { plan: { items: Json[] } };
  };

  expect(refused.text).toContain('"Inbox triage"');
  expect(saved.json).toMatchObject({ runs_per_month: expect.any(Number) });
  expect(before.data).toMatchObject({
    botId: "magpie",
    brief: { preview: BRIEF.slice(0, 280) },
    plan: {
      items: [
        { id: "monday-lead-list", on: false },
        { id: "friday-pipeline-review", on: false },
      ],
    },
    runsPerMonthOn: 0,
    runsPerSeat: 400,
    week: { botRuns: { total: 0 }, waiting: { drafts: expect.any(Number) } },
  });
  expect(one.status).toBe(201);
  expect(again.status).toBe(409);
  expect(all.data).toEqual({ turnedOn: 1 });
  expect(routinesMade).toEqual([
    [
      "0 8 * * 1",
      "America/Chicago",
      "Work plan item monday-lead-list: Monday lead list.",
    ],
    [
      "0 16 * * 5",
      "America/Chicago",
      "Work plan item friday-pipeline-review: Friday pipeline review.",
    ],
  ]);
  expect((after.data.runsPerMonthOn as number) > 0).toBe(true);
  expect(off.data.plan.items.map((item) => item.on)).toEqual([false, true]);
});
