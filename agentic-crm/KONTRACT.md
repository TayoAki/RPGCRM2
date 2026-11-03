# Kontract in Magpie: what to build and what to provide

Kontract becomes the engine and Magpie becomes the app.

- **Kontract** keeps the public data: SAM.gov notices, state and local bids, permits, bid document reading, USAspending, business search. It is loaded once for every customer.
- **Magpie** keeps each company's own data: bids, subs, quote links, proposals, company profile. Customers sign in only to Magpie.
- Magpie's server calls Kontract over HTTPS with a service key. Nothing is bulk-copied. Magpie saves only what a customer acts on.

## Status, November 2

- **Part 1 is live** at https://kontract-production.up.railway.app (Kontract commit `34551b9`). The service key is set on Kontract and on the sign-up service.
- **Milestone 1 is built.** Bots have 15 bid tools and 6 skills, and each was checked against the live engine. A workspace gets them when `KONTRACT_URL` and `KONTRACT_SERVICE_KEY` are set on it. They aren't shared to every workspace, so other customers' Bots don't carry 15 tools they'll never use.
- Quote links moved to milestone 2, since they need the public page.

There are three parts:

1. The Kontract engine API, built in the Kontract repo. Part 1 below can be pasted as is into a Kontract session.
2. The Magpie side, built in this repo.
3. What you provide.

---

## Part 1: Kontract engine API (build in TayoAki/Kontract)

> Paste this whole part into a session working on the Kontract repo.

Add a versioned API under `/api/v1/` for another server to call. Don't change the existing screens or `/api/*` routes; the current app keeps working. Out of scope: sub accounts, Stripe and MCP.

### 1.1 Service auth

- New env var `KONTRACT_SERVICE_KEYS`: comma-separated keys, each at least 32 random bytes (`openssl rand -hex 32`).
- New `src/lib/service-auth.ts` with `withService(handler)`, shaped like `withUser` in `src/lib/http.ts`:
  - It reads `Authorization: Bearer <key>` and compares it to every listed key in constant time. Hash both sides with sha256, then use `timingSafeEqual`.
  - It requires `X-Workspace-Id`: 1 to 64 characters, `[a-z0-9-]`. Magpie sends `magpie-<slug>`. The handler gets it as `caller.workspaceId`.
  - On failure it returns `401 {error}`. The error never says which part was wrong.
- `/api/v1/*` never reads a session cookie and never touches `app_record` or any per-user table.
- `GET /api/v1/health` is the only route without a key.

### 1.2 Endpoints

All responses are JSON with `Cache-Control: no-store`. Errors are `{error: string}` with a 4xx or 5xx status, using the messages the current routes already use.

| Method and path | Input | Returns | Reuses |
|---|---|---|---|
| `GET /api/v1/health` | none | `{ok, samAsOf, notices, sledBids, permitFeeds: {ok, failing}}` | `sam-bulk.ts` status, `sled.ts`, `permit-health.ts` |
| `GET /api/v1/opportunities` | The query params of `/api/opportunities`, with `limit` at most 100 | `OpportunityResults`, without descriptions | `searchSamOpportunities`, `sledOpportunities` |
| `GET /api/v1/opportunities/:id` | none | `{opportunity}` with its description, or 404 | the index `byId`, `samDescription`, SLED bids |
| `POST /api/v1/opportunities/:id/details` | `{claude?: boolean, opportunity?: Opportunity}` | `{details: BidDetails}` | `readBid`, `readBidWithClaude` |
| `POST /api/v1/opportunities/:id/breakdown` | `{opportunity?: Opportunity}` | `{breakdown: Breakdown, source: "claude" \| "rules"}` | `claudeBreakdown`, `rules.ts` |
| `POST /api/v1/pricing` | `{query: PricingQuery, context?: {agency?, state?}}` | `PricingResults` with stats and recipients | `searchPastAwards`, `pricingStats`, `recipients` |
| `POST /api/v1/subcontractors` | `{query, location}` | `SubSearchResult` | `findSubcontractors` |
| `POST /api/v1/websites/read` | `{url}` | the site facts the current `/api/subs/website` returns | `sub-website.ts`, `site-facts.ts` |
| `GET /api/v1/permits` | The query params of `/api/permits` | `PermitResults` | `permits.ts` |
| `GET /api/v1/permits/contractors` | `state`, `city`, `work` | `PermitContractor[]` | `permitContractors` |
| `GET /api/v1/sources` | none | permit and bid feeds with health, states, markets, trades | `permit-sources.ts`, `permit-health.ts`, `sled-sources.ts` |
| `POST /api/v1/drafts` | `{kind: "sow" \| "outreach" \| "proposal", deal: Deal, profile: CompanyProfile, subId?: string}` | NDJSON, with the same events as `/api/ai/draft` plus a final `{type: "done", costMicro}` | `prompts.ts`, `templates.ts`, `streamDraft` |
| `GET /api/v1/usage` | `workspace`, `month` (`YYYY-MM`) | `{calls, costMicro, byEndpoint: {[path]: {calls, costMicro}}}` | new `service_call` table |

