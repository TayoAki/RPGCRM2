import { afterAll, beforeAll, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import type { AuthenticatedActor } from "../src/auth/guards";
import { crmFollowUps, withCrm } from "../src/crm/brief";
import { createCrmRecords } from "../src/crm/records";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import {
  buildMorningBrief,
  type CallTool,
  GMAIL_SEARCH,
} from "../src/openduet/brief";
import { setUpdatedAt } from "./support/crm";
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
  const deal = async (name: string, stage: string, updated: number) => {
    const made = await create(MAYA, "deals", { name: `${name} ${run}`, stage });
    await setUpdatedAt(database, "deals", made.id, at(updated));
    return made;
  };
  const stalled = await deal("Zeppelins", "proposal-sent", -20 * DAY);
  await deal("Won", "won", -20 * DAY);
  await deal("Fresh", "opportunity", -DAY);

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
  const empty = { needsYou: [], canWait: [], couldNotCheck: [] };
  const brief = await withCrm(database, NEWCOMER.id, empty);

  expect(brief).toEqual(empty);
  const { total } = await records.list(
    { service: "test", salesId: null },
    "sales",
    {
      filter: { user_id: NEWCOMER.id },
    },
  );
  expect(total).toBe(0);
});

test("mail from a CRM contact says who they are in the CRM, whatever the address's case", async () => {
  const company = await create(MAYA, "companies", { name: `Hearth ${run}` });
  const ana = await create(MAYA, "contacts", {
    first_name: "Ana",
    last_name: `Pereira${run}`,
    company_id: company.id,
    email_jsonb: [{ email: `ana.${run}@hearth.test`, type: "Work" }],
  });
  const mail = (id: string, from: string) => ({
    id,
    threadId: `t-${id}`,
    from,
    to: [MAYA.email],
    cc: [],
    subject: `Subject ${id}`,
    date: NOW.toISOString(),
    snippet: "Can you confirm Friday?",
    labels: ["INBOX"],
    headers: {},
  });
  const callTool: CallTool = async ({ ref }) => ({
    text: JSON.stringify(
      ref === GMAIL_SEARCH
        ? {
            messages: [
              mail("m1", `Ana Pereira <Ana.${run}@Hearth.test>`),
              mail("m2", `Someone Else <someone-${run}@elsewhere.test>`),
            ],
          }
        : { events: [] },
    ),
    isError: false,
  });

  const brief = await withCrm(
    database,
    MAYA.id,
    await buildMorningBrief(
      {
        callTool,
        model: "test-model",
        now: () => NOW,
        complete: async () =>
          '{"verdict":"needs_you","reason":"Needs an answer."}',
      },
      {
        actorId: MAYA.id,
        botId: "openduet",
        initiator: { kind: "person" },
        person: { name: "Maya", email: MAYA.email },
      },
    ),
  );

  expect(
    brief.needsYou.map((item) => ({
      id: item.id,
      crm: "crm" in item ? item.crm : null,
    })),
  ).toEqual([
    {
      id: "m1",
      crm: {
        contactId: ana.id,
        name: `Ana Pereira${run}`,
        company: `Hearth ${run}`,
      },
    },
    { id: "m2", crm: null },
  ]);
});
