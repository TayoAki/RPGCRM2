import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, like, sql } from "drizzle-orm";
import { callTool, listTools, useCrmTools } from "../src/crm/agent-tools";
import type { GovconConfig } from "../src/crm/govcon/kontract";
import type { Opportunity } from "../src/crm/govcon/kontract-api";
import { bids } from "../src/crm/schema";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const run = crypto.randomUUID().slice(0, 8);
const PERSON = {
  id: `crm-govcon-${run}`,
  email: `govcon-${run}@acme.test`,
  name: "Gail Govcon",
};
const connection = { url: "builtin://crm/", actorId: PERSON.id, botId: "bot" };
type Json = Record<string, unknown>;

const OPEN = `open-${run}`;
const CLOSED = `closed-${run}`;
const notice = (id: string): Opportunity => ({
  id,
  title: `Janitorial Services ${id}`,
  solicitationNumber: `SOL-${id}`,
  agency: "Department of the Interior",
  office: "Ely District Office",
  postedDate: "2026-10-22T23:31:54.000Z",
  responseDeadline: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  type: "Solicitation",
  setAside: "Small Business Set Aside - Total",
  setAsideCode: "SBA",
  naicsCode: "561720",
  pscCode: "S201",
  placeOfPerformance: {
    city: "Ely",
    state: "NV",
  } as Opportunity["placeOfPerformance"],
  contacts: [{ name: "Carey Grund", email: "carey@doi.example" }],
  attachments: null,
  samUrl: `https://sam.gov/opp/${id}/view`,
  source: "bulk",
});

let open = new Set([OPEN, CLOSED]);
const SOW_TEXT =
  '<document name="SOW.pdf">\n[page 2]\nContractor shall clean all restrooms daily. Floors in the 12,000 square feet lobby are waxed monthly.\n</document>';
const seen: { method: string; path: string; body: Json | null }[] = [];
const json = (value: unknown, cost = 0, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "x-kontract-cost-micro": String(cost),
    },
  });

const fakeKontract = (async (input: URL, init?: RequestInit) => {
  const url = new URL(input);
  const path = url.pathname.replace("/api/v1", "");
  const body = init?.body ? (JSON.parse(String(init.body)) as Json) : null;
  seen.push({ method: init?.method ?? "GET", path, body });
  if (path === "/opportunities") {
    return json({
      results: [notice(OPEN)],
      total: 1,
      offset: 0,
      source: "bulk",
      dataAsOf: "2026-11-02",
    });
  }
  const one = /^\/opportunities\/([^/]+)$/.exec(path)?.[1];
  if (one) {
    return open.has(one)
      ? json({
          opportunity: {
            ...notice(one),
            description: "Clean 12,000 sq ft weekly.",
          },
        })
      : json({ error: "No open notice with that id." }, 0, 404);
  }
  if (path.endsWith("/details")) {
    return json(
      {
        details: {
          noticeId: OPEN,
          readAt: "2026-11-02",
          fingerprint: "f",
          documents: [
            {
              id: "d",
              name: "SOW.pdf",
              url: "",
              size: 1,
              postedDate: null,
              read: "read",
              pages: 4,
            },
          ],
          budget: {
            value: { low: 50_000, high: 100_000, kind: "magnitude" },
            quote: "between $50,000 and $100,000",
            doc: "SOW.pdf",
          },
          bonds: null,
          siteVisit: null,
          questionsDue: null,
          period: {
            value: "1 base year and 4 options",
            quote: "one base year and four option years",
            doc: "SOW.pdf",
          },
          wageDeterminations: ["2015-5525"],
          evaluation: null,
          sizes: [
            {
              value: "12,000 sq ft",
              quote: "12,000 square feet",
              doc: "SOW.pdf",
            },
          ],
          requirements: [],
          forms: ["SF-1449"],
          priceForm: null,
        },
      },
      body?.claude ? 210_000 : 0,
    );
  }
  if (path.endsWith("/text")) {
    const offset = Number(body?.offset ?? 0);
    const limit = Number(body?.limit ?? 40_000);
    return json({
      noticeId: OPEN,
      fingerprint: "f",
      totalChars: SOW_TEXT.length,
      offset,
      nextOffset: offset + limit < SOW_TEXT.length ? offset + limit : null,
      documents: [
        {
          id: "d",
          name: "SOW.pdf",
          read: "read",
          pages: 4,
          chars: SOW_TEXT.length,
          startsAt: 0,
        },
        {
          id: "w",
          name: "Wage.pdf",
          read: "scanned",
          pages: 7,
          chars: 0,
          startsAt: null,
        },
      ],
      text: SOW_TEXT.slice(offset, offset + limit),
    });
  }
  if (path.endsWith("/quotes")) {
    return json({
      results: (body?.quotes as { quote: string }[]).map(({ quote }) => {
        const found = SOW_TEXT.toLowerCase().includes(quote.toLowerCase());
        return {
          quote,
          found,
          doc: found ? "SOW.pdf" : null,
          page: found ? 2 : null,
        };
      }),
    });
  }
  return json({ error: "Not found." }, 0, 404);
}) as unknown as typeof fetch;

