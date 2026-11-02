import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import { callTool, useCrmTools } from "../src/crm/agent-tools";
import { readPlan } from "../src/crm/business/plan";
import { createWorkPlanRoutes } from "../src/crm/business/routes";
import { createCrmRecords } from "../src/crm/records";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import type { RoutineInput } from "../src/routines/store";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `work-team-${run}`,
  email: `team-${run}@acme.test`,
  name: "Tam Team",
};
let role: "admin" | "user" = "admin";
const actor = () => ({ ...PERSON, image: null, role });
const connection = {
  url: "builtin://crm/",
  actorId: PERSON.id,
  botId: "magpie",
};
type Json = Record<string, unknown>;

const HELD = [
  "crm/find_bids",
  "crm/track_bid",
  "crm/list_bids",
  "crm/create_record",
];

const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
  context,
  next,
) => {
  context.set("actor", actor() as never);
  await next();
};

const made: (RoutineInput & { id: string })[] = [];
const bots: Json[] = [];
const grants: string[] = [];
type Rule = {
  id: string;
  botId: string;
  toolRef: string;
  effect: string;
  scope: string;
  behaviour: string;
};
let rules: Rule[] = [];

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
          ...routine,
          schedule: "Mondays at 07:30",
          enabled: true,
          nextRunAt: new Date(),
          lastRun: null,
        })) as never,
    remove: async (_owner: string, id: string) => {
      made.splice(
        made.findIndex((routine) => routine.id === id),
        1,
      );
    },
  },
  directChannel: async (_owner, agentId) => ({ id: `dm-${agentId}` }),
  primaryBotId: "magpie",
  bots: {
    create: async (_actor, input) => {
      const bot = { ...input, id: `bot-${bots.length + 1}` };
      bots.push(bot);
      return bot;
    },
    exists: async (_actor, id) => bots.some((bot) => bot.id === id),
  },
  heldTools: async () => HELD,
  grant: async (ref, botId) => {
    grants.push(`${botId} ${ref}`);
  },
  rules: {
    teamRules: async () => rules,
    createTeamRule: async (_by, input) => {
      rules.push({ ...input, id: `rule-${rules.length + 1}` });
    },
    revokeTeamRule: async (_by, id) => {
      rules = rules.filter((rule) => rule.id !== id);
    },
  },
});

const request = async (path: string, method = "GET", body?: unknown) => {
  const response = await app.request(path, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
  return { status: response.status, json: (await response.json()) as Json };
};

async function call(tool: string, args: Json) {
  const result = await callTool(connection, tool, args);
  return {
    ...result,
    json: result.isError ? null : (JSON.parse(result.text) as Json),
  };
}

const reset = () =>
  database.execute(
    sql`update crm.configuration set config = config - 'work_plan' where id = 1`,
  );

const BIDS = {
  key: "bids",
  name: "Bid desk",
  title: "Finds and tracks government bids",
  role: "Finds open bids that fit the brief and tracks the good ones.",
  tools: ["crm/find_bids", "crm/track_bid", "crm/list_bids", "crm/update_bid"],
};

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
  useCrmTools({
    database,
    roleOf: async () => "admin",
    heldTools: async () => HELD,
  });
  await reset();
});

