import { afterAll, beforeAll, expect, test } from "bun:test";
import { createPublicApi } from "../src/crm/public-api";
import { createCrmRecords } from "../src/crm/records";
import { createDatabase } from "../src/db/client";
import { userRoles } from "../src/db/schema";
import { crmTestClient, type Json } from "./support/crm";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const records = createCrmRecords(database);
const crm = crmTestClient(database, { records });
const { run, people, call, create, update } = crm;
const api = createPublicApi({
  database,
  records,
  apiUrl: "https://crm.acme.test",
  productName: "Magpie CRM",
});

beforeAll(async () => {
  await crm.setUp();
  await database.insert(userRoles).values([
    { userId: people.admin.id, role: "admin" },
    { userId: people.member.id, role: "user" },
  ]);
});
afterAll(async () => {
  await crm.tearDown();
  await database.$client.end({ timeout: 5 });
});

async function v1(method: string, path: string, key: string, body?: unknown) {
  const response = await api.request(path, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, json: (await response.json()) as Json };
}

const keyFor = async (as: "admin" | "member", name = `Key ${run}`) => {
  const { status, json } = await call("POST", "/api-keys", { name }, as);
  if (status !== 201) throw new Error(JSON.stringify(json));
  return { key: String((json.data as Json).key), row: json.data as Json };
};

const withRole = async (rules: Json) => {
  const role = (
    await call("POST", "/roles", { name: `Role ${crypto.randomUUID()}`, rules })
  ).json.data as Json;
  const member = (await call("GET", "/me", undefined, "member")).json
    .data as Json;
  await update("sales", member.id, { role_id: role.id });
  return () => update("sales", member.id, { role_id: null });
};

test("an API key works as the person who made it, keeps to their role, and stops once revoked", async () => {
  const { key, row } = await keyFor("member");
  const member = (await call("GET", "/me", undefined, "member")).json
    .data as Json;

  const made = await v1("POST", "/contacts", key, {
    first_name: "Api",
    last_name: `Made ${run}`,
  });
  const changed = await v1(
    "PATCH",
    `/contacts/${(made.json.data as Json).id}`,
    key,
    { title: "Buyer" },
  );
  const listed = await v1(
    "GET",
    `/contacts?filter=${encodeURIComponent(JSON.stringify({ "last_name@ilike": run }))}&per_page=5`,
    key,
  );
  const restore = await withRole({ objects: { deals: { read: "none" } } });
  const deals = await v1("GET", "/deals", key);
  await restore();
  const unknown = await v1("GET", "/configuration", key);
  const wrongKey = await v1("GET", "/contacts", `${key.slice(0, -1)}x`);
  const keys = (await call("GET", "/api-keys", undefined, "member")).json
    .data as Json[];
  await call("DELETE", `/api-keys/${row.id}`, undefined, "member");
  const revoked = await v1("GET", "/contacts", key);

  expect(key).toMatch(/^mgp_[a-z0-9]{10}_[a-z0-9]{40}$/);
  expect(made.status).toBe(201);
  expect(made.json.data).toMatchObject({ sales_id: member.id });
  expect(changed.json.data).toMatchObject({ title: "Buyer" });
  expect(listed.json).toMatchObject({ total: 1, page: 1, per_page: 5 });
  expect(deals.status).toBe(403);
  expect(unknown.status).toBe(404);
  expect(wrongKey.status).toBe(401);
  expect(keys.map((each) => each.id)).toContain(row.id);
  expect(keys[0]).not.toHaveProperty("hash");
  expect(revoked.status).toBe(401);
});

test("someone else's key can't be revoked, except by an admin", async () => {
  const { row } = await keyFor("admin", `Admin key ${run}`);

  const byMember = await call(
    "DELETE",
    `/api-keys/${row.id}`,
    undefined,
    "member",
  );
  const byAdmin = await call("DELETE", `/api-keys/${row.id}`);

  expect(byMember.status).toBe(404);
  expect(byAdmin.status).toBe(200);
});

