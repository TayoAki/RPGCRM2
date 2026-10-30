import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { callTool, useCrmTools } from "../src/crm/agent-tools";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `crm-prospect-${run}`,
  email: `prospect-${run}@acme.test`,
  name: "Pat Prospect",
};
const connection = { url: "builtin://crm/", actorId: PERSON.id, botId: "bot" };
type Json = Record<string, unknown>;

let calls: string[] = [];
let costMicro = 40_000;
const fakeTreg = (async (url: URL) => {
  calls.push(String(url));
  return new Response(JSON.stringify({ output: { people: [] } }), {
    status: 200,
    headers: { "x-treg-cost-micro": String(costMicro) },
  });
}) as unknown as typeof fetch;

function useTools(budgetUsd: number, key: string | null = "treg-key") {
  useCrmTools({
    database,
    roleOf: async () => "admin",
    prospecting: { tregApiKey: key ?? undefined, monthlyBudgetUsd: budgetUsd },
    fetch: fakeTreg,
  });
}

async function call(tool: string, args: Json) {
  const result = await callTool(connection, tool, args);
  return {
    ...result,
    json: result.isError ? null : (JSON.parse(result.text) as Json),
  };
}

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
  await database.execute(
    sql`update crm.configuration set config = config - 'prospecting_spend' - 'prospecting_profile' where id = 1`,
  );
});

afterAll(async () => {
  useCrmTools(null);
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

test("the profile reads what won customers have in common", async () => {
  useTools(5);
  const { json: company } = await call("create_record", {
    resource: "companies",
    values: {
      name: `Glow ${run}`,
      sector: "consumer-staples",
      size: 50,
      country: "USA",
      website: `https://glow-${run}.example`,
    },
  });
  const companyId = (company as { created: Json }).created.id;
  await call("create_record", {
    resource: "deals",
    values: {
      name: `Won ${run}`,
      company_id: companyId,
      stage: "won",
      amount: 6000,
    },
  });

  const { json } = await call("customer_profile", {});

  const profile = json as {
    facts: { wonDeals: number; sectors: { value: string }[] };
    lookup_budget: { set_up: boolean; monthly_usd: number };
  };
  expect(profile.facts.wonDeals).toBeGreaterThanOrEqual(1);
  expect(profile.facts.sectors.map((sector) => sector.value)).toContain(
    "consumer-staples",
  );
  expect(profile.lookup_budget).toMatchObject({ set_up: true, monthly_usd: 5 });
});

test("a saved profile comes back on the next read", async () => {
  useTools(5);
  await call("save_customer_profile", {
    profile: "DTC beauty brands, 10-250 people, US, running paid social.",
  });
  const { json } = await call("customer_profile", {});
  expect((json as Json).saved_profile).toBe(
    "DTC beauty brands, 10-250 people, US, running paid social.",
  );
});

test("lookups count against the monthly budget and stop when it runs out", async () => {
  useTools(0.1);
  calls = [];
  costMicro = 40_000;
  const first = await call("look_up_data", {
    tool: "treg.people.search",
    body: { domain: "acme.example" },
  });
  expect(first.isError).toBe(false);
  expect((first.json as Json).cost_usd).toBe(0.04);
  await call("look_up_data", {
    tool: "treg.people.search",
    body: { domain: "b.example" },
  });
  costMicro = 30_000;
  await call("look_up_data", {
    tool: "treg.people.search",
    body: { domain: "c.example" },
  });

  const refused = await call("look_up_data", {
    tool: "treg.people.search",
    body: { domain: "d.example" },
  });

  expect(calls).toHaveLength(3);
  expect(refused.isError).toBe(true);
  expect(refused.text).toContain("budget ($0.1) is used up");
});

test("only lookups are allowed, and nothing runs without a key", async () => {
  useTools(5);
  const publish = await call("look_up_data", { tool: "postiz.post.create" });
  expect(publish.text).toContain("isn't a lookup");
  useTools(5, null);
  const noKey = await call("find_data_tools", { job: "company search" });
  expect(noKey.text).toContain("isn't set up");
});

test("a lead list adds companies and people once, tagged, with the reason as a note", async () => {
  useTools(5);
  const leads = {
    name: `Leads ${run}`,
    leads: [
      {
        company: {
          name: `Nova ${run}`,
          website: `nova-${run}.example`,
          country: "USA",
        },
        contact: {
          first_name: "Kim",
          last_name: "Park",
          title: "Head of Growth",
          email: `kim@nova-${run}.example`,
          email_verified: true,
        },
        reason: "Runs 40 Meta ads, two with creators.",
        signals: ["40 active Meta ads"],
      },
      {
        company: { name: `Glow ${run}`, website: `glow-${run}.example` },
        reason: "Already a customer.",
      },
    ],
  };

  const { json } = await call("add_leads", leads);
  const again = await call("add_leads", { ...leads, name: `Again ${run}` });

  expect(json).toMatchObject({ companies_added: 1, contacts_added: 1 });
  expect((json as { skipped: Json[] }).skipped).toEqual([
    { company: `Glow ${run}`, why: "Company already in the CRM" },
  ]);
  expect(again.json).toMatchObject({ companies_added: 0, contacts_added: 0 });
  const { json: found } = await call("list_records", {
    resource: "contacts",
    filter: { lead_source: "Magpie prospecting", last_name: "Park" },
  });
  const contact = (found as { records: Json[] }).records.find(
    (row) =>
      (row.email_jsonb as { email: string }[])[0]?.email ===
      `kim@nova-${run}.example`,
  );
  expect(contact).toMatchObject({ lifecycle_stage: "lead", status: "cold" });
  const { json: read } = await call("get_record", {
    resource: "contacts",
    id: contact?.id,
  });
  expect(JSON.stringify((read as Json).recent_notes)).toContain(
    "Runs 40 Meta ads, two with creators.",
  );
});
