import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { createAuditStore } from "../src/audit";
import { callTool, listTools, useCrmTools } from "../src/crm/agent-tools";
import { installCrmTools } from "../src/crm/install";
import { installs } from "../src/crm/schema";
import { createDatabase } from "../src/db/client";
import { agents, approvalTeamRules, mcpServers, users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `crm-tools-${run}`,
  email: `tools-${run}@acme.test`,
  name: "Tess Tools",
};
const connection = { url: "builtin://crm/", actorId: PERSON.id, botId: "bot" };
type Json = Record<string, unknown>;

async function call(tool: string, args: Json) {
  const result = await callTool(connection, tool, args);
  return {
    ...result,
    json: result.isError ? null : (JSON.parse(result.text) as Json),
  };
}

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
  useCrmTools({ database, roleOf: async () => "user" });
});

afterAll(async () => {
  useCrmTools(null);
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

test("a contact the agent adds belongs to the person and is found by its email in any case", async () => {
  const { json: created } = await call("create_record", {
    resource: "contacts",
    values: {
      first_name: "Ada",
      last_name: `Tools${run}`,
      email_jsonb: [{ email: `Ada.${run}@Acme.test`, type: "Work" }],
    },
  });
  const { json: me } = await call("list_records", {
    resource: "contacts",
    filter: { last_name: `Tools${run}` },
  });
  const { json: found } = await call("find_contact", {
    email: `ada.${run}@acme.test`,
  });

  const contact = (created as { created: Json }).created;
  expect((me as { total: number }).total).toBe(1);
  expect((found as { contacts: Json[] }).contacts.map((row) => row.id)).toEqual(
    [contact.id],
  );
  expect(contact).not.toHaveProperty("email_fts");
  expect(typeof contact.sales_id).toBe("number");
});

test("reading a contact brings its recent notes and open tasks", async () => {
  const { json } = await call("create_record", {
    resource: "contacts",
    values: { first_name: "Grace", last_name: `Tools${run}` },
  });
  const contactId = (json as { created: Json }).created.id;
  await call("create_record", {
    resource: "contact_notes",
    values: { contact_id: contactId, text: "Met at the fair" },
  });
  await call("create_record", {
    resource: "tasks",
    values: { contact_id: contactId, text: "Send the quote", type: "email" },
  });

  const { json: read } = await call("get_record", {
    resource: "contacts",
    id: contactId,
  });

  expect(read).toMatchObject({
    first_name: "Grace",
    recent_notes: [expect.objectContaining({ text: "Met at the fair" })],
    open_tasks: [expect.objectContaining({ text: "Send the quote" })],
  });
});

test("a field the record doesn't have is refused, naming the fields it does have", async () => {
  const result = await call("create_record", {
    resource: "companies",
    values: { name: `Acme ${run}`, industry: "Software" },
  });

  expect(result.isError).toBe(true);
  expect(result.text).toContain("companies has no field industry");
  expect(result.text).toContain("sector");
});

test("the agent can't change the CRM's users or settings", async () => {
  const result = await call("update_record", {
    resource: "configuration",
    id: 1,
    values: { config: {} },
  });

  expect(result.isError).toBe(true);
});

test("a run that isn't for a person can't use the CRM", async () => {
  const result = await callTool(
    { url: "builtin://crm/", botId: "bot" },
    "search",
    { query: "Ada" },
  );

  expect(result.isError).toBe(true);
});

test("the first boot grants the tools to every Bot and makes CRM writes ask; later boots change nothing", async () => {
  const audit = createAuditStore(database);
  const calls: string[] = [];
  const pluginStore = {
    addServer: async () => {
      calls.push("add");
      return {} as never;
    },
    grant: async (_kind: string, ref: string, bot: string) => {
      calls.push(`grant ${bot} ${ref}`);
    },
    refreshTools: async () => {
      calls.push("refresh");
      return { tools: 0 };
    },
  };
  const roleOf = async () => "user" as const;
  await database.delete(installs);
  const bots = await database.select({ id: agents.id }).from(agents);
  const tools = await listTools();

  await installCrmTools({ database, pluginStore, audit, roleOf });
  const firstBoot = [...calls];
  calls.length = 0;
  await installCrmTools({ database, pluginStore, audit, roleOf });

  const rules = await database
    .select()
    .from(approvalTeamRules)
    .where(eq(approvalTeamRules.toolRef, "crm/*"));
  expect(firstBoot[0]).toBe("add");
  expect(firstBoot.filter((step) => step.startsWith("grant"))).toHaveLength(
    bots.length * tools.length,
  );
  expect(
    rules.map(({ effect, scope, behaviour }) => ({ effect, scope, behaviour })),
  ).toEqual([{ effect: "write", scope: "crm", behaviour: "ask" }]);
  expect(calls).not.toContain("add");
  await database.delete(installs);
  await database.delete(approvalTeamRules).where(
    inArray(
      approvalTeamRules.id,
      rules.map((rule) => rule.id),
    ),
  );
});

test("a deployment installed before the report tools gets them granted once on its next boot", async () => {
  const granted: string[] = [];
  const pluginStore = {
    addServer: async () => ({}) as never,
    grant: async (_kind: string, ref: string) => {
      granted.push(ref);
    },
    refreshTools: async () => ({ tools: 0 }),
  };
  const deps = {
    database,
    pluginStore,
    audit: createAuditStore(database),
    roleOf: async () => "user" as const,
  };
  await database.delete(installs);
  await database.insert(installs).values({ name: "agent-tools" });
  await database
    .insert(mcpServers)
    .values({
      id: "crm",
      title: "CRM",
      vendor: "Built in",
      url: "builtin://crm/",
    })
    .onConflictDoNothing();
  const bots = await database.select({ id: agents.id }).from(agents);

  await installCrmTools(deps);
  const firstBoot = [...granted];
  granted.length = 0;
  await installCrmTools(deps);

  expect(new Set(firstBoot)).toEqual(
    new Set(
      bots.length
        ? ["crm/run_report", "crm/list_reports", "crm/make_chart"]
        : [],
    ),
  );
  expect(firstBoot).toHaveLength(bots.length * 3);
  expect(granted).toEqual([]);
  await database.delete(installs);
});

test("the agent answers with a report, then makes it a chart the person can open", async () => {
  for (const [name, stage, amount] of [
    ["One", "won", 3000],
    ["Two", "won", 2000],
    ["Three", "lost", 500],
  ] as const) {
    await call("create_record", {
      resource: "deals",
      values: { name: `${name} report ${run}`, stage, amount },
    });
  }
  const filter = { "name@ilike": `report ${run}` };

  const { json: report } = await call("run_report", {
    object: "deals",
    fn: "sum",
    field: "amount",
    group_by: "stage",
    filter,
  });
  const { json: made } = await call("make_chart", {
    title: "Won and lost",
    type: "bar",
    object: "deals",
    fn: "sum",
    field: "amount",
    group_by: "stage",
    filter,
    report_name: `Agent report ${run}`,
  });
  const { json: added } = await call("make_chart", {
    title: "How many",
    type: "number",
    object: "deals",
    filter,
    report_id: (made as Json).report_id,
  });
  const { json: reports } = await call("list_reports", {});
  const broken = await call("make_chart", {
    title: "Broken",
    type: "bar",
    object: "deals",
    group_by: "no_such_field",
    report_id: (made as Json).report_id,
  });

  expect((report as Json).groups).toEqual([
    { key: "won", value: 5000 },
    { key: "lost", value: 500 },
  ]);
  expect((made as Json).url).toBe(`/crm/reports/${(made as Json).report_id}`);
  expect((added as Json).report_id).toBe((made as Json).report_id);
  expect(
    (reports as unknown as Json[]).find(
      (each) => each.id === (made as Json).report_id,
    ),
  ).toMatchObject({
    name: `Agent report ${run}`,
    yours: true,
    charts: ["Won and lost", "How many"],
  });
  expect(broken.isError).toBe(true);
  expect(broken.text).toContain("no_such_field");
});