const govcon = (monthlyBudgetUsd: number): GovconConfig => ({
  url: "https://kontract.example",
  serviceKey: "k".repeat(64),
  workspaceId: "magpie-test",
  monthlyBudgetUsd,
});

function useTools(config: GovconConfig | undefined) {
  useCrmTools({
    database,
    roleOf: async () => "admin",
    ...(config ? { govcon: config } : {}),
    fetch: fakeKontract,
  });
}

async function call(tool: string, args: Json = {}) {
  const result = await callTool(connection, tool, args);
  return {
    ...result,
    json: result.isError ? null : (JSON.parse(result.text) as Json),
  };
}

const resetSettings = () =>
  database.execute(
    sql`update crm.configuration set config = config - 'govcon_spend' - 'govcon_profile' where id = 1`,
  );

beforeAll(async () => {
  await database.insert(users).values({ ...PERSON, emailVerified: false });
  await resetSettings();
});

afterAll(async () => {
  useCrmTools(null);
  await database.delete(bids).where(like(bids.notice_id, `%-${run}`));
  await resetSettings();
  await database.delete(users).where(eq(users.id, PERSON.id));
  await database.$client.end({ timeout: 5 });
});

test("bid tools are offered only once Kontract is set up", async () => {
  useTools(undefined);
  const without = (await listTools()).map((tool) => tool.name);
  const refused = await call("find_bids");
  useTools(govcon(20));
  const withIt = (await listTools()).map((tool) => tool.name);

  expect(without).not.toContain("find_bids");
  expect(refused.text).toContain("aren't set up");
  expect(withIt).toContain("find_bids");
  expect(withIt).toContain("save_bid_document");
});

test("a notice found can be tracked, read and priced", async () => {
  useTools(govcon(20));
  const before = await call("find_bids", { query: "janitorial", state: "nv" });
  const tracked = await call("track_bid", {
    notice_id: OPEN,
    notes: "Call Ely subs.",
  });
  const bidId = (tracked.json as Json).bid_id as number;
  const again = await call("track_bid", { notice_id: OPEN });
  const after = await call("find_bids", { query: "janitorial" });
  const read = await call("read_bid_documents", { notice_id: OPEN });
  const priced = await call("update_bid", {
    bid_id: bidId,
    stage: "quoted",
    pricing: {
      periods: 5,
      period_label: "year",
      lines: [
        {
          description: "Weekly cleaning",
          unit: "visit",
          quantity: 52,
          sub_cost: 700,
          price: 1000,
        },
      ],
    },
    subs: [{ name: "Ely Clean Co", status: "quoted", quote: 36_400 }],
  });
  const listed = await call("list_bids", { stage: "quoted" });
  const nothing = await call("update_bid", { bid_id: bidId });

  const search = seen.find((request) => request.path === "/opportunities");
  expect(search?.method).toBe("GET");
  expect((before.json as { bids: Json[] }).bids[0]).toMatchObject({
    notice_id: OPEN,
    place: "Ely, NV",
    days_left: 14,
  });
  expect(
    (before.json as { bids: Json[] }).bids[0]?.tracked_bid_id,
  ).toBeUndefined();
  expect(again.json).toMatchObject({ bid_id: bidId, already_tracked: true });
  expect((after.json as { bids: Json[] }).bids[0]?.tracked_bid_id).toBe(bidId);
  expect(read.json).toMatchObject({
    saved_on_bid: bidId,
    budget: {
      value: { low: 50_000, high: 100_000 },
      quote: "between $50,000 and $100,000",
    },
  });
  expect(priced.json).toMatchObject({
    stage: "quoted",
    documents_read: true,
    pricing: {
      sub_cost_per_period: 36_400,
      price_per_period: 52_000,
      profit_total: 78_000,
      margin: 30,
    },
    subs: [{ name: "Ely Clean Co", status: "quoted", quote: 36_400 }],
    notes: "Call Ely subs.",
  });
  expect(
    (listed.json as { bids: Json[] }).bids.map((bid) => bid.bid_id),
  ).toContain(bidId);
  expect(nothing.text).toBe("Say what to change on the bid.");
});