Rules for these endpoints:

- **`/details` and `/breakdown`** look the notice up by id first. Use the `opportunity` in the body only when the id is no longer in the index, because it closed or was awarded. A tracked bid has to stay readable after it closes.
- **`/drafts`** takes the company profile from the request, not from `getProfile`. Nothing in the request is stored or logged beyond the usage row.
- **Detail responses** stay under 200 KB. Trim each cited sentence to 300 characters.

### 1.3 Costs, metering and limits

- Every v1 response that spent money sets `X-Kontract-Cost-Micro`, an integer in millionths of a dollar. That covers:
  - Claude reads, breakdowns and drafts, priced from the real token usage;
  - Google Places or Apify;
  - Firecrawl pages.
- Free calls set `0`. A draft streams before its cost is known, so it reports the cost in its final `done` event.
- Record every v1 call in a new `service_call` table: `workspace_id`, `endpoint`, `cost_micro`, `status`, `at`.
- Rate limits per workspace: 60 requests a minute in total, and 10 a minute on the Claude routes (`details` with `claude: true`, `breakdown`, `drafts`). Over the limit, return `429` with `Retry-After`.

### 1.4 The contract file

- Add `src/lib/api-v1.ts`, re-exporting exactly the types the v1 responses use: `Opportunity`, `OpportunityResults`, `BidDetails`, `Breakdown`, `PricingResults`, `SubSearchResult`, `PermitResults`, `PermitContractor`, `Deal`, `CompanyProfile` and what they reference.
- Changes are additive only. Removing or renaming a field means `/api/v2`.
- Magpie copies this file to type its client.

### 1.5 Tests

- `src/lib/service-auth.test.ts` checks four cases:
  - no key is refused;
  - a wrong key is refused;
  - every key in the list is accepted;
  - a missing or malformed `X-Workspace-Id` is refused.
- A test that reads every file under `src/app/api/v1/` and fails if a handler is exported without `withService`. `health` is the one exception.
- The existing `npm test` and `npm run typecheck` still pass.

### 1.6 Deploy

- One Railway service with a volume at `/data`, at least 1 GB of memory and a public domain.
- Variables:
  - `DATA_DIR=/data`;
  - `KONTRACT_SERVICE_KEYS`;
  - `ANTHROPIC_API_KEY`;
  - `GOOGLE_PLACES_API_KEY` or `APIFY_API_TOKEN`;
  - `FIRECRAWL_API_KEY`;
  - optionally `SOCRATA_APP_TOKEN`.

### 1.7 Done when

```bash
curl -s https://<kontract>/api/v1/health
curl -s -o /dev/null -w '%{http_code}\n' https://<kontract>/api/v1/opportunities                # 401
curl -s -H "Authorization: Bearer $KEY" -H 'X-Workspace-Id: magpie-test' \
  'https://<kontract>/api/v1/opportunities?q=janitorial&servicesOnly=1&limit=5'                  # 5 notices
curl -s -X POST -H "Authorization: Bearer $KEY" -H 'X-Workspace-Id: magpie-test' -H 'Content-Type: application/json' \
  -d '{}' https://<kontract>/api/v1/opportunities/<a real notice id>/details                     # budget and bonds with their sentences
curl -s -H "Authorization: Bearer $KEY" 'https://<kontract>/api/v1/usage?workspace=magpie-test&month=2026-11'
```

---

## Part 1b: bid text for Magpie's own Bot (build in TayoAki/Kontract)

> Paste this whole part into a session working on the Kontract repo.

Magpie's Bots do the AI work, using Magpie's own model: reading the scope item by item, questions for subs, risks, scopes of work and proposals. Kontract supplies the documents' text and checks the quotes. Kontract needs no `ANTHROPIC_API_KEY` for any of this.