test("the OpenAPI description has custom fields and leaves out the ones the key's owner can't see", async () => {
  const secret = (
    await call("POST", "/metadata/objects/contacts/fields", {
      label: `Secret ${run}`,
      type: "text",
    })
  ).json.data as Json;
  const { key } = await keyFor("member");
  const restore = await withRole({
    fields: { contacts: { [String(secret.name)]: "hidden" } },
  });

  const document = (await v1("GET", "/openapi.json", key)).json;
  await restore();
  const open = (await v1("GET", "/openapi.json", key)).json;
  const contacts = (
    (document.components as Json).schemas as Record<string, Json>
  ).contacts as Json;
  const customOf = (schema: Json) =>
    ((schema.properties as Json).custom_fields as Json | undefined)
      ?.properties as Json | undefined;

  expect(document.openapi).toBe("3.1.0");
  expect((document.servers as Json[])[0]).toEqual({
    url: "https://crm.acme.test/api/v1",
  });
  expect(document.paths).toHaveProperty(["/contacts/{id}"]);
  expect(customOf(contacts) ?? {}).not.toHaveProperty(String(secret.name));
  expect(
    customOf(
      ((open.components as Json).schemas as Record<string, Json>)
        .contacts as Json,
    ),
  ).toHaveProperty(String(secret.name));
});

test("reports count and add up the records a person may see, by a field or by month", async () => {
  const member = (await call("GET", "/me", undefined, "member")).json
    .data as Json;
  await create("deals", {
    name: `Won A ${run}`,
    stage: "won",
    amount: 1000,
    sales_id: member.id,
  });
  await create("deals", { name: `Won B ${run}`, stage: "won", amount: 500 });
  await create("deals", { name: `Lost ${run}`, stage: "lost", amount: 200 });
  const filter = { "name@ilike": run };

  const byStage = (
    await call("POST", "/reports", {
      object: "deals",
      filter,
      group_by: "stage",
      fn: "sum",
      field: "amount",
    })
  ).json.data;
  const total = (await call("POST", "/reports", { object: "deals", filter }))
    .json.data;
  const byMonth = (
    await call("POST", "/reports", {
      object: "deals",
      filter,
      group_by: "created_at",
      bucket: "month",
    })
  ).json.data as Json[];
  const restore = await withRole({ objects: { deals: { read: "own" } } });
  const own = (
    await call(
      "POST",
      "/reports",
      { object: "deals", filter, fn: "sum", field: "amount" },
      "member",
    )
  ).json.data;
  await restore();
  const unknownField = await call("POST", "/reports", {
    object: "deals",
    group_by: "nope",
  });

  expect(byStage).toEqual([
    { key: "won", value: 1500 },
    { key: "lost", value: 200 },
  ]);
  expect(total).toEqual([{ key: null, value: 3 }]);
  expect(byMonth).toHaveLength(1);
  expect(byMonth[0]?.value).toBe(3);
  expect(String(byMonth[0]?.key)).toMatch(/^\d{4}-\d{2}-01T/);
  expect(own).toEqual([{ key: null, value: 1000 }]);
  expect(unknownField.status).toBe(400);
});

