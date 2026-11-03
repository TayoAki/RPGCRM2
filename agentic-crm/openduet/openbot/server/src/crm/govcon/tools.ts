import { z } from "zod";
import type { AuthenticatedActor } from "../../auth/guards";
import type { Database } from "../../db/client";
import type { McpTool } from "../../plugins/mcp";
import type { CrmRecords } from "../records";
import {
  bidById,
  bidByNotice,
  bidSummary,
  daysLeft,
  listBids,
  rememberOnBid,
  STAGES,
  trackBid,
  trackedIds,
  updateBid,
} from "./bids";
import {
  type GovconConfig,
  isConfigured,
  KontractError,
  kontractCall,
} from "./kontract";
import type {
  BidDetails,
  BreakdownResponse,
  Cited,
  DetailsResponse,
  OpportunitiesResponse,
  Opportunity,
  OpportunityResponse,
  PermitContractor,
  PermitContractorsResponse,
  PermitsResponse,
  PricingModel,
  PricingResponse,
  Subcontractor,
  SubcontractorsResponse,
  WebsiteResponse,
} from "./kontract-api";
import {
  addGovconSpend,
  companyProfile,
  govconSpent,
  saveCompanyProfile,
} from "./settings";

export type GovconDeps = {
  database: Database;
  govcon?: GovconConfig;
  fetch?: typeof fetch;
};

type Outcome = { ok: true; value: unknown } | { ok: false; message: string };

// Least budget a call may start with: a Claude read or draft costs up to about $0.30, a business
// search or website read a few cents.
const NEEDS_CLAUDE_MICRO = 300_000;
const NEEDS_LOOKUP_MICRO = 50_000;
const DESCRIPTION_CHARS = 12_000;
const NOT_SET_UP =
  "Government bids aren't set up in this workspace. Ask the admin to turn them on.";

const noticeId = {
  type: "string",
  description: "The notice's id from find_bids.",
};

// Tool results are capped at 20,000 characters (plugins/mcp.ts), so a page of text stays under it.
const TEXT_PAGE_CHARS = 16_000;

// Kontract's /text and /quotes (KONTRACT.md, Part 1b), until its contract file lists them.
type BidTextResponse = {
  noticeId: string;
  fingerprint: string;
  totalChars: number;
  offset: number;
  nextOffset: number | null;
  documents: {
    id: string;
    name: string;
    read: string;
    pages: number | null;
    chars: number;
    startsAt: number | null;
  }[];
  text: string;
};

type QuotesResponse = {
  results: {
    quote: string;
    found: boolean;
    doc: string | null;
    page: number | null;
  }[];
};

const readingSchema = z.object({
  summary: z.string().trim().min(1).max(1500),
  scope: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(500),
        quantity: z.number().min(0).optional(),
        unit: z.string().trim().max(40).optional(),
        quote: z.string().trim().min(8).max(1000),
        doc: z.string().trim().max(300).optional(),
      }),
    )
    .min(1)
    .max(60),
  trades: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  questions: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  risks: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});

