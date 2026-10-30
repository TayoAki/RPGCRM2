import type { AuthenticatedActor } from "../../auth/guards";
import type { Database } from "../../db/client";
import type { McpTool } from "../../plugins/mcp";
import type { CrmRecords, CrmRow } from "../records";
import {
  domainOf,
  type Existing,
  LEAD_SOURCE,
  type Lead,
  leadListSchema,
  planLeads,
} from "./leads";
import { profileFacts } from "./profile";
import {
  addSpend,
  type ProspectingConfig,
  savedProfile,
  saveProfile,
  spentThisMonth,
} from "./settings";
import { isLookupTool, TregError, tregCall, tregCatalog } from "./treg";

export type ProspectingDeps = {
  database: Database;
  prospecting?: ProspectingConfig;
  fetch?: typeof fetch;
};

type Outcome = { ok: true; value: unknown } | { ok: false; message: string };

const MAX_CALL_USD = 0.25;
const WON = ["won"];

const leadProperties = {
  company: {
    type: "object",
    properties: {
      name: { type: "string" },
      website: { type: "string" },
      sector: { type: "string" },
      size: { type: "number", description: "Headcount." },
      city: { type: "string" },
      country: { type: "string" },
      description: { type: "string" },
    },
    required: ["name"],
  },
  contact: {
    type: "object",
    description: "One decision maker there, if you found one.",
    properties: {
      first_name: { type: "string" },
      last_name: { type: "string" },
      title: { type: "string" },
      email: { type: "string" },
      email_verified: {
        type: "boolean",
        description: "True only when a verifier called the address valid.",
      },
      linkedin_url: { type: "string" },
    },
    required: ["first_name"],
  },
  reason: {
    type: "string",
    description:
      "Why this company fits the profile, in one or two sentences a person can check.",
  },
  signals: {
    type: "array",
    items: { type: "string" },
    description:
      "The evidence, such as 'Running 40 Meta ads, 2 with creators'.",
  },
};

