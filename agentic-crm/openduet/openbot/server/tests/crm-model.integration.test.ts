import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDatabase } from "../src/db/client";
import { crmTestClient, type Json } from "./support/crm";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const crm = crmTestClient(database);
const { run, call, create, update, list } = crm;

beforeAll(() => crm.setUp());
afterAll(async () => {
  await crm.tearDown();
  await database.$client.end({ timeout: 5 });
});

const field = async (object: string, body: Json) => {
  const { status, json } = await call(
    "POST",
    `/metadata/objects/${object}/fields`,
    body,
  );
  if (status !== 201) throw new Error(JSON.stringify(json));
  return json.data as Json;
};

test("a custom field keeps its values, filters and sorts, merges on change, and refuses a wrong value", async () => {
  const tier = await field("companies", {
    label: `Tier ${run}`,
    type: "select",
    options: {
      choices: [
        { value: "gold", label: "Gold" },
        { value: "silver", label: "Silver" },
      ],
    },
  });
  const seats = await field("companies", {
    label: `Seats ${run}`,
    type: "number",
  });
  const gold = await create("companies", {
    name: `Goldco ${run}`,
    custom_fields: { [String(tier.name)]: "gold" },
  });
  await create("companies", {
    name: `Silverco ${run}`,
    custom_fields: { [String(tier.name)]: "silver", [String(seats.name)]: 3 },
  });

  const merged = await update("companies", gold.id, {
    custom_fields: { [String(seats.name)]: "12" },
  });
  const wrong = await call("PUT", `/companies/${gold.id}`, {
    custom_fields: { [String(tier.name)]: "bronze" },
  });
  const golden = await list("companies", {
    [`custom_fields.${tier.name}`]: "gold",
    "name@ilike": run,
  });
  const bySeats = await list(
    "companies",
    { "name@ilike": run },
    `&sort=custom_fields.${seats.name}&order=DESC`,
  );

  expect(merged.custom_fields).toEqual({
    [String(tier.name)]: "gold",
    [String(seats.name)]: 12,
  });
  expect(wrong.status).toBe(400);
  expect(String(wrong.json.error)).toContain(
    '"bronze" isn\'t one of its choices',
  );
  expect(golden.data.map((row) => row.name)).toEqual([`Goldco ${run}`]);
  expect(bySeats.data.map((row) => row.name)).toEqual([
    `Goldco ${run}`,
    `Silverco ${run}`,
  ]);
});

test("only an admin changes the data model", async () => {
  const { status } = await call(
    "POST",
    "/metadata/objects/contacts/fields",
    { label: "Nope", type: "text" },
    "member",
  );

  expect(status).toBe(403);
});

test("a custom object's records go through the same API, with required fields, relations and links back", async () => {
  const made = await call("POST", "/metadata/objects", {
    label_singular: "Project",
    label_plural: `Projects ${run}`,
  });
  const object = String((made.json.data as Json).name);
  await field(object, { label: "Budget", type: "currency" });
  await field(object, {
    label: "Client",
    type: "relation",
    options: { target: "companies" },
  });
  await field(object, {
    label: "Phase",
    type: "select",
    options: {
      choices: [
        { value: "build", label: "Build" },
        { value: "done", label: "Done" },
      ],
    },
  });
  const company = await create("companies", { name: `Client ${run}` });

  const project = await create(object, {
    name: "New site",
    budget: "1,500",
    client: company.id,
    phase: "build",
  });
  await create(object, { name: "Small fix", budget: 200, phase: "done" });
  const missingName = await call("POST", `/${object}`, { budget: 10 });
  const big = await list(object, { "budget@gte": 1000 });
  const changed = await update(object, project.id, { phase: "done" });
  const linked = (await call("GET", `/linked/companies/${company.id}`)).json
    .data as Json[];
  const removed = await call("DELETE", `/${object}/${project.id}`);

  expect(made.status).toBe(201);
  expect(project).toMatchObject({
    name: "New site",
    budget: 1500,
    client: company.id,
    phase: "build",
  });
  expect(missingName.status).toBe(400);
  expect(big.data.map((row) => row.name)).toEqual(["New site"]);
  expect(changed).toMatchObject({
    name: "New site",
    budget: 1500,
    phase: "done",
  });
  expect(linked.find((group) => group.object === object)?.data).toEqual([
    expect.objectContaining({ name: "New site" }),
  ]);
  expect(removed.status).toBe(200);
});