export const GOVCON_TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "find_bids",
    description:
      "Search every open federal (SAM.gov) notice and state and local bid. Free. Defaults to open service bids, best fit first. A good first bid: a service, a small-business set-aside, 14+ days to respond.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A trade or service, such as 'janitorial'.",
        },
        state: { type: "string", description: "Two letters, such as TX." },
        naics: { type: "string" },
        set_aside: {
          type: "string",
          description: "Such as SBA, WOSB, SDVOSBC, 8A, HZC.",
        },
        level: {
          type: "string",
          enum: ["federal", "sled"],
          description: "sled is state and local only.",
        },
        posted_within_days: { type: "number" },
        min_days_to_respond: { type: "number" },
        services_only: { type: "boolean", description: "Default true." },
        open_only: {
          type: "boolean",
          description: "Only notices taking bids now. Default true.",
        },
        sort: { type: "string", enum: ["fit", "deadline", "newest"] },
        limit: { type: "number", description: "1 to 25. Default 10." },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "bid_notice",
    description:
      "One notice in full: its description, contacts, place and dates. Free.",
    inputSchema: {
      type: "object",
      properties: { notice_id: noticeId },
      required: ["notice_id"],
    },
  },
  {
    name: "read_bid_documents",
    description:
      "Read a notice's attachments for the facts that decide a bid: budget, bonds, site visit, when questions are due, how long the work runs, wage rates, how they pick, sizes, requirements and forms, each with the sentence it came from. Free. Saved on the bid when it's tracked. For the scope itself, read the documents with read_bid_text.",
    inputSchema: {
      type: "object",
      properties: { notice_id: noticeId },
      required: ["notice_id"],
    },
  },
  {
    name: "read_bid_text",
    description:
      "A notice's documents as text, most important first (notice, amendments, statement of work, solicitation, price schedule, Q&A), each in <document name=...> with [page N] marks, 16,000 characters a page. Free. Start at offset 0; documents says where each one starts, so jump to the statement of work or price schedule with its startsAt. Scanned documents have no text: say so.",
    inputSchema: {
      type: "object",
      properties: {
        notice_id: noticeId,
        offset: {
          type: "number",
          description:
            "Where to start, from documents' startsAt or next_offset.",
        },
      },
      required: ["notice_id"],
    },
  },
  {
    name: "save_bid_reading",
    description:
      "Save your reading of a tracked bid: a summary, the scope item by item, the trades it needs, questions for subs and risks. Every scope item must quote the exact words it came from in read_bid_text, and name the document. Items whose quote isn't in the documents are dropped and listed back to you. The person approves first.",
    inputSchema: {
      type: "object",
      properties: {
        notice_id: noticeId,
        summary: { type: "string", description: "Two or three sentences." },
        scope: {
          type: "array",
          maxItems: 60,
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
              quote: {
                type: "string",
                description:
                  "The exact words from the document, 8 to 300 characters.",
              },
              doc: { type: "string", description: "The document's name." },
            },
            required: ["description", "quote"],
          },
        },
        trades: { type: "array", items: { type: "string" } },
        questions: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
      },
      required: ["notice_id", "summary", "scope"],
    },
  },
  {
    name: "bid_breakdown",
    description:
      "A plain-English read of a notice: the work, who does it, what kind of subcontractor to search for, suggested price lines, contract length, requirements, questions for subs and red flags. Saved on the bid when it's tracked.",
    inputSchema: {
      type: "object",
      properties: { notice_id: noticeId },
      required: ["notice_id"],
    },
  },
  {
    name: "past_pricing",
    description:
      "What the government paid for similar work, from USAspending. Free. Returns the typical price per year and per award, the most relevant past awards (same agency and state flagged likely_related, often the previous contract) and who won them. With few results, drop naics, then state, then shorten the keywords.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Each 3+ characters.",
        },
        naics: { type: "string" },
        state: { type: "string" },
        agency: { type: "string" },
        years_back: { type: "number", description: "Default 5." },
        services_only: { type: "boolean", description: "Default true." },
      },
      required: ["keywords"],
    },
  },
  {
    name: "find_subcontractors",
    description:
      "Local businesses that could do the work, from business listings (with rating, reviews and phone) or a web search (website only: read it with read_business_website for phone and email). Costs a few cents. Results marked sample are placeholders: say so.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Such as 'commercial cleaning company'.",
        },
        location: { type: "string", description: "Such as 'Ely, NV'." },
      },
      required: ["query", "location"],
    },
  },
  {
    name: "read_business_website",
    description:
      "Read a business's website for its emails, phones, license numbers, services, area and years in business. Costs a cent or two. Only what the site prints: never proof of a license or insurance.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "permit_leads",
    description:
      "Recent building permits in a city or county, one per address, with the contractor and owner where published and which trades each is a lead for. Free.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string" },
        market: {
          type: "string",
          description: "A market id, such as austin-tx.",
        },
        days: { type: "number", description: "0 to 30. Default 7." },
        trade: {
          type: "string",
          description: "Such as fence, landscaping, roofing, pool.",
        },
        min_strength: {
          type: "string",
          enum: ["strong", "likely", "possible"],
        },
        min_value: { type: "number" },
        residential_only: { type: "boolean" },
        names_contractor: { type: "boolean" },
        zip: { type: "string" },
        query: { type: "string" },
      },
      required: ["state"],
    },
  },
  {
    name: "permit_contractors",
    description:
      "Businesses pulling permits for this kind of work near a job: licensed, local and busy, so good subs to call. Free.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string" },
        city: { type: "string" },
        work: {
          type: "array",
          items: { type: "string" },
          description:
            "Such as hvac, electrical, plumbing, general, roofing, landscaping.",
        },
      },
      required: ["state"],
    },
  },
  {
    name: "list_bids",
    description:
      "The bids this company is tracking, soonest deadline first, with stage, days left, price, profit and margin, and the subs on each.",
    inputSchema: {
      type: "object",
      properties: { stage: { type: "string", enum: [...STAGES] } },
    },
  },
  {
    name: "company_profile",
    description:
      "The company details proposals are written from (name, UEI, CAGE, address, contact, capabilities, default markup), and how much of this month's budget for paid reads is left.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "track_bid",
    description:
      "Track a notice as a bid, with an optional note, so it's on the company's list and keeps its copy after the notice closes. The person approves first.",
    inputSchema: {
      type: "object",
      properties: { notice_id: noticeId, notes: { type: "string" } },
      required: ["notice_id"],
    },
  },
  {
    name: "update_bid",
    description:
      "Change a tracked bid: its stage, notes, price lines, the subs on it, scope of work or proposal. pricing and subs replace what's there, so send all of them. The person approves first.",
    inputSchema: {
      type: "object",
      properties: {
        bid_id: { type: "number" },
        stage: { type: "string", enum: [...STAGES] },
        notes: { type: "string" },
        pricing: {
          type: "object",
          properties: {
            periods: {
              type: "number",
              description: "Years the contract runs, or 1 for a one-time job.",
            },
            period_label: { type: "string", enum: ["year", "contract"] },
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  unit: { type: "string" },
                  quantity: {
                    type: "number",
                    description: "Units per period.",
                  },
                  sub_cost: {
                    type: "number",
                    description: "What the sub charges, per unit.",
                  },
                  price: {
                    type: "number",
                    description: "What the government is charged, per unit.",
                  },
                },
                required: [
                  "description",
                  "unit",
                  "quantity",
                  "sub_cost",
                  "price",
                ],
              },
            },
            anchor: {
              type: "object",
              description: "The past award this price is set against.",
              properties: {
                annual: { type: "number" },
                total: { type: "number" },
                label: { type: "string" },
              },
              required: ["total", "label"],
            },
          },
          required: ["periods", "period_label", "lines"],
        },
        subs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              website: { type: "string" },
              address: { type: "string" },
              status: {
                type: "string",
                enum: ["new", "contacted", "quoted", "selected", "declined"],
              },
              quote: { type: "number", description: "Their total per period." },
              notes: { type: "string" },
            },
            required: ["name", "status"],
          },
        },
        scope: {
          type: "string",
          description: "The scope of work, in Markdown.",
        },
        proposal: { type: "string", description: "The proposal, in Markdown." },
      },
      required: ["bid_id"],
    },
  },
  {
    name: "save_company_profile",
    description:
      "Save the company details proposals are written from. Only what the person gave you: never make up a UEI, CAGE, license or past work. The person approves first.",
    inputSchema: {
      type: "object",
      properties: {
        company_name: { type: "string" },
        uei: { type: "string" },
        cage: { type: "string" },
        address: { type: "string" },
        contact_name: { type: "string" },
        contact_title: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
        capabilities: { type: "string" },
        default_markup_pct: { type: "number" },
      },
    },
  },
  {
    name: "save_bid_document",
    description:
      "Save a scope of work or proposal you wrote on its tracked bid. A scope goes to subs: no government contacts and no prices. A proposal follows the notice's own instructions and uses the company profile; leave anything you don't know as a [placeholder], never invent past performance, licenses or certifications. Answers with the placeholders left. Also make it a Doc with make_page so the person can read and edit it. The person approves first.",
    inputSchema: {
      type: "object",
      properties: {
        bid_id: { type: "number" },
        kind: { type: "string", enum: ["scope", "proposal"] },
        text: {
          type: "string",
          description: "The whole document, in Markdown.",
        },
      },
      required: ["bid_id", "kind", "text"],
    },
  },
]);

