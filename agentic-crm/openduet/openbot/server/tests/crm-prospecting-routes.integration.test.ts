import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import { createProspectingRoutes } from "../src/crm/prospecting/routes";
import { createCrmRecords } from "../src/crm/records";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import type { RoutineInput } from "../src/routines/store";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `prospect-routes-${run}`,
  email: `routes-${run}@acme.test`,
  name: "Rae Routes",
};
const actor = { ...PERSON, image: null, role: "user" as const };

const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
  context,
  next,
) => {
  context.set("actor", actor as never);
  await next();
};

function routesWith(key: string | undefined) {
  const made: (RoutineInput & { id: string })[] = [];
  const routines = {
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
          enabled: true,
          nextRunAt: new Date("2026-11-02T16:00:00Z"),
        })) as never,
    remove: async (_owner: string, id: string) => {
      made.splice(
        made.findIndex((routine) => routine.id === id),
        1,
      );
    },
  };
  const app = createProspectingRoutes({
    requireUser,
    database,
    records: createCrmRecords(database),
    prospecting: { tregApiKey: key, monthlyBudgetUsd: 10 },
    routines,
    directChannel: async () => ({ id: "channel-1" }),
    primaryBotId: "magpie",
  });
  return { app, made };
}

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
});

afterAll(async () => {
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

test("the weekly lead list is turned on once, in the person's time zone, and off again", async () => {
  const { app, made } = routesWith("treg-key");

  const before = await (await app.request("/")).json();
  const on = await app.request("/routine", {
    method: "POST",
    body: JSON.stringify({ timezone: "America/Los_Angeles" }),
    headers: { "content-type": "application/json" },
  });
  const again = await app.request("/routine", { method: "POST" });
  const after = await (await app.request("/")).json();
  await app.request("/routine", { method: "DELETE" });

  expect(before.data).toMatchObject({
    available: true,
    botId: "magpie",
    routine: null,
    budget: { monthlyUsd: 10 },
  });
  expect(before.data.instruction).toStartWith("Build this week's lead list.");
  expect(on.status).toBe(201);
  expect(made).toHaveLength(0);
  expect(again.status).toBe(409);
  expect(after.data.routine).toMatchObject({ id: "routine-1", enabled: true });
});

test("the routine runs as the primary Bot in the person's direct channel, Mondays at 8", async () => {
  const { app, made } = routesWith("treg-key");
  await app.request("/routine", {
    method: "POST",
    body: JSON.stringify({ timezone: "Europe/Paris" }),
    headers: { "content-type": "application/json" },
  });
  expect(made[0]).toMatchObject({
    ownerUserId: PERSON.id,
    agentId: "magpie",
    channelId: "channel-1",
    cron: "0 8 * * 1",
    timezone: "Europe/Paris",
  });
});

test("without a data catalog key it can't be turned on", async () => {
  const { app } = routesWith(undefined);
  const status = await (await app.request("/")).json();
  const on = await app.request("/routine", { method: "POST" });
  expect(status.data.available).toBe(false);
  expect(on.status).toBe(409);
});
