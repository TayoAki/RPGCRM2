import { afterAll, beforeAll, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import { createCrmRoutes } from "../src/crm/routes";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const ADMIN = {
  id: `crm-admin-${run}`,
  email: `admin-${run}@acme.test`,
  name: "Ada Admin",
};
const MEMBER = {
  id: `crm-member-${run}`,
  email: `member-${run}@acme.test`,
  name: "Max Member",
};

// Signs the request in as the admin, or as the member when `x-member` is set.
const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
  context,
  next,
) => {
  const member = context.req.header("x-member") === "1";
  context.set("actor", {
    ...(member ? MEMBER : ADMIN),
    role: member ? "user" : "admin",
  });
  await next();
};

const routes = createCrmRoutes({ requireUser, database });

type Json = Record<string, unknown>;

async function call(
  method: string,
  path: string,
  body?: unknown,
  as: "admin" | "member" = "admin",
): Promise<{ status: number; json: Json }> {
  const response = await routes.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(as === "member" ? { "x-member": "1" } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, json: (await response.json()) as Json };
}

const list = async (resource: string, filter: Json, extra = "") => {
  const { json } = await call(
    "GET",
    `/${resource}?filter=${encodeURIComponent(JSON.stringify(filter))}&perPage=100${extra}`,
  );
  return json as { data: Json[]; total: number };
};

const create = async (resource: string, data: Json, as?: "admin" | "member") =>
  (await call("POST", `/${resource}`, data, as)).json.data as Json;

beforeAll(async () => {
  await database.insert(users).values([
    { ...ADMIN, emailVerified: false },
    { ...MEMBER, emailVerified: false },
  ]);
});

afterAll(async () => {
  await database.delete(users).where(inArray(users.id, [ADMIN.id, MEMBER.id]));
  await database.$client.end({ timeout: 5 });
});

test("a person's first visit makes them a CRM user with their OpenDuet role", async () => {
  const admin = (await call("GET", "/me")).json.data as Json;
  const member = (await call("GET", "/me", undefined, "member")).json
    .data as Json;

  expect(admin).toMatchObject({
    first_name: "Ada",
    last_name: "Admin",
    administrator: true,
  });
  expect(member).toMatchObject({ first_name: "Max", administrator: false });
});

test("a new contact belongs to whoever created it and lists with its company", async () => {
  const me = (await call("GET", "/me", undefined, "member")).json.data as Json;
  const company = await create("companies", { name: `Acme ${run}` });
  const contact = await create(
    "contacts",
    { first_name: "Grace", last_name: `Hopper${run}`, company_id: company.id },
    "member",
  );

  expect(contact).toMatchObject({
    sales_id: me.id,
    company_name: `Acme ${run}`,
    nb_tasks: 0,
  });
});

test("a search group matches any word in any of its columns", async () => {
  await create("contacts", { first_name: "Linus", last_name: `Search${run}` });
  await create("contacts", {
    first_name: "Other",
    last_name: `Person${run}`,
    title: `Searchable${run} title`,
  });

  const { data } = await list("contacts", {
    "@or": {
      "last_name@ilike": `search${run}`,
      "title@ilike": `searchable${run}`,
    },
  });

  expect(data.map((row) => row.first_name).sort()).toEqual(["Linus", "Other"]);
});

test("in, contains, comparison and null filters narrow the list", async () => {
  const tag = await create("tags", { name: `vip-${run}`, color: "#ff0000" });
  const tagged = await create("contacts", {
    first_name: "Tagged",
    last_name: `Filter${run}`,
    tags: [tag.id],
    last_seen: "2026-01-10T00:00:00Z",
  });
  const plain = await create("contacts", {
    first_name: "Plain",
    last_name: `Filter${run}`,
  });
  const ours = { "last_name@ilike": `filter${run}` };

  const byTag = await list("contacts", { ...ours, "tags@cs": `{${tag.id}}` });
  const byIds = await list("contacts", {
    "id@in": `(${tagged.id},${plain.id})`,
  });
  const recent = await list("contacts", {
    ...ours,
    "last_seen@gte": "2026-01-01",
  });
  const neverSeen = await list("contacts", { ...ours, "last_seen@is": null });

  expect(byTag.data.map((row) => row.id)).toEqual([tagged.id]);
  expect(byIds.total).toBe(2);
  expect(recent.data.map((row) => row.id)).toEqual([tagged.id]);
  expect(neverSeen.data.map((row) => row.id)).toEqual([plain.id]);
});

test("sorting newest first puts records with no date last, and pages count the whole list", async () => {
  const ours = { "last_name@ilike": `sorted${run}` };
  await create("contacts", {
    first_name: "A",
    last_name: `Sorted${run}`,
    last_seen: "2026-02-01T00:00:00Z",
  });
  await create("contacts", { first_name: "B", last_name: `Sorted${run}` });
  await create("contacts", {
    first_name: "C",
    last_name: `Sorted${run}`,
    last_seen: "2026-03-01T00:00:00Z",
  });

  const { json } = await call(
    "GET",
    `/contacts?filter=${encodeURIComponent(JSON.stringify(ours))}&sort=last_seen&order=DESC&page=1&perPage=2`,
  );

  expect((json.data as Json[]).map((row) => row.first_name)).toEqual([
    "C",
    "A",
  ]);
  expect(json.total).toBe(3);
});

test("a filter on a field the resource does not have is refused", async () => {
  const { status } = await call(
    "GET",
    `/contacts?filter=${encodeURIComponent(JSON.stringify({ "id; drop table crm.contacts": 1 }))}`,
  );

  expect(status).toBe(400);
});