test("a tracked notice stays readable after it closes", async () => {
  useTools(govcon(20));
  await call("track_bid", { notice_id: CLOSED });
  open = new Set([OPEN]);
  const closed = await call("bid_notice", { notice_id: CLOSED });
  const unknown = await call("bid_notice", { notice_id: `never-${run}` });
  await call("read_bid_documents", { notice_id: CLOSED });

  expect(closed.json).toMatchObject({
    notice_id: CLOSED,
    title: `Janitorial Services ${CLOSED}`,
  });
  expect(unknown.text).toBe("No open notice with that id.");
  const details = seen
    .filter((request) => request.path === `/opportunities/${CLOSED}/details`)
    .at(-1);
  expect((details?.body?.opportunity as Json)?.id).toBe(CLOSED);
});

test("paid reads stop at the monthly budget", async () => {
  await resetSettings();
  useTools(govcon(0.25));
  const refused = await call("bid_breakdown", { notice_id: OPEN });
  const profile = await call("company_profile");

  expect(refused.text).toContain("budget for paid reads ($0.25) is used up");
  expect(
    (profile.json as { paid_reads_budget: Json }).paid_reads_budget,
  ).toEqual({ monthly_usd: 0.25, spent_usd: 0, left_usd: 0.25 });
});

test("the Bot reads a bid's text and saves only the scope items its quotes back up", async () => {
  useTools(govcon(20));
  const page = await call("read_bid_text", { notice_id: OPEN, offset: 0 });
  const saved = await call("save_bid_reading", {
    notice_id: OPEN,
    summary: "Daily restroom cleaning and monthly floor care.",
    scope: [
      {
        description: "Clean restrooms",
        unit: "day",
        quote: "Contractor shall clean all restrooms daily",
        doc: "SOW.pdf",
      },
      {
        description: "Wax lobby floors",
        quantity: 12,
        unit: "month",
        quote: "Floors in the 12,000 square feet lobby are waxed monthly",
      },
      {
        description: "Wash windows",
        quote: "Windows are washed every quarter",
      },
    ],
    trades: ["Janitorial"],
    questions: ["Can you start within 10 days of award?"],
  });
  const untracked = await call("save_bid_reading", {
    notice_id: `never-${run}`,
    summary: "x",
    scope: [{ description: "y", quote: "Contractor shall clean" }],
  });
  const [row] = await database
    .select()
    .from(bids)
    .where(eq(bids.notice_id, OPEN));

  expect(page.json).toMatchObject({
    next_offset: null,
    documents: [
      { name: "SOW.pdf", read: "read", pages: 4, startsAt: 0 },
      { name: "Wage.pdf", read: "scanned", startsAt: null },
    ],
    text: SOW_TEXT,
  });
  expect(
    seen.find((request) => request.path.endsWith("/text"))?.body,
  ).toMatchObject({
    offset: 0,
    limit: 16_000,
    opportunity: { id: OPEN },
  });
  expect(saved.json).toMatchObject({
    saved_items: 2,
    dropped_items: ["Wash windows"],
  });
  expect(untracked.text).toBe("Track the bid first, then save its reading.");
  expect((row?.details as { reading: Json }).reading).toMatchObject({
    summary: "Daily restroom cleaning and monthly floor care.",
    scope: [
      { description: "Clean restrooms", doc: "SOW.pdf", quantity: null },
      {
        description: "Wax lobby floors",
        doc: "SOW.pdf",
        quantity: 12,
        unit: "month",
      },
    ],
    trades: ["Janitorial"],
    risks: [],
  });
  expect((row?.details as { budget: Json }).budget).toMatchObject({
    quote: "between $50,000 and $100,000",
  });
});

test("a scope or proposal the Bot wrote is saved on its bid, with the blanks it left", async () => {
  useTools(govcon(20));
  const [bid] = await database
    .select()
    .from(bids)
    .where(eq(bids.notice_id, OPEN));
  const saved = await call("save_bid_document", {
    bid_id: bid?.id,
    kind: "proposal",
    text: "# Proposal\nPast performance: [past contract]\nCAGE: [CAGE code]\nPrice: $52,000 a year.",
  });
  const [after] = await database
    .select()
    .from(bids)
    .where(eq(bids.notice_id, OPEN));

  expect(saved.json).toMatchObject({
    saved: "proposal",
    placeholders_left: ["[past contract]", "[CAGE code]"],
  });
  expect(after?.proposal).toContain("Price: $52,000 a year.");
});

test("saving the company profile keeps what wasn't given", async () => {
  useTools(govcon(20));
  await call("save_company_profile", {
    company_name: "Acme Facility Services",
    uei: "ABC123DEF456",
  });
  const { json: saved } = await call("save_company_profile", {
    cage: "1A2B3",
    default_markup_pct: 30,
  });

  expect((saved as { profile: Json }).profile).toMatchObject({
    companyName: "Acme Facility Services",
    uei: "ABC123DEF456",
    cage: "1A2B3",
    defaultMarkupPct: 30,
  });
});
