import { expect, test } from "bun:test";
import { applyMarkup, bidTotals, vsAnchor } from "../src/crm/govcon/bid-math";
import {
  type GovconConfig,
  type KontractError,
  kontractCall,
  kontractDraft,
  workspaceIdOf,
} from "../src/crm/govcon/kontract";
import type { PricingModel } from "../src/crm/govcon/kontract-api";

const config: GovconConfig = {
  url: "https://kontract.example",
  serviceKey: "k".repeat(64),
  workspaceId: "magpie-acme",
  monthlyBudgetUsd: 20,
};

function answering(response: () => Response, seen: Request[] = []) {
  return (async (input: URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return response();
  }) as unknown as typeof fetch;
}

test("a call carries the service key and workspace, and reads its cost", async () => {
  const seen: Request[] = [];
  const result = await kontractCall<{ ok: boolean }>(
    config,
    "/opportunities",
    { query: { q: "janitorial", state: undefined, limit: 5 } },
    answering(
      () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { "x-kontract-cost-micro": "1200" },
        }),
      seen,
    ),
  );

  expect(result).toEqual({ data: { ok: true }, costMicro: 1200 });
  const [request] = seen;
  expect(request?.url).toBe(
    "https://kontract.example/api/v1/opportunities?q=janitorial&limit=5",
  );
  expect(request?.headers.get("authorization")).toBe(
    `Bearer ${config.serviceKey}`,
  );
  expect(request?.headers.get("x-workspace-id")).toBe("magpie-acme");
});

test("refusals come back as plain messages", async () => {
  const refused = (status: number, headers: Record<string, string> = {}) =>
    kontractCall(
      config,
      "/pricing",
      { body: {} },
      answering(
        () =>
          new Response(JSON.stringify({ error: "No open notice." }), {
            status,
            headers,
          }),
      ),
    ).catch((error: KontractError) => [error.status, error.message]);

  expect(await refused(401)).toEqual([
    401,
    "The bid service refused this workspace's key. Ask the admin.",
  ]);
  expect(await refused(429, { "retry-after": "12" })).toEqual([
    429,
    "The bid service is busy. Wait 12 seconds and try again.",
  ]);
  expect(await refused(404)).toEqual([404, "No open notice."]);
  expect(
    await kontractCall({ ...config, serviceKey: undefined }, "/pricing").catch(
      (error: KontractError) => error.status,
    ),
  ).toBe(503);
});

test("a draft is read to its end, and a failed one keeps what it spent", async () => {
  const stream = (...events: unknown[]) =>
    answering(
      () =>
        new Response(events.map((event) => JSON.stringify(event)).join("\n"), {
          headers: { "content-type": "application/x-ndjson" },
        }),
    );

  const draft = await kontractDraft(
    config,
    {},
    stream(
      { type: "meta", source: "claude" },
      { type: "text", text: "## Scope\n" },
      { type: "text", text: "Weekly cleaning." },
      { type: "done", costMicro: 90_000 },
    ),
  );
  const failed = await kontractDraft(
    config,
    {},
    stream(
      { type: "meta", source: "claude" },
      { type: "error", message: "Claude is overloaded." },
      { type: "done", costMicro: 4_000 },
    ),
  ).catch((error: KontractError) => [error.message, error.costMicro]);

  expect(draft).toEqual({
    data: { text: "## Scope\nWeekly cleaning.", source: "claude" },
    costMicro: 90_000,
  });
  expect(failed).toEqual(["Claude is overloaded.", 4_000]);
});

test("the workspace id fits what Kontract accepts", () => {
  expect(workspaceIdOf("magpie-UGC_Mediakits")).toBe("magpie-ugc-mediakits");
  expect(workspaceIdOf(undefined)).toBe("magpie");
  expect(workspaceIdOf("x".repeat(80))).toHaveLength(64);
});

// Kontract's own examples: $700 sub per pickup, $1,500 charged, 15 pickups a year for 5 years.
const waste: PricingModel = {
  periods: 5,
  periodLabel: "year",
  lines: [
    {
      id: "a",
      description: "Pickup",
      unit: "pickup",
      quantity: 15,
      subCost: 700,
      price: 1500,
    },
  ],
};

test("bid totals per year and over the contract", () => {
  const totals = bidTotals(waste);
  expect(totals.profitPerPeriod).toBe(12_000);
  expect(totals.profitTotal).toBe(60_000);
  expect(totals.priceTotal).toBe(112_500);
  expect(totals.margin).toBeCloseTo(12_000 / 22_500);
  expect(
    bidTotals({ periods: 0, periodLabel: "year", lines: [] }).margin,
  ).toBeNull();
});

test("markup prices each line from its sub cost, and the anchor compares per year", () => {
  expect(applyMarkup(waste, 35).lines[0]?.price).toBe(945);
  expect(waste.lines[0]?.price).toBe(1500);
  const landscaping: PricingModel = {
    periods: 5,
    periodLabel: "year",
    lines: [
      {
        id: "x",
        description: "Grounds",
        unit: "month",
        quantity: 12,
        subCost: 0,
        price: 962_000 / 60,
      },
    ],
    anchor: {
      annual: 1_600_000 / 5,
      total: 1_600_000,
      label: "previous contract",
    },
  };
  expect(vsAnchor(landscaping)).toBeCloseTo(962_000 / 1_600_000 - 1);
  expect(vsAnchor({ ...landscaping, anchor: undefined })).toBeNull();
});