Two new routes. Both go through `withService`, cost `0`, and are listed in `src/lib/api-v1.ts`. Changes are additive.

### 1. `POST /api/v1/opportunities/:id/text`

**Body:**

```json
{ "offset": 0, "limit": 40000, "opportunity": { } }
```

- `offset`: optional, default 0.
- `limit`: optional, default 40,000, at most 80,000 characters.
- `opportunity`: only when the id is no longer in the index (closed or awarded), exactly as `/details` takes it.

**Answer:**

```json
{
  "noticeId": "0602507394964d76986220e4c04c2194",
  "fingerprint": "same value as details.fingerprint",
  "totalChars": 182345,
  "offset": 0,
  "nextOffset": 40000,
  "documents": [
    { "id": "notice", "name": "Notice", "read": "read", "pages": null, "chars": 2100, "startsAt": 0 },
    { "id": "a1", "name": "A04_Statement_of_Work.pdf", "read": "read", "pages": 16, "chars": 41000, "startsAt": 2150 },
    { "id": "a3", "name": "B03_Wage_Determination.pdf", "read": "scanned", "pages": 7, "chars": 0, "startsAt": null }
  ],
  "text": "<document name=\"Notice\">\n...\n</document>\n\n<document name=\"A04_Statement_of_Work.pdf\">\n[page 1]\n..."
}
```

**What the text is:**
- The notice description first, then every readable attachment in `orderDocs` order, each wrapped in `<document name="...">`.
- `[page N]` markers where PDF pages are known.
- Leave out wage determinations, sign-in sheets and maps (rank 8).
- Use the same per-document excerpting as `buildCorpus`, with up to 400,000 characters in total.
- `text` is the slice from `offset` to `offset + limit`, cut at the nearest paragraph break.
- `nextOffset` is `null` on the last page.

**Behaviour:**
- `documents` lists every attachment, including scanned and failed ones, with `read` saying which, and `startsAt` saying where each begins in the combined text.
- Reuse the cache `/details` keeps per attachment set, so paging through a bid downloads it once.

**Errors:** the same as `/details`: 404 for no such notice, 502 when SAM.gov can't be reached.

### 2. `POST /api/v1/opportunities/:id/quotes`

**Body:**

```json
{ "quotes": [ { "quote": "Contractor shall clean all restrooms daily", "doc": "A04_Statement_of_Work.pdf" } ], "opportunity": { } }
```

At most 100 quotes, each up to 1,000 characters. `doc` is optional.

**Answer:**

```json
{ "results": [ { "quote": "Contractor shall clean all restrooms daily", "found": true, "doc": "A04_Statement_of_Work.pdf", "page": 3 } ] }
```

- Use `quoteFound`'s matching: whitespace and case squashed, at least 8 characters, searched in the named document first, then all of them.
- `doc` and `page` say where it was actually found, or `null`.

### 3. Business search through Firecrawl

**When it applies:** when there's no `GOOGLE_PLACES_API_KEY` or `APIFY_API_TOKEN`, `POST /api/v1/subcontractors` searches the web through Firecrawl (`https://api.firecrawl.dev/v2/search`), using the `FIRECRAWL_API_KEY` Kontract already has, instead of returning samples. Same for `findSubcontractors` in the app.

**How:**
- Search `"<query> near <location>"`, at most 10 results, without scraping.
- Skip directory and review sites:
  - Yelp, Angi, HomeAdvisor, Thumbtack, BBB, Yellow Pages, MapQuest, Nextdoor;
  - Facebook, LinkedIn and Indeed listing pages.
- Keep at most one result per website.
- Each kept result becomes a `FoundSub`:
  - `name` is the page title with the site name and "Home" trimmed;
  - `website` is its URL;
  - `category` is the query;
  - `address` and `phone` are left empty (the Bot reads them with `/websites/read`);
  - `source` is `"web"`.
- Add `"web"` to the `source` union of `Subcontractor` and `SubSearchResult` in `api-v1.ts` (additive).
- Charge the search's Firecrawl credits through `addCost`.
- Cache 24 hours, like the Places path.

**Errors:** when Firecrawl fails, return samples with a `notice` that says so, as today.

### Tests and done when

- **Tests:**
  - paging: offsets join back to the whole text, and `nextOffset` ends `null`;
  - quotes: found, not found, and wrong document but found elsewhere;
  - web search: directories are skipped, one result per site, `source` is `"web"`.