export const GOVCON_TOOL_NAMES = GOVCON_TOOLS.map((tool) => tool.name);
export const GOVCON_WRITE_TOOLS = [
  "track_bid",
  "update_bid",
  "save_company_profile",
  "save_bid_reading",
  "save_bid_document",
];

const usd = (micro: number) => Math.round(micro / 10_000) / 100;
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const clip = (value: string | undefined, max: number) =>
  value && value.length > max ? `${value.slice(0, max)}…` : value;
const stateOf = (value: unknown) => {
  const state = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(state) ? state : undefined;
};

async function budget(deps: GovconDeps) {
  const limit = Math.round((deps.govcon?.monthlyBudgetUsd ?? 0) * 1e6);
  const spent = await govconSpent(deps.database);
  return { limit, spent, left: Math.max(0, limit - spent) };
}

/** Runs a paid call: refuses it past the budget, and counts what it cost, even when it failed. */
async function paid<TData>(
  deps: GovconDeps,
  needs: number,
  call: () => Promise<{ data: TData; costMicro: number }>,
): Promise<{ data: TData; costMicro: number }> {
  const { left, limit } = await budget(deps);
  if (left < needs) {
    throw new KontractError(
      `This month's budget for paid reads ($${usd(limit)}) is used up. Use the free tools, or ask the admin to raise it.`,
      402,
    );
  }
  try {
    const result = await call();
    await addGovconSpend(deps.database, result.costMicro);
    return result;
  } catch (error) {
    if (error instanceof KontractError)
      await addGovconSpend(deps.database, error.costMicro);
    throw error;
  }
}

