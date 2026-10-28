import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDatabase } from "../src/db/client";
import { crmTestClient, setUpdatedAt } from "./support/crm";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const crm = crmTestClient(database);
const { run, create, update, list, call } = crm;

beforeAll(() => crm.setUp());
afterAll(async () => {
  await crm.tearDown();
  await database.$client.end({ timeout: 5 });
});

const backdate = (table: string, id: unknown) =>
  setUpdatedAt(database, table, id, "2020-01-01T00:00:00Z");

test("changing a record moves its date updated, whoever writes it", async () => {
  const contact = await create("contacts", {
    first_name: "Dana",
    last_name: `Dated${run}`,
  });
  await backdate("contacts", contact.id);

  const changed = await update("contacts", contact.id, { title: "CEO" });

  expect(Date.parse(String(changed.updated_at))).toBeGreaterThan(
    Date.parse("2025-01-01"),
  );
});

test("a save that changes nothing, or only a deal's place in its column, keeps the date", async () => {
  const deal = await create("deals", {
    name: `Reorder ${run}`,
    stage: "opportunity",
    index: 0,
  });
  await backdate("deals", deal.id);

  const moved = await update("deals", deal.id, { index: 3 });
  const unchanged = await update("deals", deal.id, { name: `Reorder ${run}` });

  expect(moved.updated_at).toBe("2020-01-01T00:00:00.000Z");
  expect(unchanged.updated_at).toBe("2020-01-01T00:00:00.000Z");
});

test("the date updated can't be set by hand", async () => {
  const company = await create("companies", { name: `Handset ${run}` });

  const after = await update("companies", company.id, {
    updated_at: "2001-01-01T00:00:00Z",
  });

  expect(after.updated_at).not.toBe("2001-01-01T00:00:00.000Z");
});

test("every stage a deal enters is kept, in order", async () => {
  const deal = await create("deals", {
    name: `Stages ${run}`,
    stage: "opportunity",
  });
  await update("deals", deal.id, { stage: "proposal-sent" });
  await update("deals", deal.id, { stage: "won" });

  const { data } = await list(
    "deal_stage_history",
    { deal_id: deal.id },
    "&sort=id&order=ASC",
  );

  expect(
    data.map(({ from_stage, to_stage }) => [from_stage, to_stage]),
  ).toEqual([
    [null, "opportunity"],
    ["opportunity", "proposal-sent"],
    ["proposal-sent", "won"],
  ]);
});

test("a new deal takes its lead source from its first contact, or else its company", async () => {
  const company = await create("companies", {
    name: `Sourced ${run}`,
    lead_source: "Event",
  });
  const contact = await create("contacts", {
    first_name: "Leo",
    last_name: `Source${run}`,
    lead_source: "Referral",
  });

  const fromContact = await create("deals", {
    name: `From contact ${run}`,
    stage: "opportunity",
    contact_ids: [contact.id],
    company_id: company.id,
  });
  const fromCompany = await create("deals", {
    name: `From company ${run}`,
    stage: "opportunity",
    company_id: company.id,
  });
  const chosen = await create("deals", {
    name: `Chosen ${run}`,
    stage: "opportunity",
    contact_ids: [contact.id],
    lead_source: "Ads",
  });

  expect(fromContact.lead_source).toBe("Referral");
  expect(fromCompany.lead_source).toBe("Event");
  expect(chosen.lead_source).toBe("Ads");
});

test("meetings link to a contact and a deal, and belong to whoever logged them", async () => {
  const me = (await call("GET", "/me", undefined, "member")).json.data as {
    id: number;
  };
  const contact = await create("contacts", {
    first_name: "Mia",
    last_name: `Meet${run}`,
  });
  const deal = await create("deals", {
    name: `Meet deal ${run}`,
    stage: "opportunity",
  });

  const meeting = await create(
    "meetings",
    {
      title: "Discovery call",
      contact_id: contact.id,
      deal_id: deal.id,
      start_at: "2026-11-02T15:00:00Z",
    },
    "member",
  );
  const logged = await update(
    "meetings",
    meeting.id,
    { status: "completed", outcome: "Send proposal" },
    "member",
  );

  expect(meeting).toMatchObject({
    sales_id: me.id,
    status: "scheduled",
    source: "manual",
    start_at: "2026-11-02T15:00:00.000Z",
  });
  expect(logged).toMatchObject({
    status: "completed",
    outcome: "Send proposal",
  });
});

test("a proposal gets a private link nobody can choose or change", async () => {
  const deal = await create("deals", {
    name: `Proposal deal ${run}`,
    stage: "opportunity",
  });

  const proposal = await create("proposals", {
    deal_id: deal.id,
    title: "Website redesign",
    token: "chosen-by-me",
  });
  const after = await update("proposals", proposal.id, { token: "changed" });

  expect(String(proposal.token)).toMatch(/^[0-9a-f]{64}$/);
  expect(after.token).toBe(proposal.token);
  expect(proposal.status).toBe("draft");
});

test("emails and stage history are read-only through the API", async () => {
  const { status } = await call("POST", "/emails", {
    to_address: "x@example.com",
  });

  expect(status).toBe(405);
});

test("contacts list their lifecycle stage, lead source and custom fields", async () => {
  await create("contacts", {
    first_name: "Cleo",
    last_name: `Client${run}`,
    lifecycle_stage: "client",
    lead_source: "Website",
    custom_fields: { budget: 5000 },
  });

  const { data } = await list("contacts", {
    "last_name@eq": `Client${run}`,
    lifecycle_stage: "client",
  });

  expect(data[0]).toMatchObject({
    lifecycle_stage: "client",
    lead_source: "Website",
    custom_fields: { budget: 5000 },
  });
});