export const PROSPECTING_TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "customer_profile",
    description:
      "Start prospecting here. Returns the saved ideal customer profile, if there is one, and what the workspace's won deals have in common: industries, company size, location, lead sources, deal size and the best customers. Also says how much of this month's lookup budget is left.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "save_customer_profile",
    description:
      "Save the ideal customer profile so later lead lists use it: who to look for, the signals that matter, and who to leave out. The person approves it first.",
    inputSchema: {
      type: "object",
      properties: { profile: { type: "string", maxLength: 2000 } },
      required: ["profile"],
    },
  },
  {
    name: "find_data_tools",
    description:
      "Search the paid data catalog for tools that do a job, such as 'company search by industry and headcount', 'Meta ad library search by advertiser', 'brands running TikTok ads' or 'find people at a company'. Free. Returns tool ids with prices. Prefer routed tools named treg.*, which pick the provider for you.",
    inputSchema: {
      type: "object",
      properties: { job: { type: "string" } },
      required: ["job"],
    },
  },
  {
    name: "data_tool_details",
    description:
      "One data tool's parameters, price and an example call. Free. Read it before calling a tool you haven't used.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "look_up_data",
    description:
      "Call a data tool and get its answer. Each call costs money from the workspace's monthly budget, is capped at $0.25, and reports what it cost. Only lookups are allowed. Send `query` for a GET tool or `body` for a routed treg.* tool. Common routed tools: treg.people.search (people at a company), treg.people.email.find (a work email; set verify to true), treg.people.email.verify, treg.web.search, treg.web.extract. Never repeat a lookup you already made.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", description: "The tool's id." },
        query: { type: "object", description: "Query parameters." },
        body: { type: "object", description: "JSON body, for routed tools." },
        verify: {
          type: "boolean",
          description: "Verify a found email or phone in the same call.",
        },
      },
      required: ["tool"],
    },
  },
  {
    name: "add_leads",
    description: `Add a lead list to the CRM in one step. The person approves the list first. Each lead is a company, optionally one person there, and why it fits. Companies already in the CRM are reused and people already there are skipped. Leads are tagged with the list's name and get the lead source "${LEAD_SOURCE}". Nothing is emailed. At most 50 leads.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The list's name, such as 'Leads Nov 3'.",
        },
        leads: {
          type: "array",
          maxItems: 50,
          items: {
            type: "object",
            properties: leadProperties,
            required: ["company", "reason"],
          },
        },
      },
      required: ["name", "leads"],
    },
  },
]);

export const PROSPECTING_TOOL_NAMES = PROSPECTING_TOOLS.map(
  (tool) => tool.name,
);
export const PROSPECTING_WRITE_TOOLS = ["add_leads", "save_customer_profile"];

const usd = (micro: number) => Math.round(micro / 10_000) / 100;

async function budget(deps: ProspectingDeps) {
  const limit = Math.round((deps.prospecting?.monthlyBudgetUsd ?? 0) * 1e6);
  const spent = await spentThisMonth(deps.database);
  return { limit, spent, left: Math.max(0, limit - spent) };
}

const tokenOf = (deps: ProspectingDeps) => deps.prospecting?.tregApiKey;
const NOT_SET_UP =
  "Prospecting isn't set up in this workspace: there's no data catalog key. Ask the admin.";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function customerProfile(
  deps: ProspectingDeps,
  records: CrmRecords,
  actor: AuthenticatedActor,
) {
  const deals = await records.list(actor, "deals", {
    filter: { "stage@in": `(${WON.join(",")})`, "archived_at@is": null },
    perPage: 500,
  });
  const ids = [
    ...new Set(
      deals.data
        .map((deal) => deal.company_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const companies = ids.length
    ? (
        await records.list(actor, "companies", {
          filter: { "id@in": `(${ids.join(",")})` },
          perPage: 500,
        })
      ).data
    : [];
  const { limit, spent, left } = await budget(deps);
  return {
    saved_profile: await savedProfile(deps.database),
    facts: profileFacts(
      deals.data.map((deal) => ({
        amount: Number(deal.amount) || 0,
        company_id:
          typeof deal.company_id === "number" ? deal.company_id : null,
      })),
      companies.map((company) => ({
        id: Number(company.id),
        name: String(company.name ?? ""),
        sector: (company.sector as string | null) ?? null,
        size: (company.size as number | null) ?? null,
        city: (company.city as string | null) ?? null,
        country: (company.country as string | null) ?? null,
        lead_source: (company.lead_source as string | null) ?? null,
        website: (company.website as string | null) ?? null,
      })),
    ),
    lookup_budget: {
      set_up: !!tokenOf(deps),
      monthly_usd: usd(limit),
      spent_usd: usd(spent),
      left_usd: usd(left),
    },
  };
}

const cleanName = (name: string) =>
  name
    .replace(/\b(inc|llc|ltd|co|corp|company|gmbh)\b\.?/gi, "")
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .trim();

async function existingFor(
  records: CrmRecords,
  actor: AuthenticatedActor,
  leads: Lead[],
): Promise<Existing> {
  const companies = new Map<number, Existing["companies"][number]>();
  const emails: string[] = [];
  for (const lead of leads) {
    const domain = domainOf(lead.company.website);
    const searches: Record<string, unknown>[] = [];
    if (domain) searches.push({ "website@ilike": domain });
    const name = cleanName(lead.company.name);
    if (name) searches.push({ "name@ilike": name });
    for (const filter of searches) {
      const { data } = await records.list(actor, "companies", {
        filter,
        perPage: 5,
      });
      for (const row of data) {
        companies.set(Number(row.id), {
          id: Number(row.id),
          name: String(row.name ?? ""),
          website: (row.website as string | null) ?? null,
        });
      }
    }
    const email = lead.contact?.email?.toLowerCase();
    if (email) {
      const { data } = await records.list(actor, "contacts_summary", {
        filter: { "email_fts@ilike": email },
        perPage: 5,
      });
      const known = data.some((contact) =>
        ((contact.email_jsonb as { email?: string }[] | null) ?? []).some(
          (entry) => entry.email?.toLowerCase() === email,
        ),
      );
      if (known) emails.push(email);
    }
  }
  return { companies: [...companies.values()], emails };
}

async function addLeads(
  records: CrmRecords,
  actor: AuthenticatedActor,
  args: unknown,
): Promise<Outcome> {
  const parsed = leadListSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: `The list isn't valid: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    };
  }
  const list = parsed.data;
  const plan = planLeads(
    list.leads,
    await existingFor(records, actor, list.leads),
  );
  const tag = (await records.create(actor, "tags", {
    name: `Leads: ${list.name}`.slice(0, 80),
    color: "#e2ece9",
  })) as CrmRow;
  let companiesAdded = 0;
  let contactsAdded = 0;
  const skipped: { company: string; why: string }[] = [];
  for (const step of plan) {
    const { lead } = step;
    if (step.skipped) {
      skipped.push({ company: lead.company.name, why: step.skipped });
      continue;
    }
    let companyId = step.companyId;
    if (companyId === null) {
      const company = (await records.create(actor, "companies", {
        name: lead.company.name,
        website: lead.company.website ?? null,
        sector: lead.company.sector ?? null,
        size: lead.company.size ?? null,
        city: lead.company.city ?? null,
        country: lead.company.country ?? null,
        description: lead.company.description ?? lead.reason,
        lifecycle_stage: "lead",
        lead_source: LEAD_SOURCE,
      })) as CrmRow;
      companyId = Number(company.id);
      companiesAdded += 1;
    }
    if (!step.createContact || !lead.contact) continue;
    const contact = (await records.create(actor, "contacts", {
      first_name: lead.contact.first_name,
      last_name: lead.contact.last_name,
      title: lead.contact.title ?? null,
      company_id: companyId,
      status: "cold",
      lifecycle_stage: "lead",
      lead_source: LEAD_SOURCE,
      lead_source_detail: list.name,
      background: lead.reason,
      linkedin_url: lead.contact.linkedin_url ?? null,
      email_jsonb: lead.contact.email
        ? [{ email: lead.contact.email, type: "Work" }]
        : [],
      tags: [Number(tag.id)],
    })) as CrmRow;
    contactsAdded += 1;
    await records.create(actor, "contact_notes", {
      contact_id: Number(contact.id),
      status: "cold",
      text: [
        `Found by ${LEAD_SOURCE} for "${list.name}".`,
        lead.reason,
        lead.signals.length ? `Signals: ${lead.signals.join("; ")}` : null,
        lead.contact.email
          ? lead.contact.email_verified
            ? "Email verified."
            : "Email not verified: check it before sending."
          : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }
  return {
    ok: true,
    value: {
      list: list.name,
      tag: tag.name,
      companies_added: companiesAdded,
      contacts_added: contactsAdded,
      skipped,
      view: `/crm/contacts?filter=${encodeURIComponent(
        JSON.stringify({ lead_source_detail: list.name }),
      )}`,
    },
  };
}

async function lookUp(
  deps: ProspectingDeps,
  args: Record<string, unknown>,
): Promise<Outcome> {
  const token = tokenOf(deps);
  if (!token) return { ok: false, message: NOT_SET_UP };
  const tool = typeof args.tool === "string" ? args.tool.trim() : "";
  if (!tool) return { ok: false, message: "Give the tool's id." };
  if (!isLookupTool(tool)) {
    return {
      ok: false,
      message: `${tool} isn't a lookup. Prospecting only looks things up: it doesn't publish, change ad accounts or generate media.`,
    };
  }
  const { left, limit } = await budget(deps);
  if (left < 1000) {
    return {
      ok: false,
      message: `This month's lookup budget ($${usd(limit)}) is used up. Stop here and say how far you got.`,
    };
  }
  const query = isObject(args.query)
    ? Object.fromEntries(
        Object.entries(args.query).filter(
          (entry): entry is [string, string | number | boolean] =>
            ["string", "number", "boolean"].includes(typeof entry[1]),
        ),
      )
    : undefined;
  const result = await tregCall(
    token,
    tool,
    {
      ...(query ? { query } : {}),
      ...(isObject(args.body) ? { body: args.body } : {}),
      maxCostUsd: Math.min(MAX_CALL_USD, left / 1e6),
      verify: args.verify === true,
    },
    deps.fetch,
  );
  await addSpend(deps.database, result.costMicro);
  return {
    ok: true,
    value: {
      ...(result.status === 202
        ? { pending: "The provider is still working. Don't call it again." }
        : {}),
      cost_usd: result.costMicro / 1e6,
      served_by: result.servedBy,
      budget_left_usd: usd(Math.max(0, left - result.costMicro)),
      answer: result.data,
    },
  };
}

/** Runs a prospecting tool, or returns null for a tool name that isn't one. */
export async function runProspectingTool(
  deps: ProspectingDeps,
  records: CrmRecords,
  actor: AuthenticatedActor,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Outcome | null> {
  try {
    switch (toolName) {
      case "customer_profile":
        return {
          ok: true,
          value: await customerProfile(deps, records, actor),
        };
      case "save_customer_profile": {
        const profile =
          typeof args.profile === "string" ? args.profile.trim() : "";
        if (!profile) return { ok: false, message: "Give the profile's text." };
        await saveProfile(deps.database, profile.slice(0, 2000));
        return { ok: true, value: { saved: true } };
      }
      case "find_data_tools": {
        const token = tokenOf(deps);
        if (!token) return { ok: false, message: NOT_SET_UP };
        const job = typeof args.job === "string" ? args.job.trim() : "";
        if (!job)
          return { ok: false, message: "Say what job the tool should do." };
        return {
          ok: true,
          value: await tregCatalog(token, "catalog_search", { query: job }),
        };
      }
      case "data_tool_details": {
        const token = tokenOf(deps);
        if (!token) return { ok: false, message: NOT_SET_UP };
        const id = typeof args.id === "string" ? args.id.trim() : "";
        if (!id) return { ok: false, message: "Give the tool's id." };
        return {
          ok: true,
          value: await tregCatalog(token, "catalog_get", { id }),
        };
      }
      case "look_up_data":
        return await lookUp(deps, args);
      case "add_leads":
        return await addLeads(records, actor, args);
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof TregError)
      return { ok: false, message: error.message };
    throw error;
  }
}