const placeOf = (opportunity: Opportunity) => {
  const place = [
    opportunity.placeOfPerformance?.city,
    opportunity.placeOfPerformance?.state,
  ]
    .filter(Boolean)
    .join(", ");
  return place && opportunity.placeFromOffice
    ? `${place} (contracting office)`
    : place || null;
};

function noticeSummary(opportunity: Opportunity, now: Date, bidId?: number) {
  return {
    notice_id: opportunity.id,
    title: opportunity.title,
    agency: opportunity.agency,
    office: opportunity.office || undefined,
    type: opportunity.type,
    set_aside: opportunity.setAside,
    naics: opportunity.naicsCode,
    psc: opportunity.pscCode,
    place: placeOf(opportunity),
    posted: opportunity.postedDate?.slice(0, 10),
    deadline: opportunity.responseDeadline,
    days_left: daysLeft(opportunity.responseDeadline, now),
    level: opportunity.level ?? "federal",
    url: opportunity.samUrl,
    ...(opportunity.portal ? { portal: opportunity.portal } : {}),
    ...(opportunity.isSample ? { sample: true } : {}),
    ...(bidId === undefined ? {} : { tracked_bid_id: bidId }),
  };
}

const cited = <TValue>(fact: Cited<TValue> | null | undefined) =>
  fact ? { value: fact.value, quote: fact.quote, doc: fact.doc } : null;

function detailsSummary(details: BidDetails) {
  return {
    documents: details.documents.map((document) => ({
      name: document.name,
      read: document.read,
      ...(document.pages ? { pages: document.pages } : {}),
      ...(document.note ? { note: document.note } : {}),
    })),
    budget: cited(details.budget),
    bonds: cited(details.bonds),
    site_visit: cited(details.siteVisit),
    questions_due: cited(details.questionsDue),
    period: cited(details.period),
    wage_determinations: details.wageDeterminations.slice(0, 6),
    evaluation: cited(details.evaluation),
    sizes: details.sizes.slice(0, 8).map(cited),
    requirements: details.requirements.slice(0, 15).map(cited),
    forms: details.forms.slice(0, 20),
    price_form: details.priceForm,
    ...(details.reading ? { reading: details.reading } : {}),
  };
}

const contractorSummary = (contractor: PermitContractor) => ({
  name: contractor.name,
  phone: contractor.phone,
  license: contractor.license,
  insured_until: contractor.insuredUntil,
  permits: contractor.permits,
  jobs: contractor.jobs,
  latest: contractor.latest,
  types: contractor.types.slice(0, 5),
});

const pricingSchema = z.object({
  periods: z.number().int().min(1).max(20),
  period_label: z.enum(["year", "contract"]),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        unit: z.string().trim().min(1).max(40),
        quantity: z.number().min(0),
        sub_cost: z.number().min(0),
        price: z.number().min(0),
      }),
    )
    .max(50),
  anchor: z
    .object({
      annual: z.number().min(0).nullable().optional(),
      total: z.number().min(0),
      label: z.string().trim().min(1).max(200),
    })
    .optional(),
});

const subsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(200),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().max(200).optional(),
      website: z.string().trim().max(300).optional(),
      address: z.string().trim().max(300).optional(),
      status: z.enum(["new", "contacted", "quoted", "selected", "declined"]),
      quote: z.number().min(0).optional(),
      notes: z.string().trim().max(2000).optional(),
    }),
  )
  .max(25);

const updateSchema = z.object({
  bid_id: z.number().int(),
  stage: z.enum(STAGES).optional(),
  notes: z.string().max(5000).optional(),
  pricing: pricingSchema.optional(),
  subs: subsSchema.optional(),
  scope: z.string().max(50_000).optional(),
  proposal: z.string().max(100_000).optional(),
});