- **Done when:**

  ```bash
  curl -s -X POST -H "Authorization: Bearer $KEY" -H 'X-Workspace-Id: magpie-test' -H 'Content-Type: application/json' \
    -d '{"limit":5000}' https://<kontract>/api/v1/opportunities/<a real notice id>/text
  ```

  This returns the first 5,000 characters, with `documents` and a `nextOffset`.

## Part 2: Magpie side (built in this repo)

### Milestone 1: Bots can work a bid (about 3 to 4 days after the engine is live)

1. **Config.** A GovCon workspace has `KONTRACT_URL` and `KONTRACT_SERVICE_KEY` set. The sign-up service holds both, ready for GovCon sign-ups. `GOVCON_MONTHLY_BUDGET_USD` defaults to 20.
2. **Client.** `server/src/crm/govcon/kontract.ts`:
   - sends `X-Workspace-Id: $DEPLOYMENT_ID`;
   - uses timeouts;
   - adds `X-Kontract-Cost-Micro` to the month's spend and refuses calls past the budget, as the prospecting spend does.
3. **Company data.**
   - New CRM tables: `bids` (notice snapshot, stage, details, pricing, subs, scope, proposal, unique notice id), `quote_requests` and `lead_shares` (token links).
   - The company profile (UEI, CAGE, capabilities, default markup) lives in `crm.configuration`.
4. **Bot tools**, trimmed before they reach the model:
   - Reads: `find_bids`, `bid_notice`, `read_bid_documents`, `read_bid_text`, `bid_breakdown`, `past_pricing`, `find_subcontractors`, `read_business_website`, `permit_leads`, `permit_contractors`, `list_bids`, `company_profile`.
   - Writes, which need approval: `track_bid`, `update_bid`, `save_company_profile`, `save_bid_reading`, `save_bid_document`.
   - The AI work (the scope item by item, questions, risks, scopes of work and proposals) is done by Magpie's Bot. Kontract serves the text and checks the quotes (Part 1b).
5. **Skills and routine.**
   - Skills from Kontract's `directives/`: find opportunities, research past pricing, find subcontractors, write the proposal.
   - A weekly routine: "Monday: find this week's bids".

### Milestone 2: screens (about 2 weeks)

1. **Bids screen.** The search sidebar, then each notice with Overview, Past pricing, Subcontractors and Proposal tabs and the right panel. Ported from Kontract's components onto Magpie's UI kit and data loading.
2. **Quote links.** A public `/q/:token` page from `QuotePage.tsx`, with `quote.ts` and its test copied unchanged. A sub's quote lands in the bid on its own.
3. **Proposal.** Magpie's editor, plus `proposal-doc.ts` for Word export, the [placeholder] check and the pre-submit checklist.
4. **Sub bench.** Contacts tagged by trade, with a stage: Found, Contacted, Quoted, Active sub or Not a fit. A bid's subs link to those contacts.
5. **Today.** This week and Deadlines cards.
6. **Permit leads and Data sources screens,** and the public `/l/:token` page for passing a lead to a sub.
7. **The Kontract edition.** A tenant package with its name, logo and skills.
8. **COGS.md.** Add the GovCon lookup costs.

Copied unchanged into Magpie, with their tests: `quote.ts`, `bid-math.ts`, `proposal-doc.ts`, `placeholders.ts`, `lead-share.ts`, `deal.ts`, `week.ts`.

---

## Part 3: What you provide

| # | What | Why |
|---|---|---|
| 1 | Who builds Part 1: your Kontract session, or me with push access to `TayoAki/Kontract` | Part 1 is all in that repo |
| 2 | Read access to `TayoAki/Kontract` for this session | Porting the screens and reading `directives/`, which wasn't in the zip |
| 3 | Where Kontract runs: its Railway project name, or "not deployed" so I deploy it | `KONTRACT_URL` |
| 4 | The keys from 1.6, set on Kontract's Railway service yourself. Don't paste them in chat | Bid reading, business search and website reading |
| 5 | Nothing for the service key | I generate it and set it on both services |
| 6 | Edition branding: the name, a logo (SVG plus a square icon) and the brand color | The tenant package |
| 7 | The paid lookup budget per workspace each month ($20 suggested, about 100 bid reads with Claude) and which plan the edition is sold on | The budget guard and COGS |
| 8 | A test company: a made-up UEI and CAGE, one state, and 2 or 3 NAICS codes | Checking the whole flow end to end |