test("merging contacts moves notes, tasks, meetings, deals and linked records to the kept one", async () => {
  const projects = String(
    (
      (
        await call("POST", "/metadata/objects", {
          label_singular: "Engagement",
          label_plural: `Engagements ${run}`,
        })
      ).json.data as Json
    ).name,
  );
  await call("POST", `/metadata/objects/${projects}/fields`, {
    label: "Contact",
    type: "relation",
    options: { target: "contacts" },
  });
  const keep = await create("contacts", {
    first_name: "Kim",
    last_name: `Kept ${run}`,
    email_jsonb: [{ email: "kim@acme.test", type: "Work" }],
  });
  const duplicate = await create("contacts", {
    first_name: "Kimberly",
    last_name: `Duplicate ${run}`,
    title: "Founder",
    lifecycle_stage: "client",
    email_jsonb: [
      { email: "KIM@acme.test", type: "Work" },
      { email: "kim@home.test", type: "Home" },
    ],
  });
  await create("contact_notes", {
    contact_id: duplicate.id,
    text: "Met at expo",
  });
  await create("tasks", {
    contact_id: duplicate.id,
    text: "Call back",
    type: "Call",
    due_date: new Date().toISOString(),
  });
  const deal = await create("deals", {
    name: `Merge deal ${run}`,
    stage: "opportunity",
    contact_ids: [duplicate.id, keep.id],
  });
  const meeting = await create("meetings", {
    title: "Intro",
    start_at: new Date().toISOString(),
    contact_id: duplicate.id,
  });
  const engagement = await create(projects, {
    name: "Pilot",
    contact: duplicate.id,
  });

  const merged = await call("POST", `/contacts/${keep.id}/merge`, {
    duplicate_id: duplicate.id,
  });
  const gone = await call("GET", `/contacts/${duplicate.id}`);
  const notes = (
    await crm.list("contact_notes", { contact_id: keep.id })
  ).data.map((note) => note.text);
  const tasks = (await crm.list("tasks", { contact_id: keep.id })).data;

  expect(merged.status).toBe(200);
  expect(merged.json.data).toMatchObject({
    first_name: "Kim",
    title: "Founder",
    lifecycle_stage: "client",
    email_jsonb: [
      { email: "kim@acme.test", type: "Work" },
      { email: "kim@home.test", type: "Home" },
    ],
  });
  expect(gone.status).toBe(404);
  expect(notes).toEqual(["Met at expo"]);
  expect(tasks).toHaveLength(1);
  expect(
    ((await call("GET", `/deals/${deal.id}`)).json.data as Json).contact_ids,
  ).toEqual([keep.id]);
  expect(
    ((await call("GET", `/meetings/${meeting.id}`)).json.data as Json)
      .contact_id,
  ).toBe(keep.id);
  expect(
    ((await call("GET", `/${projects}/${engagement.id}`)).json.data as Json)
      .contact,
  ).toBe(keep.id);
});

test("a person can't merge contacts their role doesn't let them delete", async () => {
  const one = await create("contacts", { first_name: "One", last_name: run });
  const two = await create("contacts", { first_name: "Two", last_name: run });
  const restore = await withRole({ objects: { contacts: { delete: "none" } } });

  const refused = await call(
    "POST",
    `/contacts/${one.id}/merge`,
    { duplicate_id: two.id },
    "member",
  );
  await restore();

  expect(refused.status).toBe(403);
  expect((await call("GET", `/contacts/${two.id}`)).status).toBe(200);
});

test("dashboards are their owner's, or shared, and only the owner changes them", async () => {
  const widgets = [
    {
      id: "a",
      title: "Deals by stage",
      type: "bar",
      object: "deals",
      group_by: "stage",
    },
  ];
  const mine = await call(
    "POST",
    "/dashboards",
    { name: `Mine ${run}`, widgets },
    "member",
  );
  const shared = await call("POST", "/dashboards", {
    name: `Team ${run}`,
    shared: true,
    widgets,
  });
  await call("POST", "/dashboards", { name: `Admin's ${run}` });

  const seen = (
    (await call("GET", "/dashboards", undefined, "member")).json.data as Json[]
  )
    .map((dashboard) => dashboard.name)
    .filter((name) => String(name).endsWith(run));
  const othersChange = await call(
    "PUT",
    `/dashboards/${(shared.json.data as Json).id}`,
    { name: "Mine now" },
    "member",
  );
  const badWidget = await call("POST", "/dashboards", {
    name: "Bad",
    widgets: [{ id: "x", type: "donut", object: "deals" }],
  });

  expect(mine.status).toBe(201);
  expect(seen.sort()).toEqual([`Mine ${run}`, `Team ${run}`]);
  expect(othersChange.status).toBe(403);
  expect(badWidget.status).toBe(400);
});