const invalid = (error: z.ZodError): Outcome => ({
  ok: false,
  message: `That isn't valid: ${error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".")} ${issue.message}`)
    .join("; ")}`,
});

/** Price lines in Kontract's shape. A line keeps its id across edits while it keeps its place. */
export function pricingModel(
  input: z.infer<typeof pricingSchema>,
  previous: PricingModel | null,
): PricingModel {
  return {
    periods: input.periods,
    periodLabel: input.period_label,
    lines: input.lines.map((line, index) => ({
      id: previous?.lines[index]?.id ?? `line-${index + 1}`,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      subCost: line.sub_cost,
      price: line.price,
    })),
    ...(input.anchor
      ? {
          anchor: {
            annual: input.anchor.annual ?? null,
            total: input.anchor.total,
            label: input.anchor.label,
          },
        }
      : {}),
  };
}

/** The shortlist in Kontract's shape, keeping what Magpie doesn't edit (vetting, quote links). */
export function shortlist(
  input: z.infer<typeof subsSchema>,
  previous: Subcontractor[],
): Subcontractor[] {
  const byName = new Map(previous.map((sub) => [sub.name.toLowerCase(), sub]));
  return input.map((sub, index) => {
    const before = byName.get(sub.name.toLowerCase());
    return {
      ...(before ?? { source: "manual" as const, vetting: {} }),
      id: before?.id ?? `sub-${Date.now().toString(36)}-${index}`,
      name: sub.name,
      status: sub.status,
      ...(sub.phone ? { phone: sub.phone } : {}),
      ...(sub.email ? { email: sub.email } : {}),
      ...(sub.website ? { website: sub.website } : {}),
      ...(sub.address ? { address: sub.address } : {}),
      ...(sub.quote === undefined ? {} : { quote: sub.quote }),
      ...(sub.notes ? { notes: sub.notes } : {}),
    };
  });
}

async function findBids(
  deps: GovconDeps,
  config: GovconConfig,
  args: Record<string, unknown>,
) {
  const limit = Math.min(25, Math.max(1, Math.round(number(args.limit) ?? 10)));
  const { data } = await kontractCall<OpportunitiesResponse>(
    config,
    "/opportunities",
    {
      query: {
        q: text(args.query, 200),
        state: stateOf(args.state),
        naics: text(args.naics, 12),
        setAside: text(args.set_aside, 20),
        level:
          args.level === "federal" || args.level === "sled"
            ? args.level
            : undefined,
        postedWithinDays: number(args.posted_within_days),
        minDaysToRespond: number(args.min_days_to_respond),
        servicesOnly: args.services_only === false ? undefined : 1,
        biddableOnly: args.open_only === false ? undefined : 1,
        sort: ["fit", "deadline", "newest"].includes(String(args.sort))
          ? String(args.sort)
          : "fit",
        limit,
        offset: Math.max(0, Math.round(number(args.offset) ?? 0)),
      },
    },
    deps.fetch,
  );
  const now = new Date();
  const tracked = await trackedIds(
    deps.database,
    data.results.map((notice) => notice.id),
  );
  return {
    total: data.total,
    showing: data.results.length,
    data_as_of: data.dataAsOf,
    ...(data.notice ? { notice: data.notice } : {}),
    ...(data.source === "sample"
      ? { sample: "SAM.gov couldn't be loaded: these are sample notices." }
      : {}),
    bids: data.results.map((notice) =>
      noticeSummary(notice, now, tracked.get(notice.id)),
    ),
  };
}

async function noticeFor(deps: GovconDeps, config: GovconConfig, id: string) {
  const tracked = await bidByNotice(deps.database, id);
  try {
    const { data } = await kontractCall<OpportunityResponse>(
      config,
      `/opportunities/${encodeURIComponent(id)}`,
      {},
      deps.fetch,
    );
    return { opportunity: data.opportunity, tracked };
  } catch (error) {
    // A closed notice leaves the index; its tracked copy is still good.
    if (error instanceof KontractError && error.status === 404 && tracked) {
      return { opportunity: tracked.opportunity as Opportunity, tracked };
    }
    throw error;
  }
}

/** Runs a government bid tool, or returns null for a tool name that isn't one. */
export async function runGovconTool(
  deps: GovconDeps,
  records: CrmRecords,
  actor: AuthenticatedActor,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Outcome | null> {
  if (!GOVCON_TOOL_NAMES.includes(toolName)) return null;
  const config = deps.govcon;
  if (!config || !isConfigured(config))
    return { ok: false, message: NOT_SET_UP };
  const id = text(args.notice_id, 100);
  const now = new Date();
  try {
    switch (toolName) {
      case "find_bids":
        return { ok: true, value: await findBids(deps, config, args) };
      case "bid_notice": {
        if (!id) return { ok: false, message: "Give the notice's id." };
        const { opportunity, tracked } = await noticeFor(deps, config, id);
        return {
          ok: true,
          value: {
            ...noticeSummary(opportunity, now, tracked?.id),
            solicitation_number: opportunity.solicitationNumber,
            contacts: opportunity.contacts,
            description: clip(opportunity.description, DESCRIPTION_CHARS) ?? "",
          },
        };
      }
      case "read_bid_documents":
      case "bid_breakdown": {
        if (!id) return { ok: false, message: "Give the notice's id." };
        const tracked = await bidByNotice(deps.database, id);
        const body = tracked ? { opportunity: tracked.opportunity } : {};
        const path = `/opportunities/${encodeURIComponent(id)}`;
        if (toolName === "bid_breakdown") {
          const { data } = await paid(deps, NEEDS_CLAUDE_MICRO, () =>
            kontractCall<BreakdownResponse>(
              config,
              `${path}/breakdown`,
              { body, timeoutMs: 180_000 },
              deps.fetch,
            ),
          );
          const saved = await rememberOnBid(deps.database, id, {
            breakdown: data.breakdown,
          });
          return {
            ok: true,
            value: { ...data.breakdown, saved_on_bid: saved },
          };
        }
        const { data } = await kontractCall<DetailsResponse>(
          config,
          `${path}/details`,
          { body, timeoutMs: 180_000 },
          deps.fetch,
        );
        const saved = await rememberOnBid(deps.database, id, {
          details: data.details,
        });
        return {
          ok: true,
          value: { ...detailsSummary(data.details), saved_on_bid: saved },
        };
      }
      case "past_pricing": {
        const keywords = (Array.isArray(args.keywords) ? args.keywords : [])
          .map((keyword) => text(keyword, 80))
          .filter(
            (keyword): keyword is string => !!keyword && keyword.length >= 3,
          )
          .slice(0, 6);
        if (!keywords.length)
          return {
            ok: false,
            message: "Give at least one keyword of 3 or more letters.",
          };
        const state = stateOf(args.state);
        const { data } = await kontractCall<PricingResponse>(
          config,
          "/pricing",
          {
            body: {
              query: {
                keywords,
                ...(text(args.naics, 12)
                  ? { naics: text(args.naics, 12) }
                  : {}),
                ...(state ? { state } : {}),
                yearsBack: Math.min(
                  10,
                  Math.max(1, Math.round(number(args.years_back) ?? 5)),
                ),
                servicesOnly: args.services_only !== false,
              },
              context: { agency: text(args.agency, 200), state },
            },
            timeoutMs: 90_000,
          },
          deps.fetch,
        );
        return {
          ok: true,
          value: {
            stats: data.stats,
            awards: data.awards.slice(0, 12).map((award) => ({
              recipient: award.recipient,
              amount: award.amount,
              per_year: award.annualAmount,
              agency: award.subAgency || award.agency,
              start: award.startDate,
              end: award.endDate,
              description: clip(award.description, 200),
              state: award.state,
              likely_related: award.likelyRelated,
              url: award.url,
            })),
            past_winners: data.recipients.slice(0, 8),
            note: "Amounts are dollars obligated so far: a contract still running shows less than its full value.",
          },
        };
      }
      case "find_subcontractors": {
        const query = text(args.query, 200);
        const location = text(args.location, 200);
        if (!query || !location)
          return {
            ok: false,
            message: "Give what kind of business and where.",
          };
        const { data } = await paid(deps, NEEDS_LOOKUP_MICRO, () =>
          kontractCall<SubcontractorsResponse>(
            config,
            "/subcontractors",
            { body: { query, location }, timeoutMs: 150_000 },
            deps.fetch,
          ),
        );
        return {
          ok: true,
          value: {
            source: data.source,
            ...(data.source === "sample"
              ? {
                  sample:
                    "No business search is set up: these are sample listings.",
                }
              : {}),
            ...((data.source as string) === "web"
              ? {
                  next: "These came from a web search: read the best websites with read_business_website for phone, email and licenses.",
                }
              : {}),
            ...(data.notice ? { notice: data.notice } : {}),
            businesses: data.results.slice(0, 10),
          },
        };
      }
      case "read_business_website": {
        const url = text(args.url, 500);
        if (!url) return { ok: false, message: "Give the website's address." };
        const { data } = await paid(deps, NEEDS_LOOKUP_MICRO, () =>
          kontractCall<WebsiteResponse>(
            config,
            "/websites/read",
            { body: { url }, timeoutMs: 90_000 },
            deps.fetch,
          ),
        );
        return { ok: true, value: data.facts };
      }
      case "permit_leads": {
        const state = stateOf(args.state);
        if (!state) return { ok: false, message: "Pick a state." };
        const trade = text(args.trade, 40);
        const { data } = await kontractCall<PermitsResponse>(
          config,
          "/permits",
          {
            query: {
              state,
              market: text(args.market, 80),
              days: Math.min(
                30,
                Math.max(0, Math.round(number(args.days) ?? 7)),
              ),
              trade,
              minStrength: text(args.min_strength, 10),
              minValue: number(args.min_value),
              residentialOnly: args.residential_only === true ? 1 : undefined,
              hasContractor: args.names_contractor === true ? 1 : undefined,
              leadsOnly: 1,
              zip: text(args.zip, 5),
              q: text(args.query, 200),
            },
            timeoutMs: 120_000,
          },
          deps.fetch,
        );
        return {
          ok: true,
          value: {
            leads: data.total,
            addresses: data.addresses,
            naming_a_contractor: data.withContractor,
            by_trade: data.byTrade,
            permits: data.permits.slice(0, 12).map((permit) => ({
              number: permit.number,
              issued: permit.issuedDate,
              type: permit.type,
              description: clip(permit.description, 160),
              address: [permit.address, permit.city, permit.state, permit.zip]
                .filter(Boolean)
                .join(", "),
              value: permit.value,
              contractor: permit.contractor,
              contractor_phone: permit.contractorPhone,
              contractor_license: permit.contractorLicense,
              owner: permit.owner,
              residential: permit.residential,
              lead_for: permit.trades
                .filter((tag) => !trade || tag.trade === trade)
                .slice(0, 4)
                .map((tag) => `${tag.trade} (${tag.strength}): ${tag.reason}`),
              url: permit.url,
            })),
            busiest_contractors: data.contractors
              .slice(0, 10)
              .map(contractorSummary),
            feeds_failing: data.sources
              .filter((source) => source.error)
              .map((source) => source.name),
          },
        };
      }
      case "permit_contractors": {
        const state = stateOf(args.state);
        if (!state) return { ok: false, message: "Pick a state." };
        const work = (Array.isArray(args.work) ? args.work : [])
          .map((item) => text(item, 30))
          .filter(Boolean)
          .join(",");
        const { data } = await kontractCall<PermitContractorsResponse>(
          config,
          "/permits/contractors",
          {
            query: { state, city: text(args.city, 100), work },
            timeoutMs: 120_000,
          },
          deps.fetch,
        );
        return {
          ok: true,
          value: { contractors: data.slice(0, 15).map(contractorSummary) },
        };
      }
      case "list_bids": {
        const stage = STAGES.find((each) => each === args.stage);
        const rows = await listBids(deps.database, stage);
        return {
          ok: true,
          value: { bids: rows.map((row) => bidSummary(row, now)) },
        };
      }
      case "company_profile": {
        const { limit, spent, left } = await budget(deps);
        return {
          ok: true,
          value: {
            profile: await companyProfile(deps.database),
            paid_reads_budget: {
              monthly_usd: usd(limit),
              spent_usd: usd(spent),
              left_usd: usd(left),
            },
          },
        };
      }
      case "track_bid": {
        if (!id) return { ok: false, message: "Give the notice's id." };
        const { opportunity } = await noticeFor(deps, config, id);
        const sale = await records.sale(actor);
        const { row, created } = await trackBid(
          deps.database,
          opportunity,
          sale.id,
          text(args.notes, 5000) ?? "",
        );
        return {
          ok: true,
          value: { ...bidSummary(row, now), already_tracked: !created },
        };
      }
      case "update_bid": {
        const parsed = updateSchema.safeParse(args);
        if (!parsed.success) return invalid(parsed.error);
        const { bid_id, pricing, subs, ...rest } = parsed.data;
        const before = await bidById(deps.database, bid_id);
        if (!before) return { ok: false, message: `There's no bid ${bid_id}.` };
        if (
          !pricing &&
          !subs &&
          !Object.values(rest).some((value) => value !== undefined)
        ) {
          return { ok: false, message: "Say what to change on the bid." };
        }
        const row = await updateBid(deps.database, bid_id, {
          ...rest,
          ...(pricing
            ? {
                pricing: pricingModel(
                  pricing,
                  before.pricing as PricingModel | null,
                ),
              }
            : {}),
          ...(subs
            ? {
                subs: shortlist(
                  subs,
                  (before.subs as Subcontractor[] | null) ?? [],
                ),
              }
            : {}),
        });
        return { ok: true, value: row ? bidSummary(row, now) : null };
      }
      case "save_company_profile": {
        const current = await companyProfile(deps.database);
        const markup = number(args.default_markup_pct);
        const profile = {
          companyName: text(args.company_name, 200) ?? current.companyName,
          uei: text(args.uei, 20) ?? current.uei,
          cage: text(args.cage, 10) ?? current.cage,
          address: text(args.address, 300) ?? current.address,
          contactName: text(args.contact_name, 200) ?? current.contactName,
          contactTitle: text(args.contact_title, 100) ?? current.contactTitle,
          email: text(args.email, 200) ?? current.email,
          phone: text(args.phone, 40) ?? current.phone,
          website: text(args.website, 300) ?? current.website,
          capabilities: text(args.capabilities, 3000) ?? current.capabilities,
          defaultMarkupPct:
            markup !== undefined && markup >= 0 && markup <= 300
              ? markup
              : current.defaultMarkupPct,
        };
        await saveCompanyProfile(deps.database, profile);
        return { ok: true, value: { saved: true, profile } };
      }
      case "read_bid_text": {
        if (!id) return { ok: false, message: "Give the notice's id." };
        const tracked = await bidByNotice(deps.database, id);
        const { data } = await kontractCall<BidTextResponse>(
          config,
          `/opportunities/${encodeURIComponent(id)}/text`,
          {
            body: {
              offset: Math.max(0, Math.round(number(args.offset) ?? 0)),
              limit: TEXT_PAGE_CHARS,
              ...(tracked ? { opportunity: tracked.opportunity } : {}),
            },
            timeoutMs: 180_000,
          },
          deps.fetch,
        );
        return {
          ok: true,
          value: {
            total_chars: data.totalChars,
            offset: data.offset,
            next_offset: data.nextOffset,
            documents: data.documents.map((document) => ({
              name: document.name,
              read: document.read,
              ...(document.pages ? { pages: document.pages } : {}),
              startsAt: document.startsAt,
            })),
            text: data.text,
          },
        };
      }
      case "save_bid_reading": {
        if (!id) return { ok: false, message: "Give the notice's id." };
        const parsed = readingSchema.safeParse(args);
        if (!parsed.success) return invalid(parsed.error);
        const tracked = await bidByNotice(deps.database, id);
        if (!tracked) {
          return {
            ok: false,
            message: "Track the bid first, then save its reading.",
          };
        }
        const body = { opportunity: tracked.opportunity };
        const path = `/opportunities/${encodeURIComponent(id)}`;
        const { data: checked } = await kontractCall<QuotesResponse>(
          config,
          `${path}/quotes`,
          {
            body: {
              ...body,
              quotes: parsed.data.scope.map((item) => ({
                quote: item.quote,
                ...(item.doc ? { doc: item.doc } : {}),
              })),
            },
            timeoutMs: 120_000,
          },
          deps.fetch,
        );
        const kept = parsed.data.scope.flatMap((item, index) => {
          const result = checked.results[index];
          return result?.found
            ? [
                {
                  description: item.description,
                  quantity: item.quantity ?? null,
                  unit: item.unit ?? null,
                  quote: item.quote,
                  doc: result.doc ?? item.doc ?? "",
                },
              ]
            : [];
        });
        const dropped = parsed.data.scope
          .filter((_, index) => !checked.results[index]?.found)
          .map((item) => item.description);
        const details =
          (tracked.details as BidDetails | null) ??
          (
            await kontractCall<DetailsResponse>(
              config,
              `${path}/details`,
              { body, timeoutMs: 180_000 },
              deps.fetch,
            )
          ).data.details;
        await rememberOnBid(deps.database, id, {
          details: {
            ...details,
            reading: {
              summary: parsed.data.summary,
              scope: kept,
              trades: parsed.data.trades,
              questions: parsed.data.questions,
              risks: parsed.data.risks,
              readAt: now.toISOString(),
            },
          },
        });
        return {
          ok: true,
          value: {
            saved_items: kept.length,
            dropped_items: dropped,
            ...(dropped.length
              ? {
                  note: "These quotes weren't found in the documents, so those items were left out. Quote the exact words to keep them.",
                }
              : {}),
          },
        };
      }
      case "save_bid_document": {
        const bidId = number(args.bid_id);
        const kind =
          args.kind === "proposal"
            ? "proposal"
            : args.kind === "scope"
              ? "scope"
              : null;
        const written = text(args.text, 100_000);
        if (bidId === undefined || !kind || !written)
          return {
            ok: false,
            message: "Give the bid's id, scope or proposal, and the text.",
          };
        const row = await bidById(deps.database, bidId);
        if (!row) return { ok: false, message: `There's no bid ${bidId}.` };
        await updateBid(
          deps.database,
          bidId,
          kind === "scope" ? { scope: written } : { proposal: written },
        );
        const placeholders = [
          ...new Set(written.match(/\[[^\]\n]{1,80}\]/g) ?? []),
        ];
        return {
          ok: true,
          value: {
            saved: kind,
            characters: written.length,
            placeholders_left: placeholders,
          },
        };
      }
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof KontractError)
      return { ok: false, message: error.message };
    throw error;
  }
}