test("a role limits a person to their own deals, hides fields, keeps others read-only, and refuses what it doesn't allow", async () => {
  const role = (
    await call("POST", "/roles", {
      name: `Sales ${run}`,
      rules: {
        objects: {
          deals: { read: "own", update: "own", delete: "none" },
          companies: { create: false },
        },
        fields: {
          contacts: { background: "hidden", lead_source: "read_only" },
        },
      },
    })
  ).json.data as Json;
  const member = (await call("GET", "/me", undefined, "member")).json
    .data as Json;
  await update("sales", member.id, { role_id: role.id });
  const theirs = await create("deals", {
    name: `Theirs ${run}`,
    stage: "opportunity",
    sales_id: member.id,
  });
  const others = await create("deals", {
    name: `Others ${run}`,
    stage: "opportunity",
  });
  const contact = await create("contacts", {
    first_name: "Hidden",
    last_name: `Background${run}`,
    background: `secretword${run}`,
    lead_source: "Ads",
    title: "Old",
  });

  const deals = await list("deals", { "name@ilike": run }, "", "member");
  const othersRead = await call(
    "GET",
    `/deals/${others.id}`,
    undefined,
    "member",
  );
  const othersChange = await call(
    "PUT",
    `/deals/${others.id}`,
    { name: "Mine now" },
    "member",
  );
  const theirsDelete = await call(
    "DELETE",
    `/deals/${theirs.id}`,
    undefined,
    "member",
  );
  const company = await call(
    "POST",
    "/companies",
    { name: "Not allowed" },
    "member",
  );
  const seen = (
    await call("GET", `/contacts/${contact.id}`, undefined, "member")
  ).json.data as Json;
  const changed = await update(
    "contacts",
    contact.id,
    { lead_source: "Changed", title: "New" },
    "member",
  );
  const byHidden = await call(
    "GET",
    `/contacts?filter=${encodeURIComponent(JSON.stringify({ "background@ilike": "secretword" }))}`,
    undefined,
    "member",
  );
  const searched = (
    await call("GET", `/search?q=secretword${run}`, undefined, "member")
  ).json.data as Json[];
  const searchedAsAdmin = (await call("GET", `/search?q=secretword${run}`)).json
    .data as Json[];
  const access = (await call("GET", "/me/access", undefined, "member")).json
    .data as Json;
  await update("sales", member.id, { role_id: null });

  expect(deals.data.map((deal) => deal.name)).toEqual([`Theirs ${run}`]);
  expect(othersRead.status).toBe(404);
  expect(othersChange.status).toBe(404);
  expect(theirsDelete.status).toBe(403);
  expect(company.status).toBe(403);
  expect(seen).not.toHaveProperty("background");
  expect(seen.first_name).toBe("Hidden");
  expect(changed).toMatchObject({ lead_source: "Ads", title: "New" });
  expect(byHidden.status).toBe(400);
  expect(searched).toEqual([]);
  expect(searchedAsAdmin.map((result) => result.record_id)).toEqual([
    contact.id,
  ]);
  expect((access.objects as Record<string, Json>).deals).toMatchObject({
    read: "own",
    delete: "none",
  });
});

test("views are a person's own, or shared, and only their owner changes them", async () => {
  const mine = await call(
    "POST",
    "/views",
    {
      object: "deals",
      name: `Mine ${run}`,
      config: { filter: { stage: "won" } },
    },
    "member",
  );
  const shared = await call("POST", "/views", {
    object: "deals",
    name: `Everybody ${run}`,
    type: "kanban",
    shared: true,
    config: { group_by: "stage" },
  });
  const adminsOwn = await call("POST", "/views", {
    object: "deals",
    name: `Admin only ${run}`,
  });

  const seen = (
    (await call("GET", "/views?object=deals", undefined, "member")).json
      .data as Json[]
  )
    .map((view) => view.name)
    .filter((name) => String(name).endsWith(run));
  const othersDelete = await call(
    "DELETE",
    `/views/${(shared.json.data as Json).id}`,
    undefined,
    "member",
  );

  expect(mine.status).toBe(201);
  expect(adminsOwn.status).toBe(201);
  expect(seen.sort()).toEqual([`Everybody ${run}`, `Mine ${run}`]);
  expect(othersDelete.status).toBe(403);
});

test("a record's history says who changed what, and leaves out fields the reader can't see", async () => {
  const contact = await create("contacts", {
    first_name: "History",
    last_name: run,
    title: "Intern",
    background: "Before",
  });
  await update("contacts", contact.id, { title: "Engineer" });
  await update("contacts", contact.id, { background: "After" }, "member");
  const role = (
    await call("POST", "/roles", {
      name: `Readers ${run}`,
      rules: { fields: { contacts: { background: "hidden" } } },
    })
  ).json.data as Json;
  const member = (await call("GET", "/me", undefined, "member")).json
    .data as Json;

  const asAdmin = (await call("GET", `/history/contacts/${contact.id}`)).json
    .data as Json[];
  await update("sales", member.id, { role_id: role.id });
  const asMember = (
    await call("GET", `/history/contacts/${contact.id}`, undefined, "member")
  ).json.data as Json[];
  await update("sales", member.id, { role_id: null });

  expect(
    asAdmin.map((event) => [
      event.action,
      (event.by as Json).name,
      event.changes,
    ]),
  ).toEqual([
    [
      "updated",
      "Max Member",
      [{ field: "background", from: "Before", to: "After" }],
    ],
    [
      "updated",
      "Ada Admin",
      [{ field: "title", from: "Intern", to: "Engineer" }],
    ],
    ["created", "Ada Admin", []],
  ]);
  expect(asMember[0]?.changes).toEqual([]);
});

test("notes on a custom object's records", async () => {
  const object = String(
    (
      (
        await call("POST", "/metadata/objects", {
          label_singular: "Asset",
          label_plural: `Assets ${run}`,
        })
      ).json.data as Json
    ).name,
  );
  const asset = await create(object, { name: "Laptop" });

  const added = await call("POST", `/notes/${object}/${asset.id}`, {
    text: "Sent for repair",
  });
  const notes = (await call("GET", `/notes/${object}/${asset.id}`)).json
    .data as Json[];

  expect(added.status).toBe(201);
  expect(notes.map((note) => note.text)).toEqual(["Sent for repair"]);
});
