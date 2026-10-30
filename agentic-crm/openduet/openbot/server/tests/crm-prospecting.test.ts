import { describe, expect, test } from "bun:test";
import { domainOf, planLeads } from "../src/crm/prospecting/leads";
import { profileFacts } from "../src/crm/prospecting/profile";
import { isLookupTool, tregCall } from "../src/crm/prospecting/treg";

describe("treg lookups", () => {
  test("allows lookups and refuses tools that change things or generate media", () => {
    expect(isLookupTool("treg.people.email.find")).toBe(true);
    expect(isLookupTool("treg.people.search")).toBe(true);
    expect(isLookupTool("scrapecreators.reddit.subreddit.posts")).toBe(true);
    expect(isLookupTool("meta.ad_library.search")).toBe(true);
    expect(isLookupTool("google.ads.campaign.update")).toBe(false);
    expect(isLookupTool("postiz.post.create")).toBe(false);
    expect(isLookupTool("minimax.video.generate")).toBe(false);
    expect(isLookupTool("gemini.image")).toBe(false);
    expect(isLookupTool("my-tool/v1/charges")).toBe(false);
    expect(isLookupTool("https://api.stripe.com/v1/charges")).toBe(false);
  });

  test("POSTs a routed call with the cost cap and reads the price from treg's header", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: URL, init: RequestInit) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({ output: { email: "ana@acme.com" } }),
        {
          status: 200,
          headers: {
            "x-treg-cost-micro": "1500",
            "x-treg-call-id": "call_1",
            "x-treg-served-by": "hunter",
          },
        },
      );
    }) as unknown as typeof fetch;
    const result = await tregCall(
      "token",
      "treg.people.email.find",
      {
        body: { full_name: "Ana Lee", domain: "acme.com" },
        maxCostUsd: 0.25,
        verify: true,
      },
      fake,
    );
    expect(result.costMicro).toBe(1500);
    expect(result.servedBy).toBe("hunter");
    expect(seen?.url).toBe("https://treg.to/call/treg.people.email.find");
    const headers = seen?.init.headers as Record<string, string>;
    expect(seen?.init.method).toBe("POST");
    expect(headers["X-Treg-Token"]).toBe("token");
    expect(headers["X-Treg-Route-Max-Cost"]).toBe("0.2500");
    expect(headers["X-Treg-Route-Verify"]).toBe("true");
  });

  test("a refusal names the tool and treg's reason", async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ error: "balance too low" }), {
        status: 402,
      })) as unknown as typeof fetch;
    await expect(
      tregCall(
        "token",
        "treg.people.search",
        { query: { domain: "acme.com" }, maxCostUsd: 0.25 },
        fake,
      ),
    ).rejects.toThrow("treg refused treg.people.search (402): balance too low");
  });
});

describe("ideal customer profile", () => {
  test("tallies what won customers have in common", () => {
    const facts = profileFacts(
      [
        { amount: 6000, company_id: 1 },
        { amount: 3000, company_id: 1 },
        { amount: 9000, company_id: 2 },
        { amount: 0, company_id: 3 },
      ],
      [
        {
          id: 1,
          name: "Glowbird",
          sector: "consumer-staples",
          size: 50,
          city: "Los Angeles",
          country: "USA",
          lead_source: "Referral",
          website: "https://glowbird.example",
        },
        {
          id: 2,
          name: "Nimbus",
          sector: "information-technology",
          size: 50,
          city: "San Francisco",
          country: "USA",
          lead_source: "Website",
          website: null,
        },
        {
          id: 3,
          name: "Fernway",
          sector: "consumer-staples",
          size: 10,
          city: "Portland",
          country: "USA",
          lead_source: "Referral",
          website: null,
        },
      ],
    );
    expect(facts.wonDeals).toBe(4);
    expect(facts.averageDeal).toBe(6000);
    expect(facts.sectors[0]).toEqual({ value: "consumer-staples", count: 3 });
    expect(facts.sizes[0]).toEqual({ value: "50-249 employees", count: 3 });
    expect(facts.bestCustomers.map((customer) => customer.name)).toEqual([
      "Glowbird",
      "Nimbus",
      "Fernway",
    ]);
  });
});

describe("lead lists", () => {
  const lead = (name: string, website?: string, email?: string) => ({
    company: { name, ...(website ? { website } : {}) },
    contact: email
      ? { first_name: "Ana", last_name: "Lee", email, email_verified: true }
      : undefined,
    reason: "Runs many Meta ads with few creator videos.",
    signals: [],
  });

  test("reads domains from websites and emails", () => {
    expect(domainOf("https://www.Acme.com/about")).toBe("acme.com");
    expect(domainOf("acme.com")).toBe("acme.com");
    expect(domainOf("ana@Acme.com")).toBe("acme.com");
    expect(domainOf(null)).toBeNull();
  });

  test("reuses companies already in the CRM and skips people already there or listed twice", () => {
    const plan = planLeads(
      [
        lead("Acme Inc", "https://acme.com", "ana@acme.com"),
        lead("Brightside", "brightside.example", "new@brightside.example"),
        lead("Brightside", "brightside.example", "new@brightside.example"),
        lead("Zephyr Co.", "zephyr.example"),
        lead("Nova", "nova.example", "kim@nova.example"),
      ],
      {
        companies: [
          { id: 7, name: "Acme", website: null },
          {
            id: 8,
            name: "Brightside Coffee",
            website: "https://brightside.example",
          },
          { id: 9, name: "Zephyr", website: null },
        ],
        emails: ["ANA@acme.com"],
      },
    );
    expect(plan.map((each) => each.skipped)).toEqual([
      "Already in the CRM",
      null,
      "Listed twice",
      "Company already in the CRM",
      null,
    ]);
    expect(plan[1].companyId).toBe(8);
    expect(plan[4].companyId).toBeNull();
    expect(plan[4].createContact).toBe(true);
  });
});