test("everybody reads the configuration, and only an admin changes it", async () => {
  const read = await call("GET", "/configuration/1", undefined, "member");
  const refused = await call(
    "PUT",
    "/configuration/1",
    { config: { title: "Nope" } },
    "member",
  );
  const saved = await call("PUT", "/configuration/1", {
    config: { title: `CRM ${run}` },
  });

  expect(read.status).toBe(200);
  expect(refused.status).toBe(403);
  expect(saved.json.data).toMatchObject({ config: { title: `CRM ${run}` } });
});

test("a member renames themselves but cannot make themselves an admin", async () => {
  const me = (await call("GET", "/me", undefined, "member")).json.data as Json;

  const renamed = await call(
    "PUT",
    `/sales/${me.id}`,
    { first_name: "Maxine" },
    "member",
  );
  const promoted = await call(
    "PUT",
    `/sales/${me.id}`,
    { administrator: true },
    "member",
  );

  expect(renamed.json.data).toMatchObject({ first_name: "Maxine" });
  expect(promoted.status).toBe(403);
});

test("saving a record from a summary screen ignores the computed fields", async () => {
  const contact = await create("contacts", {
    first_name: "Summary",
    last_name: `Save${run}`,
  });

  const { status, json } = await call("PUT", `/contacts/${contact.id}`, {
    ...contact,
    title: "CTO",
    nb_tasks: 99,
    company_name: "Ignored",
  });

  expect(status).toBe(200);
  expect(json.data).toMatchObject({ title: "CTO", nb_tasks: 0 });
});

test("contact emails are stored lowercase", async () => {
  const contact = await create("contacts", {
    first_name: "Mixed",
    last_name: `Case${run}`,
    email_jsonb: [{ email: "Mixed.Case@Example.COM", type: "Work" }],
  });

  expect(contact.email_jsonb).toEqual([
    { email: "mixed.case@example.com", type: "Work" },
  ]);
});

test("a note on a contact moves the contact's last seen forward", async () => {
  const contact = await create("contacts", {
    first_name: "Noted",
    last_name: `Seen${run}`,
  });
  await create("contact_notes", {
    contact_id: contact.id,
    text: "Called them",
    date: "2026-04-01T09:00:00Z",
  });

  const { json } = await call("GET", `/contacts/${contact.id}`);

  expect(new Date(String((json.data as Json).last_seen)).toISOString()).toBe(
    "2026-04-01T09:00:00.000Z",
  );
});

test("deleting a tag takes it off every contact", async () => {
  const tag = await create("tags", { name: `gone-${run}`, color: "#000" });
  const contact = await create("contacts", {
    first_name: "Was",
    last_name: `Tagged${run}`,
    tags: [tag.id],
  });

  await call("DELETE", `/tags/${tag.id}`);
  const { json } = await call("GET", `/contacts/${contact.id}`);

  expect((json.data as Json).tags).toEqual([]);
});

test("many records change or go at once", async () => {
  const first = await create("tags", { name: `bulk-a-${run}`, color: "#111" });
  const second = await create("tags", { name: `bulk-b-${run}`, color: "#222" });

  await call("PUT", `/tags?ids=${first.id},${second.id}`, { color: "#333" });
  const recoloured = await list("tags", {
    "id@in": `(${first.id},${second.id})`,
  });
  await call("DELETE", `/tags?ids=${first.id},${second.id}`);
  const remaining = await list("tags", {
    "id@in": `(${first.id},${second.id})`,
  });

  expect(recoloured.data.map((row) => row.color)).toEqual(["#333", "#333"]);
  expect(remaining.total).toBe(0);
});

test("global search finds contacts by the start of a name and notes by their words", async () => {
  const contact = await create("contacts", {
    first_name: "Searchy",
    last_name: `Mcfind${run}`,
  });
  await create("contact_notes", {
    contact_id: contact.id,
    text: `Discussed the zeppelin${run} order`,
  });

  const byName = await call(
    "GET",
    `/search?q=${encodeURIComponent(`mcfind${run.slice(0, 4)}`)}`,
  );
  const byNote = await call(
    "GET",
    `/search?q=zeppelin${run}&resources=contact_notes`,
  );

  expect(byName.json.data).toContainEqual(
    expect.objectContaining({ resource: "contacts", record_id: contact.id }),
  );
  expect(byNote.json.data).toEqual([
    expect.objectContaining({
      resource: "contact_notes",
      contact_id: contact.id,
    }),
  ]);
});

test("the activity log lists what was created", async () => {
  const company = await create("companies", { name: `Logged ${run}` });

  const { data } = await list("activity_log", { company_id: company.id });

  expect(data).toEqual([
    expect.objectContaining({
      type: "company.created",
      company_id: company.id,
    }),
  ]);
});

test("deals match any of a list of categories, as the deals search asks", async () => {
  const deal = await create("deals", {
    name: `Category deal ${run}`,
    stage: "opportunity",
    categories: ["ui-design", "copywriting"],
  });

  const { data } = await list("deals", {
    "name@ilike": run,
    "@or": { "categories@ov": '{"copywriting","print-project"}' },
  });

  expect(data.map((row) => row.id)).toEqual([deal.id]);
});

test("a contact form with empty phone numbers and no tags saves", async () => {
  const { status, json } = await call("POST", "/contacts", {
    first_name: "Form",
    last_name: `Defaults${run}`,
    email_jsonb: [{ email: "form@acme.test", type: "Work" }],
    phone_jsonb: null,
    tags: [],
    has_newsletter: false,
  });

  expect(status).toBe(201);
  expect(json.data).toMatchObject({ phone_jsonb: null, tags: [] });
});