afterAll(async () => {
  useCrmTools(null);
  await reset();
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

test("a plan only gives team Bots tools the planning Bot holds, and jobs only to Bots on the team", async () => {
  const unknownTool = await call("save_work_plan", {
    team: [BIDS],
    items: [
      {
        title: "Find bids",
        why: "Fills the pipeline.",
        cron: "30 7 * * 1",
        instruction: "Find bids.",
        bot: "bids",
      },
    ],
  });
  const unknownBot = await call("save_work_plan", {
    team: [{ ...BIDS, tools: ["crm/find_bids"] }],
    items: [
      {
        title: "Find bids",
        why: "Fills the pipeline.",
        cron: "30 7 * * 1",
        instruction: "Find bids.",
        bot: "sales",
      },
    ],
  });
  const brief = await call("business_brief", {});

  expect(unknownTool.text).toContain("crm/update_bid isn't a tool you hold");
  expect(unknownBot.text).toContain("given to sales, who isn't on the team");
  expect((brief.json as { tools: Json[] }).tools).toEqual([
    {
      app: "crm",
      tools: ["find_bids", "track_bid", "list_bids", "create_record"],
      writes: ["track_bid", "create_record"],
    },
  ]);
});

test("turning a job on makes its Bot once, with only its tools, asking before changes except what an admin allowed", async () => {
  const saved = await call("save_work_plan", {
    team: [
      { ...BIDS, tools: ["crm/find_bids", "crm/track_bid", "crm/list_bids"] },
    ],
    items: [
      {
        title: "Find bids",
        why: "Fills the pipeline.",
        cron: "30 7 * * 1",
        instruction: "Find this week's bids.",
        bot: "bids",
        actions: ["crm/track_bid"],
      },
      {
        title: "Friday bid review",
        why: "Nothing slips.",
        cron: "0 15 * * 5",
        instruction: "Review tracked bids.",
        bot: "bids",
      },
      {
        title: "Pipeline review",
        why: "Keeps deals moving.",
        cron: "0 16 * * 5",
        instruction: "Review deals.",
      },
    ],
  });
  const first = await request("/items/find-bids", "POST", {
    timezone: "America/Chicago",
    withoutAsking: ["crm/track_bid"],
  });
  const second = await request("/items/friday-bid-review", "POST", {
    timezone: "America/Chicago",
  });
  const main = await request("/items/pipeline-review", "POST", {});
  const view = await request("/");

  expect(saved.json).toMatchObject({ team: ["Bid desk"] });
  expect(first.status).toBe(201);
  expect(bots).toEqual([
    expect.objectContaining({
      id: "bot-1",
      name: "Bid desk",
      visibility: "public",
      systemPrompt: expect.stringContaining(
        "You are Bid desk, Finds and tracks government bids",
      ),
    }),
  ]);
  expect(grants).toEqual([
    "bot-1 crm/find_bids",
    "bot-1 crm/track_bid",
    "bot-1 crm/list_bids",
  ]);
  expect(
    rules.map(({ botId, toolRef, behaviour }) => [botId, toolRef, behaviour]),
  ).toEqual([
    ["bot-1", "*", "ask"],
    ["bot-1", "crm/track_bid", "allow"],
  ]);
  expect(made.map((routine) => [routine.agentId, routine.channelId])).toEqual([
    ["bot-1", "dm-bot-1"],
    ["bot-1", "dm-bot-1"],
    ["magpie", "dm-magpie"],
  ]);
  expect(second.json).toMatchObject({ data: { botId: "bot-1" } });
  expect(main.json).toMatchObject({ data: { botId: "magpie" } });
  expect(view.json).toMatchObject({
    data: {
      canAllow: true,
      plan: {
        team: [{ key: "bids", name: "Bid desk", botId: "bot-1", tools: 3 }],
        items: [
          {
            id: "find-bids",
            bot: "bids",
            on: true,
            actions: [
              { ref: "crm/track_bid", label: "Track bid", withoutAsking: true },
            ],
          },
          { id: "friday-bid-review", bot: "bids", on: true, actions: [] },
          { id: "pipeline-review", bot: null, on: true },
        ],
      },
    },
  });
});

test("only an admin lets a Bot act without asking, and turning it back on can take that away", async () => {
  await request("/items/find-bids", "DELETE");
  role = "user";
  const refused = await request("/items/find-bids", "POST", {
    withoutAsking: ["crm/track_bid"],
  });
  role = "admin";
  const again = await request("/items/find-bids", "POST", {
    withoutAsking: [],
  });
  const plan = await readPlan(database);

  expect(refused.status).toBe(403);
  expect(again.status).toBe(201);
  expect(rules.map(({ toolRef, behaviour }) => [toolRef, behaviour])).toEqual([
    ["*", "ask"],
  ]);
  expect(plan?.team[0]).toMatchObject({ botId: "bot-1", allowed: [] });
  expect(bots).toHaveLength(1);
});
