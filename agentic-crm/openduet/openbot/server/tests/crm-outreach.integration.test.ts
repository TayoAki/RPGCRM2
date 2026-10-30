import { afterAll, beforeAll, expect, test } from "bun:test";
import { and, eq, isNull, sql } from "drizzle-orm";
import { callTool, useCrmTools } from "../src/crm/agent-tools";
import { OPT_OUT } from "../src/crm/prospecting/outreach";
import { createCrmRecords } from "../src/crm/records";
import { emails, mailboxes } from "../src/crm/schema";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `crm-outreach-${run}`,
  email: `outreach-${run}@acme.test`,
  name: "Otto Outreach",
};
const actor = { ...PERSON, image: null, role: "admin" as const };
const connection = { url: "builtin://crm/", actorId: PERSON.id, botId: "bot" };
type Json = Record<string, unknown>;
let saleId = 0;

async function call(tool: string, args: Json) {
  const result = await callTool(connection, tool, args);
  return {
    ...result,
    json: result.isError ? null : (JSON.parse(result.text) as Json),
  };
}

async function contact(name: string, email?: string, tags: number[] = []) {
  const { json } = await call("create_record", {
    resource: "contacts",
    values: {
      first_name: name,
      last_name: run,
      tags,
      email_jsonb: email ? [{ email, type: "Work" }] : [],
    },
  });
  return (json as { created: Json }).created.id as number;
}

const tagNames = async (contactId: number) => {
  const records = createCrmRecords(database);
  const row = await records.get(actor, "contacts", contactId);
  const ids = (row?.tags as number[]) ?? [];
  const { data } = await records.list(actor, "tags", {
    filter: { "id@in": `(${ids.join(",") || 0})` },
  });
  return data.map((tag) => tag.name);
};

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
  useCrmTools({
    database,
    roleOf: async () => "admin",
    prospecting: { tregApiKey: "key", monthlyBudgetUsd: 5 },
  });
  saleId = (await createCrmRecords(database).sale(actor)).id;
  await database.execute(
    sql`update crm.configuration set config = config - 'outreach_footer' where id = 1`,
  );
});

afterAll(async () => {
  useCrmTools(null);
  await database.delete(emails).where(eq(emails.sales_id, saleId));
  await database.delete(mailboxes).where(eq(mailboxes.sales_id, saleId));
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

test("a contact's tier is one tag that scoring replaces, with the reason as a note", async () => {
  const id = await contact("Tia", `tia-${run}@nova.example`);

  await call("score_leads", {
    scores: [
      {
        contact_id: id,
        tier: "A",
        score: 91,
        reason: "Commented on two posts about UGC ads.",
      },
    ],
  });
  const { json } = await call("score_leads", {
    scores: [
      {
        contact_id: id,
        tier: "B",
        reason: "Company is smaller than the profile.",
      },
    ],
  });

  expect(json).toMatchObject({ scored: { A: 0, B: 1, C: 0, D: 0 } });
  const names = await tagNames(id);
  expect(names).toContain("ICP tier B");
  expect(names).not.toContain("ICP tier A");
  const { json: read } = await call("get_record", { resource: "contacts", id });
  expect(JSON.stringify((read as Json).recent_notes)).toContain(
    "ICP tier A (91/100): Commented on two posts about UGC ads.",
  );
});

test("drafts need the sender's postal address, and skip people who can't be emailed", async () => {
  const ready = await contact("Ray", `ray-${run}@nova.example`);
  const noEmail = await contact("Nia");
  const records = createCrmRecords(database);
  const existing = await records.list(actor, "tags", {
    filter: { name: "Do not contact" },
  });
  const blockedTag = Number(
    existing.data[0]?.id ??
      (
        await records.create(actor, "tags", {
          name: "Do not contact",
          color: "#eeeeee",
        })
      ).id,
  );
  const blocked = await contact("Bo", `bo-${run}@nova.example`, [blockedTag]);
  const email = {
    subject: "Your UGC post",
    body: "Hi Ray, saw your comment on creator ads.",
  };

  const refused = await call("draft_outreach", {
    emails: [{ contact_id: ready, ...email }],
  });
  await call("save_outreach_footer", {
    footer: "UGC Mediakits, 1 Main St, Austin TX 78701",
  });
  const { json } = await call("draft_outreach", {
    emails: [
      { contact_id: ready, ...email },
      { contact_id: noEmail, ...email },
      { contact_id: blocked, ...email },
    ],
  });
  const again = await call("draft_outreach", {
    emails: [{ contact_id: ready, ...email }],
  });

  expect(refused.text).toContain("postal address");
  const result = json as { drafted: Json[]; skipped: Json[] };
  expect(result.drafted).toHaveLength(1);
  expect(result.skipped.map((each) => each.why)).toEqual([
    "No email address",
    "Tagged Do not contact",
  ]);
  expect((again.json as { skipped: Json[] }).skipped[0]?.why).toBe(
    "Already emailed in the last 30 days",
  );
  const [row] = await database
    .select()
    .from(emails)
    .where(eq(emails.id, result.drafted[0]?.email_id as number));
  expect(row).toMatchObject({
    status: "draft",
    to_address: `ray-${run}@nova.example`,
  });
  expect(row?.body).toEndWith(
    `${OPT_OUT}\nUGC Mediakits, 1 Main St, Austin TX 78701`,
  );
});

test("sending needs a mailbox, spaces the emails out and stops at the daily limit", async () => {
  const first = await contact("Ana", `ana-${run}@one.example`);
  const second = await contact("Ben", `ben-${run}@two.example`);
  const { json } = await call("draft_outreach", {
    emails: [
      { contact_id: first, subject: "Hi", body: "One." },
      { contact_id: second, subject: "Hi", body: "Two." },
    ],
  });
  const ids = (json as { drafted: { email_id: number }[] }).drafted.map(
    (draft) => draft.email_id,
  );

  const shared = await database
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(isNull(mailboxes.sales_id));
  // Another suite's shared mailbox would send for everybody, so this half only runs without one.
  const noMailbox = shared.length
    ? null
    : await call("send_outreach", { email_ids: ids });
  await database.insert(mailboxes).values({
    sales_id: saleId,
    from_address: `otto-${run}@ugc.example`,
    smtp_host: "smtp.example",
    smtp_user: "otto",
    smtp_password: "sealed",
  });
  await database.insert(emails).values(
    Array.from({ length: 49 }, (_, index) => ({
      direction: "out",
      status: "sent",
      to_address: `old-${index}@past.example`,
      sales_id: saleId,
      send_at: new Date().toISOString(),
    })),
  );
  const sent = await call("send_outreach", {
    email_ids: [...ids, 999_999_999],
    spacing_minutes: 5,
  });

  if (noMailbox) expect(noMailbox.text).toContain("No mailbox is connected");
  const result = sent.json as {
    from: string;
    scheduled: { send_at: string }[];
    skipped: Json[];
  };
  expect(result.from).toBe(`otto-${run}@ugc.example`);
  expect(result.scheduled).toHaveLength(1);
  expect(result.skipped.map((each) => each.why)).toEqual([
    "Over today's limit of 50. Send it tomorrow.",
    "Not one of your drafts",
  ]);
  const [scheduled] = await database
    .select({ status: emails.status })
    .from(emails)
    .where(and(eq(emails.id, ids[0] as number), eq(emails.sales_id, saleId)));
  expect(scheduled?.status).toBe("scheduled");
});
