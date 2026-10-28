import { afterAll, beforeAll, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import type { AuthenticatedActor } from "../src/auth/guards";
import { crmFollowUps, withCrmFollowUps } from "../src/crm/brief";
import { createCrmRecords } from "../src/crm/records";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const records = createCrmRecords(database);
const run = crypto.randomUUID().slice(0, 8);
const NOW = new Date("2026-06-15T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (offset: number) => new Date(NOW.getTime() + offset).toISOString();

const person = (name: string): AuthenticatedActor => ({
  id: `crm-brief-${name}-${run}`,
  email: `${name}-${run}@acme.test`,
  name,
  role: "user",
});
const MAYA = person("maya");
const OTHER = person("other");
const NEWCOMER = person("newcomer");

type Row = Record<string, unknown>;
const create = async (actor: AuthenticatedActor, resource: string, data: Row) =>
  (await records.create(actor, resource, data)) as Row;

beforeAll(async () => {
  await database.insert(users).values(
    [MAYA, OTHER, NEWCOMER].map(({ id, email, name }) => ({
      id,
      email,
      name,
      emailVerified: false,
    })),
  );
});

afterAll(async () => {
  await database
    .delete(users)
    .where(inArray(users.id, [MAYA.id, OTHER.id, NEWCOMER.id]));
  await database.$client.end({ timeout: 5 });
});

test("the brief lists a person's due tasks, stalled deals and cooling hot contacts", async () => {
  const ada = await create(MAYA, "contacts", {
    first_name: "Ada",
    last_name: `Brief${run}`,
    status: "hot",
    last_seen: at(-10 * DAY),
  });
  await create(MAYA, "contacts", {
    first_name: "Recent",
    last_name: `Brief${run}`,
    status: "hot",
    last_seen: at(-2 * DAY),
  });
  await create(MAYA, "contacts", {
    first_name: "Warm",
    last_name: `Brief${run}`,
    status: "warm",
    last_seen: at(-30 * DAY),
  });
  const task = (text: string, due: number, extra: Row = {}) => ({
    contact_id: ada.id,
    text,
    due_date: at(due),
    ...extra,
  });
  const overdue = await create(MAYA, "tasks", task("Send the quote", -3 * DAY));
  const soon = await create(MAYA, "tasks", task("Call back", 5 * HOUR));
  await create(MAYA, "tasks", task("Later", 3 * DAY));
  await create(MAYA, "tasks", task("Done", -DAY, { done_date: at(-HOUR) }));
  await create(OTHER, "tasks", task("Not Maya's", -DAY));
  const deal = (name: string, stage: string, updated: number) => ({
    name: `${name} ${run}`,
    stage,
    updated_at: at(updated),
  });
  const stalled = await create(
    MAYA,
    "deals",
    deal("Zeppelins", "proposal-sent", -20 * DAY),
  );
  await create(MAYA, "deals", deal("Won", "won", -20 * DAY));
  await create(MAYA, "deals", deal("Fresh", "opportunity", -DAY));

  const items = await crmFollowUps(database, MAYA.id, NOW);

  expect(
    items.map(({ id, title, why, href }) => ({ id, title, why, href })),
  ).toEqual([
    {
      id: `task-${overdue.id}`,
      title: `Send the quote · Ada Brief${run}`,
      why: "Overdue by 3 days",
      href: `/crm/contacts/${ada.id}/show`,
    },
    {
      id: `task-${soon.id}`,
      title: `Call back · Ada Brief${run}`,
      why: "Due in 5 hours",
      href: `/crm/contacts/${ada.id}/show`,
    },
    {
      id: `deal-${stalled.id}`,
      title: `Zeppelins ${run}`,
      why: "Proposal sent, no change in 20 days",
      href: `/crm/deals/${stalled.id}/show`,
    },
    {
      id: `contact-${ada.id}`,
      title: `Ada Brief${run}`,
      why: "Hot, last contact 10 days ago",
      href: `/crm/contacts/${ada.id}/show`,
    },
  ]);
});

test("someone who has never opened the CRM gets no CRM rows, and no CRM user is made", async () => {
  const brief = await withCrmFollowUps(database, NEWCOMER.id, {
    couldNotCheck: [],
  });

  expect(brief).toEqual({ couldNotCheck: [] });
  const { total } = await records.list("sales", {
    filter: { user_id: NEWCOMER.id },
  });
  expect(total).toBe(0);
});
