# Magpie: integrations

**Status:** ready to build. **Last updated:** 2026-11-10. **Facts checked:** 2026-11-10 against the providers' docs linked in each section.

This file specifies every outside service Magpie calls or receives calls from: how adapters are structured, what each one calls, its limits, retries, idempotency, failure behaviour, test fakes, and what to verify before writing code. Names of tables, columns, modules, queues and roles come from [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md); HTTP surfaces are in [API.md](API.md).

How to read the status words:
- **Confirmed** means the fact was read in the provider's official docs (or observed in a live call, which is said) on the date above.
- **Verify** means it could not be confirmed, or it moves often. The build agent checks it before writing the adapter and records the answer in an ADR under `docs/decisions/`.
- ARCHITECTURE §3 applies everywhere: "Do not write code from memory." Pin every SDK version in the lockfile.

## 1. Inventory

| # | Integration | Port(s) | Release | Credential |
|---|---|---|---|---|
| 3 | Kontract engine `/api/v1` | `OpportunitySource` (all methods), `BidTextSource`, `WebsiteReader`, `MarketCatalog` | MVP | platform |
| 4 | SAM.gov Get Opportunities API | `OpportunitySource.search` and `.get` (fallback), `AwardNoticeFeed` | MVP | platform |
| 5 | SAM.gov Entity Management API | `EntityRegistry` | MVP | platform |
| 6 | USAspending.gov API | `OpportunitySource.findComparables` (fallback) | MVP | none |
| 7 | SAM.gov wage determinations | `WageDeterminationSource` | MVP | none |
| 8 | NAICS code list (Census, SBA) | static data in `packages/shared` | MVP | none |
| 9 | Postmark | `EmailSender` (transactional, outreach), inbound and event webhooks | MVP | platform |
| 10 | Gmail API, send only | `EmailSender` (connected mailbox) | MVP | per user (OAuth) |
| 11 | Microsoft Graph, `Mail.Send` | `EmailSender` (connected mailbox) | MVP | per user (OAuth) |
| 12 | Twilio Programmable Messaging and Verify | `SmsSender`, `PhoneVerifier` | MVP | platform |
| 13 | Telegram Bot API | `TelegramClient` | MVP | platform |
| 14 | Stripe | `BillingProvider` | MVP | platform |
| 15 | Cloudflare R2 | `ObjectStorage` | MVP | platform |
| 16 | ClamAV (`clamd`) | `MalwareScanner` | MVP | none (private network) |
| 17 | Text extraction (Kontract text, PDF, DOCX, XLSX, OCR by model vision) | `TextExtractor` | MVP | via other adapters |
| 18 | Document rendering (DOCX, PDF through Gotenberg) | `DocumentRenderer` | MVP | none (private network) |
| 19 | MillionVerifier | `EmailVerifier` | MVP | platform, or per tenant (bring your own key) |
| 20 | Google Places API (New) | `PlacesLookup` | MVP | platform |
| 21 | LLM providers through the AI SDK | `packages/llm` (not a port) | MVP | platform |
| 22 | Sentry and OpenTelemetry | observability (not a port) | MVP | platform |
| 23 | Web Push (VAPID) | `WebPushSender` | MVP | platform |
| 24 | Slack, HubSpot, Salesforce, Gmail and Outlook reading | later | v1.5, v2 | per tenant |

## 2. Ports and adapters

### 2.1 Layout

```
packages/shared/src/integrations/<area>.ts    data types that cross the boundary (zod schemas, named exports)
packages/core/src/ports/<area>.ts             port types (what core needs), built from the shared data types
packages/integrations/src/<provider>/         adapter.ts, mapping.ts, fake.ts, index.ts
packages/integrations/src/http.ts             shared HTTP client: timeouts, retries, errors, logging
packages/integrations/test/msw/<provider>.ts  MSW handlers
packages/integrations/test/fixtures/<provider>/*.json   recorded, scrubbed responses
apps/api/src/wiring.ts, apps/worker/src/wiring.ts       build adapters from env, pass them to core
```

Rules (ARCHITECTURE §4):
- `packages/core` defines ports as TypeScript types and depends only on them. `packages/integrations` never imports from `packages/core`: an adapter returns an object built from `packages/shared` types, and TypeScript's structural typing checks it against the port at the wiring site (`const opportunitySource: OpportunitySource = createKontractOpportunitySource(config)`).
- Adapters never read the database or `secrets`. Core decrypts per-tenant credentials and passes them in as arguments.
- Adapters never decide policy (approval, budgets, which provider to use). Fallback between adapters is a core wrapper (`withFallback(primary, fallback, breaker)` in `packages/core/src/ports/fallback.ts`).
- Port conformance tests live in `apps/worker/test/ports/` (the one place that imports both core types and adapters) and run every adapter and its fake against the same cases.

### 2.2 Ports

Port types, in `packages/core/src/ports/`. Every method takes a `CallContext` last. `tenantId` is null for platform work (health checks, global sweeps); `feature` becomes `usage_events.feature` (`scan`, `bid_reader`, `profile_lookup`); `meter` is how an adapter reports a billable call, and core turns it into a `usage_events` row.

```ts
export type CallContext = {
  tenantId: string | null;
  requestId: string;
  runId?: string;
  feature: string;
  signal?: AbortSignal;
  meter: (usage: ProviderUsage) => void;
};

export type UsageKey = 'ai_runs' | 'ai_cost' | 'doc_pages' | 'sms_segments' | 'emails_sent' | 'kontract_calls' | 'enrichment_lookups' | 'storage_bytes';

export type ProviderUsage = {
  provider: string; endpoint: string; key: UsageKey;
  quantity: number; costMicros: number; meta?: Record<string, unknown>;
};

export type OpportunitySource = {
  search(query: OpportunityQuery, ctx: CallContext): Promise<OpportunityPage>;
  get(ref: NoticeRef, ctx: CallContext): Promise<NoticeDetail | null>;
  listDocuments(ref: NoticeRef, fallback: NoticeDetail | null, ctx: CallContext): Promise<NoticeDocument[]>;
  getDetails(ref: NoticeRef, fallback: NoticeDetail | null, ctx: CallContext): Promise<NoticeFacts>;
  findComparables(query: AwardQuery, ctx: CallContext): Promise<AwardResults>;
  findSubcontractors(query: string, location: string, ctx: CallContext): Promise<SubSearchResult>;
  health(ctx: CallContext): Promise<SourceHealth>;
};
export type AwardNoticeFeed = { listAwardNotices(postedOn: string, ctx: CallContext): AsyncIterable<AwardNotice> };
export type BidTextSource = {
  readText(ref: NoticeRef, page: { offset: number; limit: number }, fallback: NoticeDetail | null, ctx: CallContext): Promise<BidTextPage>;
  checkQuotes(ref: NoticeRef, quotes: QuoteToCheck[], fallback: NoticeDetail | null, ctx: CallContext): Promise<QuoteCheck[]>;
};
export type MarketCatalog = { sources(ctx: CallContext): Promise<SourceCatalog> };
export type EntityRegistry = {
  getByUei(uei: string, ctx: CallContext): Promise<EntityRecord | null>;
  searchByName(name: string, state: string | null, ctx: CallContext): Promise<EntityRecord[]>;
};
export type WageDeterminationSource = {
  search(query: WdQuery, ctx: CallContext): Promise<WdSummary[]>;
  history(wdNumber: string, ctx: CallContext): Promise<WdRevision[]>;
  get(wdNumber: string, revision: number, ctx: CallContext): Promise<WdDocument>;
};
export type WebsiteReader = { read(url: string, ctx: CallContext): Promise<SiteFacts> };
export type EmailSender = { send(message: OutboundEmail, credentials: EmailCredentials, ctx: CallContext): Promise<EmailSendResult> };
export type SmsSender = { send(message: OutboundSms, ctx: CallContext): Promise<SmsSendResult> };
export type PhoneVerifier = {
  start(phoneE164: string, ctx: CallContext): Promise<{ status: 'pending' }>;
  check(phoneE164: string, code: string, ctx: CallContext): Promise<{ status: 'approved' | 'pending' | 'canceled' | 'max_attempts_reached' | 'expired' }>;
};
export type TelegramClient = {
  sendMessage(input: TelegramOutbound, ctx: CallContext): Promise<{ messageId: number }>;
  answerCallback(callbackQueryId: string, text: string, ctx: CallContext): Promise<void>;
  editMessage(chatId: string, messageId: number, text: string | null, removeButtons: boolean, ctx: CallContext): Promise<void>;
  leaveChat(chatId: string, ctx: CallContext): Promise<void>;
  setWebhook(ctx: CallContext): Promise<void>;
  getMe(ctx: CallContext): Promise<{ username: string }>;
};
export type BillingProvider = {
  createCustomer(input: { tenantId: string; name: string; email: string }, ctx: CallContext): Promise<{ customerId: string }>;
  createCheckoutSession(input: CheckoutInput, ctx: CallContext): Promise<{ url: string }>;
  createRunPackCheckout(input: RunPackCheckoutInput, ctx: CallContext): Promise<{ url: string }>;
  createPortalSession(input: { customerId: string; returnUrl: string }, ctx: CallContext): Promise<{ url: string }>;
  cancelAtPeriodEnd(input: { subscriptionId: string; comment?: string; feedback?: string }, ctx: CallContext): Promise<BillingSubscription>;
  resume(subscriptionId: string, ctx: CallContext): Promise<BillingSubscription>;
  getSubscription(subscriptionId: string, ctx: CallContext): Promise<BillingSubscription>;
  grantCredit(input: { customerId: string; amountCents: number; reason: string }, ctx: CallContext): Promise<void>;
  reportUsage(events: MeterEvent[], ctx: CallContext): Promise<void>;
  verifyWebhook(rawBody: string, signatureHeader: string): BillingWebhookEvent;
};
export type ObjectStorage = {
  presignPut(key: string, contentType: string, sizeBytes: number, expiresSeconds: number): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(key: string, filename: string, disposition: 'inline' | 'attachment', expiresSeconds: number): Promise<string>;
  head(key: string): Promise<{ sizeBytes: number; contentType: string } | null>;
  getStream(key: string): Promise<ReadableStream<Uint8Array>>;
  put(key: string, body: Uint8Array | ReadableStream<Uint8Array>, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<{ deleted: number }>;
};
export type MalwareScanner = { scan(stream: ReadableStream<Uint8Array>, ctx: CallContext): Promise<ScanResult> };
export type TextExtractor = { extract(input: ExtractInput, ctx: CallContext): Promise<ExtractedDocument> };
export type DocumentRenderer = { docxToPdf(docx: Uint8Array, ctx: CallContext): Promise<Uint8Array> };
export type EmailVerifier = { verify(address: string, credentials: VerifierCredentials, ctx: CallContext): Promise<EmailVerification> };
export type PlacesLookup = { details(placeId: string, fields: PlaceField[], ctx: CallContext): Promise<PlaceDisplay | null> };
export type WebPushSender = { send(subscription: PushSubscription, payload: PushPayload, ctx: CallContext): Promise<'sent' | 'gone'> };
```

### 2.3 Shared adapter rules

| Concern | Rule |
|---|---|
| HTTP client | `packages/integrations/src/http.ts` wraps `fetch` (Node 22 undici) with `AbortSignal.timeout`, JSON parsing, error mapping and logging. SDKs (Stripe, Twilio, AWS S3, AI SDK) are used where named; they get the same timeout and logging wrappers. |
| Errors | Adapters throw only `IntegrationError { provider, kind, retryable, status?, providerCode?, retryAfterMs? }` with `kind` one of `unavailable`, `timeout`, `rate_limited`, `quota_exceeded`, `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `rejected`. Core maps them to API problems: `unavailable`, `timeout`, `rate_limited`, `quota_exceeded` give `external_unavailable` with `retryAfterSeconds`; `unauthorized` with a platform key gives `external_unavailable` plus an ops alert, with a tenant's own key gives `validation_failed` on the key; `not_found` gives `not_found`; `rejected` (for example a suppressed recipient) gives `conflict`. |
| Retries in a request | Only idempotent calls (GET and read-only POSTs) retry inside an HTTP request: up to 3 attempts, full-jitter exponential backoff from 500 ms, capped at 8 s, `Retry-After` honoured up to 10 s; past that, fail with `retryAfterMs`. |
| Retries in workflows | Calls inside DBOS steps use step retries: `maxAttempts` 5, `intervalSeconds` 2, `backoffRate` 3 (2 s, 6 s, 18 s, 54 s), `Retry-After` honoured up to 300 s. Calls with side effects (send email, send SMS, Stripe writes) run only inside DBOS steps, never inside an HTTP request. |
| Circuit breaker | Per provider and process: open after 5 retryable failures within 60 s, half-open after 30 s with one trial call. Used by `withFallback` and by health on the Bids screen. |
| Logging | pino child logger with `provider`, `endpoint` (path template, never the query string), `status`, `latencyMs`, `attempt`, `tenant_id`, `run_id`. Never log bodies, headers, tokens or keys. Query parameters named `api_key`, `api`, `key`, `token`, `code`, `state`, `secret` are stripped from every logged or traced URL. |
| Tracing | Each call is an OpenTelemetry client span (§22) with `magpie.provider`, `magpie.endpoint`, `magpie.cost_micros`. |
| Metering | Each billable call calls `ctx.meter()` once. Core writes the `usage_events` row (and the `usage_counters` increment) in the caller's transaction or the next step. Free calls are not metered but are counted in logs. |
| Time | Adapters convert provider times to UTC ISO strings and money to integer cents (`Math.round(dollars * 100)`) at the edge. |

### 2.4 Test fakes

- **MSW for adapters.** Each adapter's unit tests run against `msw/node` handlers in `packages/integrations/test/msw/<provider>.ts` that serve JSON from `test/fixtures/<provider>/`. `onUnhandledRequest: 'error'`, so an unexpected call fails the test. Handlers cover success, every documented error status, timeouts (`delay('infinite')` with a short client timeout), malformed bodies and rate limits with `Retry-After`.
- **Recorded fixtures.** `pnpm --filter @magpie/integrations fixtures:record <provider>` calls the real test or sandbox API with keys from the developer's env, scrubs secrets and personal data (emails become `@example.com`, phones `+1555...`, names `Test Person`), and writes fixtures. CI never calls real providers.
- **In-memory fakes for core.** `packages/integrations/src/<provider>/fake.ts` exports `createFake<Port>()`: same shape as the port, in-memory state, and helpers such as `fake.sent`, `fake.failNext(kind)`, `fake.setLatency(ms)`. Core, api and worker tests use fakes, never MSW.
- **Live contract tests** (`pnpm test:live`, nightly against staging keys, not in the PR gate) call each real provider once with a harmless request and compare the response shape with the zod schema in `packages/shared`. A failure opens an ops alert, not a broken build.

### 2.5 Configuration and secrets

- Platform credentials come from environment variables validated at boot by `packages/shared/src/env.ts` (ARCHITECTURE §10). §25 lists the variables this file adds; SECURITY.md §5 holds the full list and must include them.
- Per-tenant credentials (OAuth refresh tokens, bring-your-own keys) live in `secrets` with envelope encryption and are reached through `connections.secret_id`. Every decryption writes `audit_log` action `secret.read`.
- An integration whose required variables are absent is "not configured": the wiring passes a disabled adapter that throws `IntegrationError { kind: 'unavailable' }`, and the related UI shows "not available" (`available` flags in API §5.21). Production boot fails if an MVP integration is not configured.

### 2.6 "Verify before coding"

Every section ends with a checklist. Before writing an adapter, the build agent works through its list against the live docs (and a sandbox call where one exists), updates fixtures, and writes `docs/decisions/NNNN-<provider>-verified.md` with the date, doc URLs, SDK version pinned and each answer. A "verify" item that turns out different from this file is fixed here in the same pull request.

## 3. Kontract engine `/api/v1`

**Source:** [KONTRACT.md](../KONTRACT.md) (the contract) and the current product's client `openduet/openbot/server/src/crm/govcon/kontract.ts` and `kontract-api.ts` (types copied from Kontract's `src/lib/api-v1.ts`).

**Purpose.** Primary source of public market data: federal (SAM.gov) and state and local notices, notice detail and documents, bid document text read once and shared, citation checks, past-award pricing, subcontractor search and business website facts. Kontract does no AI work for Magpie: Magpie's Bots read the text with Magpie's own models (KONTRACT.md Part 1b).

**Credentials.** Platform: `KONTRACT_URL`, `KONTRACT_SERVICE_KEY`. Every call except health sends `Authorization: Bearer <KONTRACT_SERVICE_KEY>` and `X-Workspace-Id`. Magpie sends `magpie-<tenant_id>` (UUID with dashes, 43 characters, inside Kontract's `[a-z0-9-]{1,64}` rule) for tenant work and `magpie-platform` for platform work (health, sources, global sweeps). The tenant id, not the slug, keeps metering stable when a workspace is renamed; this replaces KONTRACT.md's `magpie-<slug>`, which predates pooled tenancy.

**Calls.**

| Port method | Kontract call | Input | Output used | Timeout | Cost |
|---|---|---|---|---|---|
| `OpportunitySource.health` | `GET /api/v1/health` (no key) | | `{ ok, samAsOf, notices, sledBids, permitFeeds: { ok, failing } }` | 5 s | 0 |
| `MarketCatalog.sources` | `GET /api/v1/sources` | | `bidFeeds` (state and local feeds with health, states, cadence, gaps) for the Bids screen's coverage list; cached 1 hour | 15 s | 0 |
| `OpportunitySource.search` | `GET /api/v1/opportunities` | query below, `limit` at most 100 | `OpportunityResults` without descriptions: `results`, `total`, `offset`, `source`, `dataAsOf`, `notice`, `sledTotal` | 10 s | 0 |
| `OpportunitySource.get` | `GET /api/v1/opportunities/:id` | | `{ opportunity }` with `description`; 404 when not in the index | 15 s | 0 |
| `OpportunitySource.getDetails`, `.listDocuments` | `POST /api/v1/opportunities/:id/details` | `{ opportunity? }`; never `claude: true` | `BidDetails`: `documents` (id, name, url, read status, pages), `fingerprint`, `wageDeterminations`, `budget`, `bonds`, `siteVisit`, `questionsDue`, `period`, `evaluation`, `sizes`, `requirements` (each `Cited`), `forms`, `priceForm` | 60 s | 0 when `claude` is false (verify) |
| `BidTextSource.readText` | `POST /api/v1/opportunities/:id/text` | `{ offset, limit: 80000, opportunity? }` | `{ noticeId, fingerprint, totalChars, offset, nextOffset, documents: [{ id, name, read, pages, chars, startsAt }], text }` with `<document name>` wrappers and `[page N]` markers | 60 s | 0 |
| `BidTextSource.checkQuotes` | `POST /api/v1/opportunities/:id/quotes` | `{ quotes: [{ quote, doc? }] (max 100, each max 1,000 chars), opportunity? }` | `{ results: [{ quote, found, doc, page }] }` | 30 s | 0 |
| `OpportunitySource.findComparables` | `POST /api/v1/pricing` | `{ query: { keywords, naics?, state?, agency?, yearsBack?, servicesOnly? }, context?: { agency?, state? } }` | `awards` (PastAward: `awardId`, `recipient`, `amount` and `annualAmount` in dollars, `agency`, dates, `naics`, `psc`, `state`, `url`, `likelyRelated`), `stats`, `recipients` | 30 s | 0 |
| `OpportunitySource.findSubcontractors` | `POST /api/v1/subcontractors` | `{ query, location }` | `SubSearchResult { results: FoundSub[], source: 'google' \| 'apify' \| 'sample' \| 'web', notice? }` | 60 s | `X-Kontract-Cost-Micro` |
| `WebsiteReader.read` | `POST /api/v1/websites/read` | `{ url }` | `{ facts: SiteFacts }`: `emails`, `phones`, `licenses`, `services`, `serviceArea`, `insured`, `experience`, `pages` | 60 s | `X-Kontract-Cost-Micro` |
| ops reconciliation | `GET /api/v1/usage?workspace=&month=YYYY-MM` | | `{ calls, costMicro, byEndpoint }`, compared monthly with `usage_events` | 15 s | 0 |

Not used by Magpie: `POST /opportunities/:id/breakdown` and `POST /drafts` (Magpie's Bots do this work with Magpie's models), `GET /permits` and `GET /permits/contractors` (v2, Segment C prospecting; the port `PermitSource` is added then).

**Search mapping.** From `opportunity_searches.filters` (and API `MarketSearchRequest`) to Kontract's query parameters, as the current client uses them (`q`, `state`, `naics`, `setAside`, `level`, `postedWithinDays`, `minDaysToRespond`, `servicesOnly`, `biddableOnly`, `sort`, `limit`, `offset`):

| Magpie filter | Kontract parameter | Applied where |
|---|---|---|
| `keywords` | `q` (joined with spaces) | Kontract |
| `excludeKeywords` | none | adapter post-filter on title and summary, whole words, case-insensitive |
| `naics` | `naics`, one code per call | Kontract; several codes fan out one call per code (at most 10 calls with states), merged and deduplicated by id |
| `psc` | none | post-filter on `pscCode` |
| `setAsides` | `setAside` when exactly one, else none | Kontract, or post-filter on the normalized value |
| `states` | `state`, one per call | Kontract, fanned out with NAICS |
| `agencies` | none | post-filter, case-insensitive substring of `agency` or `office` |
| `valueMinCents`, `valueMaxCents` | none | Kontract's `Opportunity` has no value; filter only notices whose cached details give a `budget`; unknown values pass |
| `dueWithinDays` | `biddableOnly=1` | post-filter on `responseDeadline` |
| `noticeTypes` | none | post-filter on the normalized notice type |
| `sources` | `level=federal` for `['sam']`, `level=sled` for `['sled']`, omitted for both | Kontract |
| sort `fit`, `due`, `posted` | `sort=fit`, `deadline`, `newest` | Kontract; Magpie's own score (FR-DIS-3) re-sorts `fit` results |
| `limit`, `cursor` | `limit`, `offset` | the cursor stores one offset per fanned-out call; post-filtering may fetch up to 3 pages per call to fill `limit` |

`servicesOnly` is not sent by default (its effect on construction notices is not documented, verify).

**Mapping to `market_opportunities`.** `source` = `sled` when `Opportunity.source` is `sled` or `level` is `state` or `local`, else `sam`. `source_id` = `Opportunity.id` (for SAM notices this is the SAM.gov `noticeId`, so the SAM adapter maps to the same row). `title`, `agency`, `office`, `solicitation_number`, `naics_codes` (`[naicsCode]`), `psc_code`, `place_of_performance`, `posted_at`, `response_due_at` (`responseDeadline`), `url` (`samUrl` or `portal`), `summary` (first 1,000 characters of `description`), `raw` (the `Opportunity` as received). `notice_type` and `set_aside` use the vocabularies in §26. `estimated_value_*_cents` from `BidDetails.budget` when read.

**How the bid workflow uses it.**
1. Pursue (API §5.7) runs `ensureOpportunity`, then the `match.pursued` event starts `bidDocumentsWorkflow` on queue `docs` (AGENT_RUNTIME §2.10): `getDetails` gives the documents list and `fingerprint`; each document becomes a `bid_documents` row (`kind` from its name: `solicitation`, `sow`, `pricing_schedule`, `wage_determination`, `qna`, `amendment`, else `attachment`; `market_document_ref` = Kontract document id; `source_url` = its URL).
2. If `market_opportunity_texts` has no rows for this notice and fingerprint, page through `readText` (80,000 characters a call until `nextOffset` is null), split on `[page N]` markers, and insert chunks (shared by every tenant, written through the `magpie_ops` pool in `worker`). Documents with `read` = `scanned` or `failed` go to §17's OCR path; wage determinations, which Kontract leaves out of the text, go to §7.
3. When text is ready the workflow emits `bid.documents_ready`, which starts Bid Reader. Bid Reader cites quotes; before a requirement row or brief fact is saved, `checkQuotes` confirms each quote exists and gives the page. Not found: the row is not saved, and the Bot says it couldn't confirm it (PRD principle 2).
4. Amendment check (daily per pursued bid, and on `POST /deals/:id/documents/sync`): `getDetails`; a different `fingerprint` from `market_opportunities.documents_fingerprint` (§26) means new or changed documents, which become `bid_documents` rows of kind `amendment`; once their text is ready the workflow emits `bid.amendment_ready` (FR-DIS-7).
5. `getDetails` and `readText` pass the cached `raw` opportunity in the body when Kontract returns 404 for a closed or awarded notice (KONTRACT.md rule for `/details`).

**Limits and quotas.** Confirmed in KONTRACT.md: 60 requests a minute per `X-Workspace-Id`, 10 a minute on the Claude routes (Magpie calls none), `429` with `Retry-After` above that; detail responses under 200 KB; text `limit` at most 80,000 characters. The adapter keeps a per-process token bucket of 50 a minute per workspace id; scans of many saved searches for one tenant queue behind it (queue `sync`, per tenant 1).

**Retries.** All Kontract calls are reads (the POSTs have no side effects), so the in-request and in-workflow retry rules of §2.3 apply as written. `401` is not retried.

**Idempotency.** Not needed (reads). Workflows that write the results use deterministic ids (`scan:<tenant>:<search>:<hour>`, `bidtext:<opportunity id>:<fingerprint>`).

**Metering.** `X-Kontract-Cost-Micro` (integer micro-dollars; `0` on free calls) becomes `ctx.meter({ key: 'kontract_calls', quantity: 1, costMicros })`. Paid calls (`subcontractors`, `websites/read`) check the tenant's entitlement (BILLING.md) before calling.

**Failures and what the person sees.**

| Failure | Behaviour | The person sees |
|---|---|---|
| Timeout, 5xx, breaker open on search or notice | `withFallback` switches federal search and notice detail to the SAM.gov adapter (§4); state and local results are omitted | Bids screen banner: "State and local bids are temporarily unavailable. Federal results come straight from SAM.gov." |
| `health.samAsOf` older than 36 hours | Search still works | "Federal bids were last updated <date>." |
| `401` | No retry; ops alert (service key wrong or rotated) | "Bid search is down. We're working on it." |
| `429` | Retry after `Retry-After` in workflows; in a request, fail with `external_unavailable` | "Bid search is busy. Try again in a minute." |
| `404` on detail of a closed notice | Retry with the cached `opportunity` body | nothing |
| `readText` document `scanned` | OCR path (§17) | document shows "Reading scanned pages" |
| `subcontractors` returns `source: 'sample'` | Treated as no results plus `notice` | "Couldn't search businesses near the job right now." |

**Places data from Kontract.** `FoundSub` rows with `source: 'google'` contain Google Places content (name, address, phone, rating). Google's terms allow storing only `place_id` (§20). Magpie shows these fields in suggestions but stores only what the person confirms (provenance `user`) or what the business's own website says (`WebsiteReader`, provenance `website`), plus `place_id` when Kontract provides it.

**Test fakes.** MSW handlers for every call above with fixtures recorded against the live engine using workspace `magpie-test`; a fixture set of 50 notices that includes an AI-ban clause, an AI-disclosure clause, a scanned document, a wage determination attachment and an amendment; `createFakeOpportunitySource()` with those notices in memory.

**Verify before coding.**
- [ ] `src/lib/api-v1.ts` in Kontract now lists `/text`, `/quotes` and the `web` source (KONTRACT.md Part 1b); copy it to `packages/shared/src/integrations/kontract-api.ts` unchanged.
- [ ] Whether `naics`, `state` and `setAside` accept several comma-separated values; if yes, drop the fan-out.
- [ ] The `setAside` vocabulary Kontract expects (SAM codes such as `SBA`, or its own words).
- [ ] What `servicesOnly` and `biddableOnly` exclude.
- [ ] `/details` with `claude` absent costs 0 and returns `fingerprint` and `documents` with URLs.
- [ ] Ask Kontract for an additive `placeId` on `FoundSub` (only `mapsUrl` exists today).
- [ ] Health response shape and that `/health` needs no key.
- [ ] Rate limits and `Retry-After` on 429, and the `X-Kontract-Cost-Micro` header on every v1 response.

## 4. SAM.gov Get Opportunities API

**Source:** [open.gsa.gov/api/get-opportunities-public-api](https://open.gsa.gov/api/get-opportunities-public-api/).

**Purpose.** (a) Fallback `OpportunitySource` for federal notices when Kontract is down (PRD §12 risk). (b) `AwardNoticeFeed`: a daily sweep of award notices for the award watch (FR-DIS-7), because Kontract's `Opportunity` carries no award data.

**Credentials.** Platform `SAM_GOV_API_KEY`, passed as the `api_key` query parameter (the only method the page documents). Request a non-federal **system account** key for production; a personal key without a SAM.gov role gets 10 requests a day.

**Calls.** Confirmed on the GSA page:

| Use | Call | Parameters used |
|---|---|---|
| Search (fallback) | `GET https://api.sam.gov/opportunities/v2/search` | `api_key`, `postedFrom` and `postedTo` (required, `MM/dd/yyyy`, range at most 1 year; Magpie uses the last 90 days), `limit` (max 1,000; Magpie uses 100), `offset`, `ptype` (`o` solicitation, `k` combined synopsis/solicitation, `p` presolicitation, `r` sources sought, `s` special notice, `a` award notice, `u` justification, `i` intent to bundle), `ncode` (NAICS), `ccode` (PSC), `typeOfSetAside` (one of `SBA`, `SBP`, `8A`, `8AN`, `HZC`, `HZS`, `SDVOSBC`, `SDVOSBS`, `WOSB`, `WOSBSS`, `EDWOSB`, `EDWOSBSS`, `LAS`, `IEE`, `ISBEE`, `BICiv`, `VSA`, `VSS`), `state`, `zip`, `title`, `organizationName`, `rdlfrom` and `rdlto` (response deadline range) |
| Notice by id | same endpoint with `noticeid=<id>` | |
| Description | `GET https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=<id>&api_key=...` (the `description` field of a search result is this link) | |
| Attachments | `resourceLinks[]` on the notice: direct download URLs | |
| Award sweep | search with `ptype=a`, `postedFrom` = `postedTo` = yesterday, `limit=1000`, paging until all `totalRecords` are read | |

Response fields used: `totalRecords`, `opportunitiesData[]` with `noticeId`, `title`, `solicitationNumber`, `fullParentPathName`, `postedDate`, `type`, `baseType`, `setAsideCode`, `responseDeadLine`, `naicsCode`, `classificationCode`, `active`, `placeOfPerformance`, `pointOfContact`, `description`, `uiLink`, `resourceLinks`, and for awards `award { number, amount, date, awardee { name, ueiSAM, location } }`.

**Award sweep.** Worker schedule `award-sweep` (daily, 06:00 UTC, `system` queue, workflow id `awardsweep:<yyyy-mm-dd>`): pages through yesterday's award notices (typically a few calls) and upserts each into `market_opportunities` (`source = 'sam'`, `notice_type = 'award'`, award data in `raw`) through the `magpie_ops` pool. Each tenant's `award_watch` Bot job then reads `market_opportunities` for award notices whose `solicitation_number` matches its submitted bids, and moves the bid to Won or Lost when the awardee's UEI or name matches the tenant's profile, or asks the owner otherwise (FR-DIS-7). One sweep serves every tenant, so per-tenant calls never grow with tenant count.

**Limits.** The Opportunities page says requests per day depend on the account role but gives no numbers. The Entity API page (same api.sam.gov key system) lists: non-federal personal key without role 10 a day; with a role 1,000 a day; non-federal system account 1,000 a day; federal system account 10,000 a day. Treat 1,000 a day as the budget (verify that it is shared across APIs). The adapter keeps a per-process daily counter, stops fallback search at 800, keeps 200 for the award sweep and entity lookups, and on `429` marks the fallback unavailable until 00:00 UTC.

**Retries.** §2.3 read rules. Fallback search in a request makes one attempt only (the user is already waiting for a failed primary).

**Idempotency.** Reads only.

**Failures and what the person sees.** Both sources down: `external_unavailable`, "Bid search is down right now. Your saved searches will catch up when it's back." Daily quota used: same message; saved-search scans retry after midnight UTC.

**Test fakes.** MSW with recorded search pages (solicitation, combined, award notice with awardee), the description endpoint, an empty result and a 429.

**Verify before coding.**
- [ ] Daily limits for Magpie's key type, and whether Opportunities, Entity and other APIs share one quota.
- [ ] `offset` semantics (record offset or page index; the page's wording is ambiguous).
- [ ] Whether `resourceLinks` downloads need `api_key` appended, and their size limits.
- [ ] Whether the key can go in a header instead of the query string (keeps it out of proxy logs).
- [ ] `status` parameter availability (listed as "Coming Soon").

## 5. SAM.gov Entity Management API

**Source:** [open.gsa.gov/api/entity-api](https://open.gsa.gov/api/entity-api/).

**Purpose.** `EntityRegistry`: profile lookup by UEI or name with prefill (FR-PRO-2), the SAM expiry warning (FR-PRO-6), and SAM entities as subcontractor suggestions (FR-SUB-1). Kontract has no entity endpoint, so this adapter is the primary one.

**Credentials.** Same `SAM_GOV_API_KEY`. Public data only: point-of-contact emails and phones are FOUO and need a federal system account, so Magpie never gets them.

**Calls.** Confirmed: production `GET https://api.sam.gov/entity-information/v4/entities` with `api_key`.

| Use | Parameters |
|---|---|
| By UEI | `ueiSAM=<12 chars>`, `includeSections=entityRegistration,coreData,assertions` |
| By name | `legalBusinessName=<text>` (partial match), `registrationStatus=A`, optional `physicalAddressProvinceOrStateCode=<state>` (verify name), `includeSections` as above |
| Paging | `page`, `size` (JSON responses return at most 10 per page) |

**Mapping to `company_profiles` and `EntityCandidate`.**

| SAM field | Magpie field |
|---|---|
| `entityRegistration.legalBusinessName`, `dbaName` | `legal_name`, `dba` |
| `entityRegistration.ueiSAM`, `cageCode` | `uei`, `cage` |
| `entityRegistration.registrationStatus` (`Active`), `registrationExpirationDate` | `sam_status` (`active`, or `expired` when the date has passed), `sam_expires_on` |
| `coreData.physicalAddress` (`addressLine1`, `city`, `stateOrProvinceCode`, `zipCode`) | `base_address` (geocoded later for `lat`, `lng`) |
| `assertions.goodsAndServices.primaryNaics`, `naicsList[].naicsCode` | `naics_codes`, primary first |
| `assertions.goodsAndServices.pscList[].pscCode` | `psc_codes` |
| `coreData.businessTypes.sbaBusinessTypeList[]`, `businessTypeList[]` | `certifications` by the code table in the verify list |

Every prefilled field writes `field_provenance` with `source = 'sam'`, `source_ref = 'uei:<UEI>'`.

**SAM status refresh.** A platform schedule `sam-status-refresh` (daily, `sync` queue): re-checks tenants whose UEI is set, weekly when `sam_expires_on` is within 75 days or past, monthly otherwise, spread over the days. At 5,000 tenants that is about 250 calls a day, inside the quota shared with §4.

**Limits.** As §4: 1,000 a day for a non-federal system account. Lookup results are cached in process for 24 hours by UEI.

**Failures and what the person sees.** Not found: "We couldn't find that UEI in SAM.gov. Check it, or fill the details in yourself." Down or over quota: "SAM.gov isn't answering. You can fill this in yourself and we'll check it later." Onboarding never blocks on it (FR-PRO-1 steps are skippable).

**Test fakes.** MSW fixtures: an active small business with 8(a) and HUBZone, an expired registration, a name search with 3 hits, a 404.

**Verify before coding.**
- [ ] The state filter parameter name for name searches.
- [ ] The SBA and business type codes that map to `8a`, `hubzone`, `wosb`, `edwosb`, `sdvosb`, `vosb`, `sdb` (for example 8(a) participant, HUBZone firm, WOSB, EDWOSB, SBA VetCert SDVOSB and VOSB); build the table from the API's own code descriptions, not from memory.
- [ ] Whether `registrationStatus` values other than `A` and `E` occur, and how a lapsed registration appears.
- [ ] Whether the nightly public Entity extract (Extracts API) is a better source than per-tenant calls once tenants exceed a few thousand.

## 6. USAspending.gov API

**Source:** [api.usaspending.gov/docs/endpoints](https://api.usaspending.gov/docs/endpoints).

**Purpose.** Fallback for `OpportunitySource.findComparables` (FR-PRC-2) when Kontract's `/pricing` fails, and award detail links.

**Credentials.** None: "Endpoints do not currently require any authorization" (confirmed).

**Calls.**

| Use | Call |
|---|---|
| Award search | `POST https://api.usaspending.gov/api/v2/search/spending_by_award/` |
| Award detail | `GET https://api.usaspending.gov/api/v2/awards/<generated_internal_id>/` |
| NAICS autocomplete (not needed; §8 is local) | `POST /api/v2/autocomplete/naics/` |

Award search body (verify every key against the endpoint's contract before coding):

```json
{
  "filters": {
    "award_type_codes": ["A", "B", "C", "D"],
    "naics_codes": ["561720"],
    "place_of_performance_locations": [{ "country": "USA", "state": "VA" }],
    "agencies": [{ "type": "awarding", "tier": "toptier", "name": "Department of Veterans Affairs" }],
    "keywords": ["janitorial"],
    "time_period": [{ "start_date": "2021-10-01", "end_date": "2026-09-30" }]
  },
  "fields": ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Start Date", "End Date", "Description", "generated_internal_id"],
  "sort": "Award Amount",
  "order": "desc",
  "limit": 100,
  "page": 1
}
```

**Mapping.** Each result becomes an `award_comparables.award` `{ piid, recipient, agency, amountCents, awardedOn, naics, description, url }` with `url = https://www.usaspending.gov/award/<generated_internal_id>`. Range stats (low, median, high, annualized when the period is about a year or more) are computed in core, the same way Kontract's `PricingStats` does.

**Limits.** No documented rate limit. The adapter keeps at most 2 concurrent requests per process and 5 a second, and caches identical queries for 24 hours.

**Retries.** §2.3 read rules (the POST is a read).

**Failures.** "Past award data isn't available right now. The Estimator will price without comparables and say so." (FR-PRC-2 needs 3 or more comparables only when market data has them.)

**Test fakes.** MSW fixtures of a 5-result search and an empty search.

**Verify before coding.**
- [ ] Filter keys and value formats (`naics_codes` as a list or as `{ require: [] }`; agency names).
- [ ] Field labels in `fields` and the key that carries `generated_internal_id`.
- [ ] Current `limit` maximum and any published rate limit.

## 7. Wage determinations (SCA and Davis-Bacon)

**Sources:** [sam.gov/content/wage-determinations](https://sam.gov/content/wage-determinations), [DOL construction tools page](https://www.dol.gov/agencies/whd/government-contracts/construction/tools) (WDOL moved to SAM.gov on 2019-06-14), [SAM.gov formatting update announcement](https://sam.gov/announcements/wage-determination-formatting-update) (last updated 2026-06-22), and a live check of SAM.gov's own web endpoints on 2026-11-10.

**Purpose.** `WageDeterminationSource` for FR-PRC-1: find the Service Contract Act (SCA) or Davis-Bacon (DBA) wage determination (WD) that applies, read its rates for the labor categories, and cite WD number, revision and line.

**What is confirmed and what is not.**

| Fact | Status |
|---|---|
| SAM.gov is the official source of federal wage determinations; DOL publishes them there; WDOL.gov is retired | Confirmed (DOL, Acquisition.gov, SAM.gov) |
| The GSA public API catalog lists Opportunities, Entity and Exclusions APIs; there is no documented public wage determination API | Confirmed by absence on [open.gsa.gov](https://open.gsa.gov/api/) and SAM.gov help; verify again at build time |
| SAM.gov's web front end reads WDs from JSON endpoints that answer without a key: search `GET https://sam.gov/api/prod/sgs/v1/search?index=sca\|dbra&q=<WD number>&is_active=true&page=0&size=10&mode=search&sort=-modifiedDate`, revision history `GET https://sam.gov/api/prod/wdol/v1/wd/<WD number>/history`, document `GET https://sam.gov/api/prod/wdol/v1/wd/<WD number>/<revision>` (all with `Accept: application/hal+json`) | Observed working on 2026-11-10 (for example `2015-4281` revision 39, published 2026-08-22, `document` about 45 KB of plain text). Undocumented: no stability promise, no published rate limit, no terms for automated use. |
| The document is the WD as printed: header with WD number, revision and date, area, then rate lines (SCA: `01261 - Personnel Assistant (Employment) I   22.79`) and fringe text (health and welfare, vacation, holidays) | Observed for SCA; DBA format not checked; SAM.gov says formatting changed in 2026 |
| Human page for citations: `https://sam.gov/wage-determination/<WD number>/<revision>` | Observed |
| The WD that legally applies to a bid is the one the contracting officer attaches or cites in the solicitation, with its revision | Confirmed practice (FAR 22.1008 for SCA, 22.404 for DBA); the adapter never guesses a WD from location alone |

**Design.**
1. **First choice: the solicitation's own copy.** Bid Reader looks for a `bid_documents` row of kind `wage_determination` (Kontract lists it in `details.documents`, and `details.wageDeterminations` gives the referenced numbers). Its text (from the attachment, OCR if scanned) is what rates are cited against.
2. **Second choice: fetch by number.** When the solicitation cites a WD number and revision but has no attachment, `WageDeterminationSource.get(number, revision)` fetches the document text, `POST /api/app/deals/:id/wage-determinations` stores it as a file and a `bid_documents` row, and the rates cite that row.
3. **Newer revision check.** `history(number)` shows whether a newer revision exists; the Estimator flags it ("Revision 40 was published after the solicitation's revision 39. The contracting officer decides which applies; ask if it isn't amended.") and never switches revisions on its own.
4. **Nothing found.** The Estimator says so and asks (FR-PRC-1).

**Parsing (in `packages/core/pricing/wage-determination.ts`, not in the adapter).** SCA rate lines match `^(\d{5}) - (.+?)\s{2,}(\d+\.\d{2})(\*{0,3})$`; the health and welfare amount comes from the line beginning `HEALTH & WELFARE:` (dollars per hour). DBA documents are parsed by classification blocks with "Rates" and "Fringes" columns. Every parsed rate keeps its line number so the citation `{ documentId, page: null, quote }` quotes the exact line. A document that yields no rates is stored anyway and the Estimator asks the person to read the rates in. Parser fixtures cover one SCA and one DBA document; when SAM.gov's format changes, the parser test fails in the nightly live check.

**Limits and politeness.** No published limits. The adapter allows 1 request a second per process, caches documents for 24 hours by number and revision (in process), and sends a plain `User-Agent: Magpie/<version>`.

**Failures and what the person sees.** Endpoints moved or blocked: "SAM.gov's wage determination search isn't answering. Upload the wage determination from the solicitation, or paste its number and we'll try again later." Pricing continues with rates the person enters, labeled as entered by them.

**Test fakes.** MSW handlers for the three endpoints with the recorded 2015-4281 search result, history and revision-39 document, plus a DBA document recorded at build time.

**Verify before coding.**
- [ ] Re-check open.gsa.gov for an official wage determination API; if one exists, use it instead and drop the undocumented endpoints.
- [ ] Ask the GSA Federal Service Desk whether automated reads of the `sgs` and `wdol` endpoints are permitted and at what rate; record the answer.
- [ ] Record a Davis-Bacon document and write its parser fixture.
- [ ] Confirm `index` values (`sca`, `dbra`) and the response fields used (`fullReferenceNumber`, `revisionNumber`, `isActive`, `publishDate`, `location.states[].counties`).

## 8. NAICS code list

**Sources:** U.S. Census Bureau [NAICS downloads](https://www.census.gov/naics/?48967) (2022 NAICS "2-6 digit" code file), SBA [Small Business Size Standards dataset](https://data.sba.gov/dataset/small-business-size-standards) (file "effective 3/17/2023 to current" at the time of checking), OMB's [2026-07-13 Federal Register notice on NAICS 2027](https://www.federalregister.gov/documents/2026/07/13/2026-14086/statistical-policy-directive-no-8-north-american-industry-classification-system-naics-request-for).

**Purpose.** Validate NAICS codes on the profile and saved searches (FR-PRO-3), offer autocomplete (API `GET /reference/naics`), and show the SBA size standard next to each code.

**Facts.**
- SAM.gov and SBA size standards use NAICS 2022 today (SBA adopted it on 2022-10-01). Confirmed.
- NAICS 2027 is not final: OMB's July 2026 notice requested comments and says final changes will follow in a later notice, for establishment data from 2027-01-01. SBA adopts a new NAICS edition for size standards later, by rule. Confirmed as of 2026-11-10.

**Design.** No runtime calls. A script `packages/shared/scripts/build-naics.ts` downloads the Census 2022 code file and the SBA size standards file, joins them, and writes `packages/shared/src/reference/naics-2022.json`:

```ts
type NaicsCode = { code: string; title: string; level: 2 | 3 | 4 | 5 | 6; sizeStandard: { kind: 'receipts_millions' | 'employees'; value: number; footnote: string | null } | null };
```

The JSON is committed; a test checks it has every 6-digit code (about 1,000) and that profile validation accepts only 6-digit codes from it. When NAICS 2027 is adopted by SBA and SAM.gov, add `naics-2027.json`, accept both during the transition, and map old codes with the Census concordance.

**Verify before coding.**
- [ ] The exact download URLs of the Census "2-6 digit 2022 Code File" and the current SBA size standards file (census.gov blocked automated fetches during this review).
- [ ] Whether SBA published a newer size standards table in 2026.

## 9. Postmark

**Sources:** [Email API](https://postmarkapp.com/developer/api/email-api), [Inbound webhook](https://postmarkapp.com/developer/webhooks/inbound-webhook), [Inbound domain forwarding](https://postmarkapp.com/developer/user-guide/inbound/inbound-domain-forwarding), [Webhooks overview](https://postmarkapp.com/developer/webhooks/webhooks-overview), [Bounce webhook](https://postmarkapp.com/developer/webhooks/bounce-webhook).

**Purpose.**
1. Transactional email to Magpie users: magic links, verification, invitations, the email digest, approval and alert emails, billing notices, export ready.
2. Outreach email from Magpie's sending domain when the person has no connected Gmail or Outlook (quote requests and follow-ups, FR-SUB-2).
3. Inbound email for tracked reply addresses (FR-SUB-3).
4. Bounce and spam complaint events into `suppressions` (FR-SUB-6).

**Servers and streams.** Two Postmark servers so outreach can never hurt login and digest delivery:

| Server | Stream | From | Used for |
|---|---|---|---|
| `magpie-transactional` | `outbound` (transactional) | `Magpie <notify@<EMAIL_FROM_DOMAIN>>` | items 1 above |
| `magpie-outreach` | `outbound` (transactional) | `"<Person name> (<Company>) via Magpie" <quotes@<OUTREACH_FROM_DOMAIN>>` | item 2 |
| `magpie-transactional` | `inbound` | any address at `<INBOUND_EMAIL_DOMAIN>` | item 3 |

Each sending domain has DKIM and a custom Return-Path verified in Postmark, SPF through the Return-Path, and DMARC `p=quarantine` at least. Use separate subdomains (for example `mail.`, `bids.`, `in.` of the product domain).

**Credentials.** `POSTMARK_TRANSACTIONAL_TOKEN`, `POSTMARK_OUTREACH_TOKEN` (server tokens, header `X-Postmark-Server-Token`), `POSTMARK_INBOUND_BASIC_USER`, `POSTMARK_INBOUND_BASIC_PASSWORD`, `POSTMARK_EVENTS_BASIC_USER`, `POSTMARK_EVENTS_BASIC_PASSWORD`, `EMAIL_FROM_DOMAIN`, `OUTREACH_FROM_DOMAIN`, `INBOUND_EMAIL_DOMAIN`.

**Outbound call.** Confirmed: `POST https://api.postmarkapp.com/email` with `Accept` and `Content-Type: application/json` and the server token. Fields used: `From`, `To` (max 50 recipients across To, Cc and Bcc), `Cc`, `ReplyTo`, `Subject`, `HtmlBody`, `TextBody`, `MessageStream`, `Tag` (the notification kind or `quote_request`), `Headers`, `Attachments` (`Name`, `Content` base64, `ContentType`), `Metadata` `{ tenantId, messageId }` or `{ tenantId, notificationId }`, `TrackOpens: false`, `TrackLinks: "None"`. Response: `MessageID`, `SubmittedAt`, `ErrorCode` (0 on success), `Message`. Batch (`/email/batch`, 500 messages) is not needed in v1.

Outreach messages also carry:
- `ReplyTo: q-<reply_token>@<INBOUND_EMAIL_DOMAIN>`;
- `List-Unsubscribe: <https://<APP_URL host>/unsubscribe/<token>>, <mailto:u-<reply_token>@<INBOUND_EMAIL_DOMAIN>>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (API §7);
- `X-Magpie-Message-Id: <messages.id>`;
- the workspace's `outreach_footer` and postal address in the body (CAN-SPAM).

Attachments over 5 MB in total are sent as links to `/files/shared/<token>` (API §7) instead of inline, to stay well under Postmark's message size limit.

**Reply tokens and routing.** `quote_requests.reply_token` is 32 random bytes encoded with the RFC 4648 base32 alphabet in lowercase without padding (52 characters of `[a-z2-7]`, as AGENT_RUNTIME's `quotes.draft_request` creates it), so the address `q-<token>@<INBOUND_EMAIL_DOMAIN>` survives mail systems that lowercase or mangle case. Inbound domain forwarding (confirmed): an MX record `<INBOUND_EMAIL_DOMAIN>` priority 10 to `inbound.postmarkapp.com`, the domain set as the inbound stream's Inbound Domain, and Postmark accepts mail to any address at it. The webhook payload's `OriginalRecipient`, `ToFull`, `CcFull` and `BccFull` are searched for the token (API §11.2). `MailboxHash` (plus addressing) is not used. `StrippedTextReply` gives the reply without quoted history. Attachments arrive base64 in `Attachments[]` with `Name`, `Content`, `ContentType`, `ContentLength`. Mail to `u-<reply_token>@<INBOUND_EMAIL_DOMAIN>` (the `List-Unsubscribe` mailto) is handled by the same webhook: the sender is suppressed and nothing is routed. Both local parts are 54 characters, inside the 64-character limit.

**Webhook security.** Confirmed: Postmark does not sign webhooks with HMAC; it recommends HTTP Basic credentials in the webhook URL (`https://<user>:<password>@<host>/webhooks/postmark-inbound`) plus an IP allowlist from its [firewall IP list](https://postmarkapp.com/support/article/800-ips-for-firewalls#webhooks), and notes that the source IP can change between attempts. Magpie uses Basic credentials (required) and the IP allowlist (optional, `POSTMARK_WEBHOOK_IPS`).

**Retries by Postmark.** Confirmed: inbound webhooks are retried 10 times (1 min, 5 min, 10 min three times, 15 min, 30 min, 1 h, 2 h, 6 h) on any non-200, and a `403` stops retries. Bounce and spam webhooks are retried up to 6 times over about 51 minutes on 5xx, 408, 429 and network errors; other 4xx drop the event. Each request has `X-PM-Retries-Remaining`.

**Our retries and idempotency.** Postmark has no idempotency key. The send runs in a DBOS step on queue `messaging`: the step first loads the `messages` (or `notifications`) row; if it already has `provider_message_id`, it returns without sending; otherwise it sends and stores `MessageID` in the same step. A crash between Postmark accepting and the row update can cause one duplicate on retry; `X-Magpie-Message-Id` lets support spot it. The HTTP client does not retry sends; DBOS retries the step on `unavailable` and `rate_limited` only.

**Errors and what the person sees.**

| Postmark answer | Behaviour | The person sees |
|---|---|---|
| `ErrorCode 406` (inactive recipient: bounced or complained before) | No retry; add `suppressions` `hard_bounce`; message `failed` | "Your quote request to Ana at ABC Cleaning wasn't sent: that address bounced before. Update the contact's email." |
| `ErrorCode 300` (invalid email) | No retry; message `failed` | "That email address isn't valid." |
| `401` or `10` (bad token) | Ops alert; message stays `queued` and retries for 1 hour | nothing until it fails: "Email is delayed. We're working on it." |
| `429`, 5xx, timeout | DBOS step retry | nothing |

**Policy risk (verify before launch).** Postmark's terms require permission-based email, and reviewers report that it bans accounts for cold outreach. Quote requests go one at a time, to businesses the owner chose, after the owner approves each one, with an unsubscribe link, but some recipients will have no prior relationship with the owner. Before sending outreach through Postmark, get Postmark's written confirmation that this use is acceptable on a dedicated server. If they decline, keep Postmark for transactional and inbound, send outreach only from connected Gmail or Outlook, and add the fallback provider named in ARCHITECTURE §3 (Resend) for the outreach stream after the same check.

**Local and test.** Local dev uses a Postmark fake that writes each message to Mailpit over SMTP so developers can read it at `http://localhost:8025`. Tests use `createFakeEmailSender()`. Inbound and event webhooks are tested with recorded payloads posted to the api (`pnpm webhook:post postmark-inbound <fixture>`).

**Verify before coding.**
- [ ] The maximum message size including attachments, and the inbound size limit.
- [ ] Whether `Metadata` is echoed in `SpamComplaint` and `Delivery` webhooks as it is in `Bounce`.
- [ ] Bounce `Type` names that mean "stop sending" (from the Bounce API reference).
- [ ] Written answer from Postmark on quote-request outreach (above).
- [ ] Current webhook IP list.

## 10. Gmail API, send only

**Sources:** [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), [Gmail API quotas](https://developers.google.com/workspace/gmail/api/reference/quota).

**Purpose.** Send quote requests and follow-ups from the owner's own Gmail or Google Workspace address (FR-SUB-2), so replies look like normal mail and deliverability rides on the owner's domain. Replies still come back through the tracked `Reply-To` (ARCHITECTURE §14 decision 6).

**Scope classification.** Confirmed:

| Scope | Class | Needs |
|---|---|---|
| `https://www.googleapis.com/auth/gmail.send` | Sensitive | Sensitive scope verification: public home page, privacy policy on the same domain describing Google user data use, domain ownership in Search Console, a justification per scope, an unlisted YouTube demo video of the consent flow. Google says it can take up to 10 days. No security assessment. |
| `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.metadata` | Restricted | Restricted scope verification plus a CASA security assessment by a Google-approved assessor when the data is stored or transmitted on servers, renewed at least every 12 months. Not requested in v1. |

So send-only avoids CASA. Until verification completes, Google caps how many accounts can grant the scope and shows an "unverified app" warning; submit verification during M0 so pilots never see it.

**Credentials.** Platform OAuth client in Magpie's Google Cloud project: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (the same project as sign-in; sign-in requests only `openid email profile`). Per user: refresh token in `secrets` (`kind = 'oauth_refresh_token'`, `provider = 'google'`), `connections` row (`provider = 'google'`, `purpose = 'send_email'`, `account_label` = the Gmail address, `scopes`).

**Calls.**

| Step | Call |
|---|---|
| Authorize | `https://accounts.google.com/o/oauth2/v2/auth?client_id=&redirect_uri=<APP_URL>/api/app/connections/google/callback&response_type=code&scope=openid%20email%20https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent&include_granted_scopes=true&state=&code_challenge=&code_challenge_method=S256&login_hint=` |
| Token | `POST https://oauth2.googleapis.com/token` (`grant_type=authorization_code`, then `refresh_token`) |
| Send | `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with `{ raw: base64url(RFC 5322 message) }`; response `{ id, threadId }` stored as `provider_message_id` and `thread_key` |
| Revoke on disconnect | `POST https://oauth2.googleapis.com/revoke?token=<refresh token>` |

The RFC 5322 message is built with a MIME library (not by hand): `From` = the connected address with the person's name, `To`, `Subject`, `Reply-To` tracked address, `List-Unsubscribe` and `List-Unsubscribe-Post`, `Message-ID: <messages.id@<OUTREACH_FROM_DOMAIN>>`, `X-Magpie-Message-Id`, multipart text and HTML, attachments.

**Limits.** Confirmed: `messages.send` costs 100 quota units; 6,000 units per user per minute (60 sends a minute) and 1,200,000 per project per minute. Gmail's own daily sending limits per account apply on top (lower for consumer Gmail than for Workspace; verify current numbers in Google Workspace admin help). Magpie sends at most 1 message every 2 seconds per connected mailbox.

**Retries.** Access tokens last about an hour; refresh before use when under 5 minutes remain. `429` and `5xx`: DBOS step retry. `invalid_grant` on refresh: connection `status = 'expired'`, the pending send fails, and the person is told. Magpie never silently switches a failed Gmail send to Postmark, because the sender identity would change; the person chooses "Send from Magpie instead".

**Idempotency.** As Postmark: the step checks `provider_message_id` before sending; Gmail has no idempotency key.

**Failures and what the person sees.** Expired or revoked: "Gmail disconnected, so the quote request to ABC Cleaning wasn't sent. Reconnect Gmail or send it from Magpie." Daily limit (`403` with a sending limit reason): "Gmail's daily sending limit was reached. The rest will send tomorrow, or send them from Magpie now."

**Test fakes.** MSW for token, send and revoke; `createFakeEmailSender({ provider: 'gmail' })`.

**Verify before coding.**
- [ ] `gmail.send` is still Sensitive (not Restricted) and sensitive verification still needs no security assessment.
- [ ] The unverified-app user cap and its effect on refresh tokens while the app is in "Testing" status (keep the app "In production").
- [ ] Current Gmail daily sending limits for consumer and Workspace accounts.

## 11. Microsoft Graph, `Mail.Send`

**Sources:** [Publisher verification overview](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview), Microsoft Graph [`user: sendMail`](https://learn.microsoft.com/en-us/graph/api/user-sendmail) (verify the page).

**Purpose.** Same as §10 for Outlook and Microsoft 365 mailboxes.

**App registration.** One multitenant Entra app that also accepts personal Microsoft accounts (`common` authority), delegated permissions `Mail.Send`, `User.Read`, `offline_access`, `openid`, `email`. Confirmed: publisher verification needs a Microsoft AI Cloud Partner Program (Partner One) account that is verified, the app registered in an Entra tenant (not with a personal Microsoft account), a publisher domain that is not `*.onmicrosoft.com`, and an admin with the right roles; it is free. Since November 2020, when risk-based step-up consent is on, users cannot consent to an unverified multitenant app that asks for more than sign-in and basic profile. Complete verification during M0. Some organizations also require admin consent for any app; the person then sees "Your Microsoft 365 admin needs to approve Magpie" with the admin consent link.

**Credentials.** `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`; per user refresh token in `secrets` (`provider = 'microsoft'`).

**Calls.**

| Step | Call |
|---|---|
| Authorize | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` with PKCE, `scope=offline_access openid email User.Read Mail.Send` |
| Token | `POST https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Send | Create then send so a message id exists: `POST https://graph.microsoft.com/v1.0/me/messages` (subject, HTML body, `toRecipients`, `replyTo`, `internetMessageHeaders`, attachments) then `POST /me/messages/{id}/send`. `POST /me/sendMail` returns `202` without an id, so it is not used. |
| Disconnect | Delete the stored tokens; Microsoft has no per-app token revocation call for delegated user tokens, so the disconnect screen links to `https://myaccount.microsoft.com/` (personal) or `https://myapps.microsoft.com/` (work) to remove the app (verify). |

`internetMessageHeaders` accepts only custom `x-` headers (verify), so `List-Unsubscribe` may not be settable through Graph; the unsubscribe link in the body footer still satisfies CAN-SPAM.

**Limits.** `429` with `Retry-After` on throttling; Exchange Online per-mailbox sending limits apply (verify current recipient and per-minute limits). Magpie sends at most 1 message every 2 seconds per mailbox.

**Retries, idempotency, failures.** As §10. `invalid_grant` or `AADSTS700082` (refresh token expired after inactivity): connection `expired`.

**Verify before coding.**
- [ ] Draft-then-send returns the message id and `internetMessageId`, and works for personal accounts.
- [ ] Which headers `internetMessageHeaders` accepts.
- [ ] Current Exchange Online sending limits.
- [ ] Publisher verification completed and the publisher domain set.

## 12. Twilio Programmable Messaging and Verify

**Sources:** [A2P 10DLC overview](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc), [10DLC fees](https://help.twilio.com/articles/1260803965530) (fees changed 2025-08-01), [Webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security), [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out), [Track outbound message status](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status), [SMS character limits](https://www.twilio.com/docs/glossary/what-sms-character-limit), [Verify VerificationCheck](https://www.twilio.com/docs/verify/api/verification-check). Reference implementation: `openduet/openbot/server/src/delivery/twilio.ts` and `routes.ts`.

**Purpose.** Texts to Magpie's own users only (PRD §7: never to their customers or subs in v1): the morning digest, approvals, deadline reminders, alerts, chat replies (FR-CH-1, FR-CH-3 to FR-CH-6). Phone verification codes (FR-CH-1).

**Registration.** One Magpie brand and one campaign:

| Item | Choice | Facts |
|---|---|---|
| Brand | Standard brand (needs Magpie's EIN), with secondary vetting for a higher Trust Score | Twilio support article (2025-08-01 fees): $4.50 registration plus $41.50 vetting, $46 one time. Verify. |
| Campaign | Use case "Account Notification": messages to account holders about their own account (digests, approvals waiting, deadlines, replies to their texts) | Campaign vetting $15 one time; Standard campaign $10 a month (low-volume mixed is $1.50 but caps T-Mobile at 2,000 segments a day). Verify. |
| Throughput | Standard brands start at 2,000 segments a day to T-Mobile and rise with Trust Score | Confirmed on the 10DLC page; verify Magpie's score after vetting |
| Verification codes | Sent by Twilio Verify, not through the campaign | Twilio's 10DLC page: when 10DLC numbers only send verification texts, Twilio Verify can be used instead of registering. Verify also brings Fraud Guard against SMS pumping on the sign-up flow. |

Campaign description, opt-in flow (the person types their number in Settings and confirms the code), sample messages (a digest, an approval with "Reply A7 to approve", a deadline reminder) and the HELP and STOP texts must match what the app sends; register during M0 (PRD §12).

**Messaging Service.** One Messaging Service holding the 10DLC number(s), with Advanced Opt-Out on (default English keywords, custom confirmation texts), incoming message webhook `<TWILIO_WEBHOOK_BASE_URL>/webhooks/twilio/sms`, and no service-level status callback (each message sets its own, API §11.2).

HELP text: "Magpie: account alerts and approvals for your workspace. Msg frequency varies. Msg and data rates may apply. Help: <APP_URL>/help/sms. Reply STOP to opt out." STOP confirmation: "You're unsubscribed from Magpie texts. Reply START to turn them back on."

**Credentials.** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (also the webhook signing key), `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET` (REST calls), `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_WEBHOOK_BASE_URL` (the exact public origin Twilio calls; signatures are computed over it).

**Calls.**

| Port method | Call |
|---|---|
| `SmsSender.send` | `client.messages.create({ messagingServiceSid, to, body, statusCallback: '<TWILIO_WEBHOOK_BASE_URL>/webhooks/twilio/status?t=<tenant>&n=<notification id>' })` (Twilio Node SDK 6.x) = `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`; response `sid`, `status`, `num_segments` |
| `PhoneVerifier.start` | `POST https://verify.twilio.com/v2/Services/{VerifySid}/Verifications` with `To`, `Channel=sms`; expect `status: 'pending'` |
| `PhoneVerifier.check` | `POST https://verify.twilio.com/v2/Services/{VerifySid}/VerificationCheck` with `To`, `Code`; `approved` means verified; the verification expires after 10 minutes (confirmed) |

Verify service settings: code length 6, Fraud Guard on, US-only geo permissions for SMS. Magpie also counts tries in `link_codes.attempts` and stops at 5 (FR-CH-1), whatever Verify's own limit is.

**Message size and segments.** Confirmed: GSM-7 is 160 characters in one segment and 153 per segment when split; UCS-2 is 70 and 67; Twilio accepts up to 1,600 characters and advises staying under 320. Magpie:
- normalizes text to GSM-7 before sending (curly quotes to straight, dashes to hyphens, no emoji) so one stray character does not switch the whole message to UCS-2;
- keeps notifications under 320 characters and the digest under 1,000 characters (FR-CH-3), so at most 7 segments;
- counts segments with a shared function in `packages/shared/src/sms.ts` (GSM-7 basic set, extension characters count as 2) and meters `num_segments` from Twilio's response (`usage_events.key = 'sms_segments'`).

**Inbound and status.** API §11.2, §11.4, §11.5. Signature (confirmed): `X-Twilio-Signature` is HMAC-SHA1 of the full URL plus the alphabetically sorted POST parameters, keyed with the auth token; use the SDK's `validateRequest`, compute over `TWILIO_WEBHOOK_BASE_URL` plus the path and query exactly as configured, never the `Host` header behind Railway's proxy. Status callbacks can arrive out of order (confirmed). Advanced Opt-Out (confirmed): Twilio answers STOP, START and HELP itself, sends the webhook with `OptOutType` `STOP`, `START` or `HELP`, and later sends to an opted-out number fail with error `21610`.

**Quiet hours.** `notifications.send_after` is set to the end of quiet hours for non-urgent kinds (FR-CH-5); deadline reminders inside 2 hours ignore quiet hours.

**Retries.** Sends run in DBOS steps on queue `messaging` (per tenant 5). Twilio has no idempotency key for message creation, so the step checks `notifications.provider_message_id` first, as §9. Retry on 429, 5xx and timeouts only. Error `21610`, `21211` (invalid number) and `21614` (not mobile): no retry; disable the binding with the reason; fall back to email for that notification.

**Failures and what the person sees.** Binding disabled: Settings, Phone and chat shows "Texts to (555) 123-4567 stopped: <reason>. We'll email you instead." and the next digest goes by email. Twilio down: notifications wait in the outbox, then go by email after 30 minutes for approvals and deadline reminders.

**Test fakes.** Twilio test credentials and magic numbers for sandbox sends; MSW handlers for Messages and Verify with recorded payloads; recorded inbound and status form posts signed with a test auth token (the reference implementation's `verifyTwilioRequest` cases, including duplicate keys); `createFakeSmsSender()` and `createFakePhoneVerifier()` (fixed code `123456`).

**Verify before coding.**
- [ ] Current 10DLC fees and whether "Account Notification" fits digests that also list new bid matches (the match list is about the account holder's own saved searches).
- [ ] Response field name for segment count in the Messages response (`num_segments`) for the pinned SDK.
- [ ] Verify's maximum check attempts and send rate limits per number; Fraud Guard defaults.
- [ ] Error codes for unreachable, landline and carrier-filtered numbers in the current error dictionary.

## 13. Telegram Bot API

**Sources:** [Bot API reference](https://core.telegram.org/bots/api) (Bot API 10.4, 2026-11-09), [Bot features: deep linking](https://core.telegram.org/bots/features), [Bots FAQ: limits](https://core.telegram.org/bots/faq). Reference implementation: `openduet/openbot/server/src/delivery/telegram.ts` and `routes.ts`.

**Purpose.** One platform bot that reaches users in private chats: digest, approvals with buttons, reminders, alerts and chat with the Assistant (FR-CH-2, FR-CH-3, FR-CH-4, FR-CH-6).

**Credentials.** `TELEGRAM_BOT_TOKEN` (from @BotFather; validated at boot against `^\d+:[\w-]{30,}$` as the reference does), `TELEGRAM_WEBHOOK_SECRET` (1 to 256 characters of `A-Z a-z 0-9 _ -`, confirmed), `TELEGRAM_BOT_USERNAME` (or `getMe`, cached).

**Webhook registration.** A release step (and idempotent worker start-up check) calls `setWebhook` with `url = <APP_URL>/webhooks/telegram`, `secret_token = TELEGRAM_WEBHOOK_SECRET`, `allowed_updates = ["message", "callback_query", "my_chat_member"]`, `max_connections = 40`, `drop_pending_updates = false`. Confirmed: Telegram sends the secret in `X-Telegram-Bot-Api-Secret-Token`; webhook ports are 443, 80, 88 and 8443; non-2xx responses are retried "a reasonable amount of attempts".

**Linking (deep link).** Confirmed: `https://t.me/<bot username>?start=<parameter>`, parameter up to 64 characters of `A-Z a-z 0-9 _ -`, delivered to the bot as the text `/start <parameter>` in the private chat. Magpie's parameter is a 32-character base64url random code stored in `link_codes` (`channel = 'telegram'`, 10-minute expiry). Handling is in API §11.6.

**Sending.**

| Port method | Call | Notes |
|---|---|---|
| `sendMessage` | `POST https://api.telegram.org/bot<token>/sendMessage` | `chat_id`, `text` (1 to 4,096 characters after entity parsing, confirmed; longer text splits at a line break as the reference does), `link_preview_options: { is_disabled: true }`, `reply_markup.inline_keyboard` on the last part only |
| `answerCallback` | `answerCallbackQuery` | `callback_query_id`, short `text`; always answer, or the button spins |
| `editMessage` | `editMessageText` and `editMessageReplyMarkup` | remove buttons after a decision |
| `leaveChat` | `leaveChat` | when added to a group |

Plain text only (no `parse_mode`), so no escaping bugs. Buttons: approvals get `[Approve]` (`apr:<uuid>:a`), `[Skip]` (`apr:<uuid>:s`) and `[Edit]` (`apr:<uuid>:e`, answered with a one-time edit link), as AGENT_RUNTIME §8.5 defines; digest matches get `[Pursue 1]` (`mt:<uuid>:p`) and `[Dismiss 1]` (`mt:<uuid>:d`). Confirmed: `callback_data` is 1 to 64 bytes; Magpie's longest is 42.

**Limits.** Confirmed in the FAQ: avoid more than 1 message a second in one chat; about 30 messages a second across users (bulk); 20 a minute in a group (not used). Over the limit Telegram returns `429` with `parameters.retry_after` (seconds, confirmed in `ResponseParameters`). Magpie rate-limits Telegram sends to 25 a second per process with a shared token bucket and spreads the 7 a.m. digest fan-out with `send_after` jitter of up to 5 minutes (still inside FR-CH-3's 10 minutes).

**Retries.** Sends in DBOS steps; `429` waits `retry_after`; 5xx and network errors retry; no idempotency key, so the step checks `notifications.provider_message_id` first.

**Errors.** `403` (bot blocked by the user) or `400 chat not found`: disable the binding (`disabled_reason = 'blocked'`), email the person "Telegram stopped accepting messages from Magpie, so we'll email you. Connect Telegram again in Settings."

**Test fakes.** MSW handlers for `api.telegram.org/bot*/{method}`; recorded update fixtures: `/start` with a valid code, with an expired code, plain text, `/stop`, a callback press, a group message, `my_chat_member` kicked; `createFakeTelegramClient()`.

**Verify before coding.**
- [ ] Bot API changes after 10.4 that touch `sendMessage`, callbacks or webhooks.
- [ ] Whether to use the newer `Rich Messages` or widgets (10.3, 10.4) for approval cards later; v1 stays with plain text and inline keyboards.

## 14. Stripe

**Sources:** [API upgrades and versions](https://docs.stripe.com/upgrades) (current version `2026-10-28.endive`), [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Meter events](https://docs.stripe.com/api/billing/meter-event/create), Checkout, Customer Portal and Stripe Tax docs on docs.stripe.com (verify each page at build time).

**Purpose.** Plans through Checkout, self-service through the Customer Portal, cancel in the app, run packs as one-time purchases, sales tax with Stripe Tax, usage reporting to Meters, and webhooks that drive `subscriptions` and `entitlements` (FR-BIL-1 to FR-BIL-7). Prices, allowances and the state machine are in BILLING.md; this section is the provider contract.

**Credentials.** `STRIPE_SECRET_KEY` (restricted key with only the resources below), `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION=2026-10-28.endive`. The Node SDK (`stripe` 23.x at the time of checking) is created with `apiVersion` pinned to that value; the webhook endpoint is created with the same API version so event payloads match the SDK types.

**Catalog.** One Product per plan with a monthly Price (`lookup_key` `plan_<plans.key>_month`), stored in `plans.stripe_price_id`; one one-time Price for the run pack (`lookup_key` `run_pack`). Products carry the SaaS tax code Stripe Tax uses for business software (verify the code). Catalog changes are made in the Dashboard and copied into `plans` by an ops script, never by code at runtime.

**`BillingProvider` methods and calls.**

| Method | Stripe call | Key parameters |
|---|---|---|
| `createCustomer(tenant)` | `customers.create` | `name`, `email` (owner), `metadata.tenantId`; idempotency key `customer:<tenant_id>`; called in the sign-up hook before the seed transaction (API §15 item 15) |
| `createCheckoutSession(tenant, plan)` | `checkout.sessions.create` | `mode: 'subscription'`, `customer`, `line_items: [{ price, quantity: 1 }]`, `client_reference_id: tenantId`, `subscription_data: { metadata: { tenantId }, trial_end }` (the in-app trial end when still in the future), `automatic_tax: { enabled: true }`, `customer_update: { address: 'auto', name: 'auto' }`, `billing_address_collection: 'required'`, `tax_id_collection: { enabled: true }`, `allow_promotion_codes: true`, `success_url`, `cancel_url` |
| `createRunPackCheckout(tenant, quantity)` | `checkout.sessions.create` | `mode: 'payment'`, `line_items: [{ price: run pack, quantity }]`, `invoice_creation: { enabled: true }`, `metadata` and `payment_intent_data.metadata`: `{ tenantId, kind: 'run_pack', quantity }`, `automatic_tax: { enabled: true }` |
| `createPortalSession(tenant)` | `billingPortal.sessions.create` | `customer`, `return_url`; portal configuration allows payment method update, invoice history, plan switching between public plans, tax id update, and cancel at period end |
| `cancelAtPeriodEnd(tenant, reason)` | `subscriptions.update` | `cancel_at_period_end: true`, `cancellation_details: { comment, feedback }` (verify field names) |
| `resume(tenant)` | `subscriptions.update` | `cancel_at_period_end: false` |
| `getSubscription(id)` | `subscriptions.retrieve` | used by every subscription webhook (API §11.3) |
| `grantCredit(tenant, cents)` | `customers.createBalanceTransaction` | negative `amount` is a credit; ops only |
| `reportUsage(rows)` | `billing.meterEvents.create` | `event_name`, `payload: { stripe_customer_id, value }`, `identifier`, `timestamp` |

**Meters.** Confirmed: `identifier` is unique for at least 24 hours, `timestamp` must be within the past 35 calendar days and at most 5 minutes ahead. The `report-usage` schedule (hourly) sums unreported `usage_events` per tenant, key and hour, sends one meter event with `identifier = <tenant_id>:<key>:<hour start ISO>`, and sets `stripe_reported_at` on those rows in the same DBOS step's follow-up transaction. Which keys are metered to Stripe (if any beyond analytics) is BILLING.md's decision; the reporting path exists either way.

**Webhooks.** Endpoint `<APP_URL>/webhooks/stripe` subscribed to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`, `charge.refunded`, `charge.dispute.created`. Handling in API §11.3. Confirmed: in live mode Stripe retries a failing endpoint for up to 3 days with exponential backoff; subscription status values are `trialing`, `active`, `incomplete`, `incomplete_expired`, `past_due`, `canceled`, `unpaid`, `paused`. `subscriptions.status` in DATA_MODEL has no `incomplete_expired`; map it to `canceled` (noted in §26).

**Retries and idempotency.** Every Stripe POST passes an idempotency key (SDK option `idempotencyKey`): the API request's `Idempotency-Key` when there is one, else a deterministic key (`customer:<tenant>`, `cancel:<subscription>:<date>`). The SDK retries network errors and 409, 429 and 5xx with backoff (set `maxNetworkRetries: 2`). Webhook processing is idempotent by `webhook_receipts` and by always re-reading the subscription.

**Limits.** Stripe's default live-mode API rate limit is on the order of 100 requests a second (verify); Magpie's volume is far below it.

**Failures and what the person sees.** Checkout or portal creation fails: "Billing is unavailable right now. Try again in a few minutes." (`external_unavailable`). Webhook handler error: `500`, Stripe retries, ops alert after 3 failures of the same event.

**Test fakes.** Test-mode keys in staging with Test Clocks to run the trial, past-due and cancellation state machine (FR-BIL-6); webhook fixtures signed with `stripe.webhooks.generateTestHeaderString` for unit tests; `createFakeBillingProvider()`; optional `stripe-mock` in Docker for SDK-level tests.

**Verify before coding.**
- [ ] `2026-10-28.endive` is still current or pin the newest at build time; webhook endpoint created with the same version.
- [ ] Field names `cancellation_details`, `invoice_creation`, `customer_update`, `tax_id_collection` for the pinned version.
- [ ] Stripe Tax registrations and origin address set; the tax code for the products.
- [ ] Portal configuration options for plan switching.

## 15. Cloudflare R2

**Source:** [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

**Purpose.** `ObjectStorage` for every file: uploads, bid document copies, inbound attachments, generated exports, data exports.

**Credentials.** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (one bucket per environment). Endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`. SDK: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (3.x). Local: MinIO with the same SDK (`forcePathStyle: true`).

**Keys.** `t/<tenant_id>/<yyyy>/<mm>/<file_id>` (DATA_MODEL `files.storage_key`). Nothing outside `t/<tenant_id>/` holds tenant data. Public market documents downloaded for the viewer are tenant copies under the tenant prefix.

**Calls and rules.** Confirmed:
- Presigned operations: `GET`, `HEAD`, `PUT`, `DELETE`. Presigned `POST` form uploads are not supported, so uploads use presigned `PUT`.
- Expiry from 1 second to 7 days.
- Presigned URLs work only on the S3 API domain, not on custom domains.
- `Content-Type` signed into the URL must match the upload or R2 returns `403 SignatureDoesNotMatch`.
- Browser uploads need a bucket CORS rule.

| Use | Detail |
|---|---|
| Upload | `PutObjectCommand` presigned for 15 minutes with `ContentType` and `ContentLength` signed (verify R2 enforces a signed `Content-Length`; if not, the completion check below is the guard). Bucket CORS: origin `APP_URL`, methods `PUT`, headers `Content-Type`, max age 3,600. |
| Completion | `HeadObject`: size must equal the reserved `sizeBytes` and be within the limit, else delete the object and answer `409` or `413` (API §5.17). |
| Download | `GetObjectCommand` presigned for 5 minutes with `ResponseContentDisposition` (`attachment; filename*=UTF-8''<encoded name>`) and `ResponseContentType`. |
| Worker reads | `GetObject` streams (scan, text extraction, export ZIPs). |
| Deletion | `DeleteObject`; tenant deletion lists `t/<tenant_id>/` with `ListObjectsV2` and deletes with `DeleteObjects` in batches of 1,000. |
| Lifecycle | Abort incomplete multipart uploads after 1 day. Objects of rows never completed are deleted by the `cleanup` schedule after 24 hours. |

**Metering.** `storage_bytes` usage events: plus the size on completion, minus on deletion.

**Retries.** The S3 SDK retries 5xx and throttling with its standard strategy (`maxAttempts: 3`).

**Failures.** R2 unavailable: uploads and downloads return `external_unavailable` ("Files are unavailable right now. Try again in a minute."); background steps retry.

**Test fakes.** MinIO in `infra/docker-compose.yml` for integration tests; `createFakeObjectStorage()` (in-memory map) for unit tests.

**Verify before coding.**
- [ ] Whether R2 enforces a signed `Content-Length` on presigned `PUT`.
- [ ] Single `PUT` maximum object size (above Magpie's 100 MB limit).
- [ ] CORS rule format for the bucket.

## 16. Malware scanning (ClamAV)

**Sources:** [ClamAV in Docker](https://docs.clamav.net/manual/Installing/Docker.html), [clamd protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).

**Decision.** Run `clamd` as a private Railway service from the official image `clamav/clamav:<pinned feature release>` (the docs recommend pinning a feature release such as `1.4` over `latest`), reachable only on Railway's private network on TCP 3310. The worker streams files to it. Not inside the worker image, because clamd needs its own memory and signature updates, and every worker replica would otherwise carry them. It is a vendor image like Postgres, so ARCHITECTURE's "two deployable processes share one codebase" still holds. Add it to ARCHITECTURE's service list (§26).

**Sizing and updates.** Confirmed: the image runs both `freshclam` and `clamd`; minimum 3 GiB of memory, 4 GiB preferred (signatures alone take over 1.2 GiB and a reload can briefly need over 2.4 GiB); `FRESHCLAM_CHECKS` sets updates per day (default 1). Magpie: 4 GiB memory, `FRESHCLAM_CHECKS=4`, `CLAMD_STARTUP_TIMEOUT` default, health check `zPING\0` expecting `PONG`.

`clamd.conf` overrides: `StreamMaxLength 110M` (above the 100 MB upload limit), `MaxFileSize 110M`, `MaxScanSize 400M`, `MaxRecursion 16`, `MaxFiles 10000`, `AlertExceedsMax yes`.

**Protocol.** Confirmed: send `zINSTREAM\0`, then chunks each prefixed by a 4-byte unsigned length in network byte order, then a zero-length chunk (`00 00 00 00`). Replies: `stream: OK`, `stream: <signature> FOUND`, or an error such as `INSTREAM size limit exceeded`. Magpie writes its own client (about 60 lines in `packages/integrations/src/clamav/`) using 64 KB chunks and a 120-second timeout, so no extra dependency.

**When files are scanned.** Every user upload, every inbound email attachment, every document downloaded from a public source for the viewer, before any text extraction or download link (FR-BID-1). Generated exports are not scanned (`scan_status = 'skipped'`). Workflow `scanFile` on queue `docs`, id `scan:<file id>`.

**Results.**

| clamd reply | `files.scan_status` | Then |
|---|---|---|
| `stream: OK` | `clean` | text extraction (§17) if the file is a bid document, quote attachment or library item |
| `stream: <sig> FOUND` (including `Heuristics.Limits.Exceeded`) | `infected` | delete the R2 object, keep the row, audit, notify the uploader: "We removed <file> because it contains malware (<signature>)." Inbound attachments are dropped from the message with a note. |
| error, timeout, connection refused | stays `pending` | DBOS step retry for up to 1 hour; then `skipped` with an ops alert; skipped files are never read by Bots, and the person sees "We couldn't scan this file, so Bots won't read it." |

**Local and test.** `infra/docker-compose.yml` runs the same image (it needs about 2 GB locally). `CLAMAV_DISABLED=true` is allowed only when `NODE_ENV` is not `production` and marks files `skipped`. Integration tests send the EICAR test string and expect `FOUND`; unit tests use `createFakeMalwareScanner()` (clean unless the content contains EICAR).

**Verify before coding.**
- [ ] The current stable feature release tag of `clamav/clamav`.
- [ ] Railway private networking for a TCP service and its memory limits.
- [ ] Signature update traffic is allowed from Railway (freshclam mirrors).

## 17. Document text extraction

**Sources:** Kontract text route (§3), [unpdf](https://github.com/unjs/unpdf), [exceljs](https://github.com/exceljs/exceljs), Anthropic [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support) (limits confirmed from Anthropic's API reference of 2026-11-03; verify the URL).

**Purpose.** `TextExtractor` turns documents into page-numbered text chunks for Bid Reader, citations and the viewer: public bid documents once for every tenant (`market_opportunity_texts`), tenant uploads per tenant (`bid_document_chunks`).

**Routing by source and type.**

| Input | Method | Page numbers for citations |
|---|---|---|
| Public bid document readable by Kontract | Kontract `POST /opportunities/:id/text` (§3), split on `[page N]` markers | from the markers |
| Public document Kontract marks `scanned` or `failed`, or a wage determination it leaves out | download the attachment (URL from `details.documents`), scan (§16), then the rows below | as below |
| PDF with a text layer | `unpdf` (pdf.js) per page | PDF page number |
| PDF page with under 20 characters of text and an image | OCR by model vision for that page | PDF page number |
| Scanned PDF, PNG, JPEG, TIFF, HEIC | OCR by model vision | PDF page, or 1 for an image |
| DOCX | convert to PDF with the renderer (§18), then as PDF, so citations match the pages the person sees | PDF page number |
| XLSX | `exceljs`: each sheet becomes text with `[sheet <name>]` markers and `A12: value` cells for non-empty cells | `page` = sheet number (1-based) |
| CSV, TXT | read as UTF-8 | 1 |

**OCR by model vision.** Through `packages/llm` (`llm.generate`, tier `fast`, a catalog entry with `supportsVision`), never a direct provider call. Pages go in batches of up to 20 as a PDF document part (Anthropic's limits are 32 MB a request and 600 pages, 100 for 200k-context models, confirmed in Anthropic's API reference), with the instruction to transcribe verbatim, keep tables as rows, and mark `[page N]`. The tenant's model policy applies; if it excludes every vision-capable provider, the document gets `text_status = 'unsupported'` and the message "Your model settings don't allow reading scanned pages. Upload a text version." For public documents (no customer data) the platform default policy applies. Tesseract is not used in v1.

**Chunking and embeddings.** One chunk per page; pages over 8,000 characters split at paragraph breaks with no overlap; `page_from` and `page_to` recorded. Embeddings through `llm.embed` (tier `embed`, 1536 dimensions). A tenant that excludes the embedding provider gets no embeddings on its own chunks; search falls back to Postgres full-text on those.

**Limits.** 100 MB per file, 1,500 pages per document (above that `unsupported`), 10 minutes per document for the brief target (FR-BID-2: 100 pages within 10 minutes). Workflow `extractText` on queue `docs` (per tenant 2), id `extract:<document id>:<file sha256>`.

**Metering.** Every page read counts `doc_pages` for the tenant that triggered the read; OCR model cost is metered by the gateway (`ai_cost`, feature `ocr`). How shared public pages count against plans is BILLING.md's decision.

**Failures and what the person sees.** `text_status = 'failed'` with a reason: "We couldn't read <file>: it's password-protected." / "...the scan is too blurry." / "...it's larger than 1,500 pages." Bots treat missing text as unknown, never as empty.

**Test fakes.** Fixture files: a text PDF, a scanned PDF page, a DOCX with tables, an XLSX price schedule, a password-protected PDF; `createFakeTextExtractor()`.

**Verify before coding.**
- [ ] `unpdf`, `exceljs` and the AI SDK file-part support for PDFs with the pinned versions.
- [ ] OCR accuracy and cost on 10 real scanned solicitations; if model vision is too costly, evaluate Tesseract for clean scans and record the decision.

## 18. Document rendering (DOCX and PDF)

**Sources:** [Gotenberg docs](https://gotenberg.dev/docs) (not checked in this review; every Gotenberg fact below is verify), [docx](https://docx.js.org/), [pdf-lib](https://pdf-lib.js.org/).

**Purpose.** `DocumentRenderer` for bid packages and draft exports that "open in Word and Acrobat without errors" (FR-BID-9), page counts for page-limit warnings (FR-DRF-3), and DOCX-to-PDF conversion for citations on uploaded Word files (§17).

**Decision.** DOCX is generated in the worker from TipTap JSON with the `docx` npm library (converter in `packages/core/drafts/export`). PDF is produced by converting that DOCX with Gotenberg's LibreOffice route, run as a private Railway service from the official `gotenberg/gotenberg:<pinned>` image, so the PDF matches the Word file page for page. Page counts come from the PDF (`pdf-lib`). ZIPs are built with a streaming zip library in the worker.

| Call | Detail |
|---|---|
| Convert | `POST http://gotenberg.railway.internal:3000/forms/libreoffice/convert` (multipart, field `files`), response `application/pdf` (verify route and port for the pinned version) |
| Timeout | 120 s per document |
| Health | `GET /health` |

**Fonts.** The image includes the fonts the export templates use (Liberation and DejaVu at minimum; add others to a derived image if templates need them), so solicitation font rules can be checked (FR-DRF-3).

**Failures.** Conversion fails: the export job fails with "We couldn't make the PDF. The Word file is ready; try the PDF again in a minute." DOCX still succeeds.

**Verify before coding.**
- [ ] Gotenberg's current major version, route names and resource needs.
- [ ] Output opens without warnings in current Word and Acrobat (FR-BID-9 acceptance).

## 19. Email verification (MillionVerifier)

**Source:** [MillionVerifier API](https://developer.millionverifier.com/).

**Decision.** MillionVerifier, because `connections.provider` already includes `millionverifier` and the research report's cost model uses it. ZeroBounce is not built in v1.

**Purpose.** `EmailVerifier`: check an address before the first outreach to it and when its last check is older than 90 days; sets `contacts.emails[].status` and `verifiedAt` (FR-SUB-6 support, deliverability).

**Credentials.** Platform `MILLIONVERIFIER_API_KEY`; a tenant may bring its own (API §5.22, `secrets.kind = 'byok_api_key'`), which then takes precedence and is not metered to Magpie's cost.

**Call.** Confirmed: `GET https://api.millionverifier.com/api/v3/?api=<key>&email=<urlencoded>&timeout=10` (`timeout` 2 to 60 s, default 20). Response fields: `email`, `quality`, `result`, `resultcode`, `subresult`, `free`, `role`, `didyoumean`, `credits`, `executiontime`, `error`. The key is a query parameter, so URLs are never logged (§2.3).

**Mapping.** `result` `ok` gives `valid`; `catch_all` and `unknown` give `risky`; `disposable` and `invalid` give `invalid` (verify the full value list). `invalid` blocks outreach to that address; `risky` shows a warning on the approval preview.

**Limits and retries.** No published rate limit found; at most 5 concurrent requests per process. Retry once on timeout or 5xx; an `error` field (for example insufficient credits) fails without retry and alerts ops (platform key) or tells the admin (own key): "Your MillionVerifier account is out of credits."

**Metering.** `enrichment_lookups` quantity 1, `cost_micros` from `MILLIONVERIFIER_COST_MICROS` (config), provider `millionverifier`.

**Verify before coding.**
- [ ] The full list of `result` values and `resultcode` meanings.
- [ ] The credits endpoint used to test a bring-your-own key.
- [ ] Rate limits for API keys.

## 20. Google Places API (New)

**Sources:** [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search).

**Purpose.** `PlacesLookup`: show live details (name, address, phone, website) of a company that has a `place_id`, and resolve a `place_id` for a company the person confirms. Subcontractor search itself goes through Kontract (§3).

**Storage rule.** Confirmed: place IDs may be stored indefinitely; latitude and longitude may be cached up to 30 consecutive days; other Places content may be stored only as the Maps service terms expressly allow, and copying business names, addresses or reviews is prohibited. Magpie stores only `companies.place_id` (and `field_provenance` source `places` for that field). Every other Places field is fetched at display time and never written to the database, logs or prompts kept in `agent_steps`. When Places content is shown outside a Google map, the UI shows the Google Maps attribution (logo, or the text "Google Maps" where space is short).

**Credentials.** `GOOGLE_PLACES_API_KEY`, restricted to the Places API (New). Railway egress IPs are not fixed, so no IP restriction (verify whether Railway offers static egress).

**Calls.**

| Use | Call |
|---|---|
| Resolve a place id | `POST https://places.googleapis.com/v1/places:searchText` with headers `X-Goog-Api-Key`, `X-Goog-FieldMask: places.id` (the "Text Search Essentials ID Only" SKU), body `{ textQuery: "<company> <city> <state>", pageSize: 5, locationBias: { circle: { center, radius } } }` (radius 0 to 50,000 m) |
| Display details | `GET https://places.googleapis.com/v1/places/<placeId>` with `X-Goog-FieldMask: id,displayName,formattedAddress,nationalPhoneNumber,websiteUri` (verify the SKU these fields bill under) |

A field mask is required; omitting it is an error (confirmed).

**Limits and cost.** Per-SKU pricing and quotas from the Maps pricing page (verify). Details are cached in process for 10 minutes to absorb page reloads. Each call meters `enrichment_lookups` with provider `places` and configured cost.

**Failures.** Details unavailable: the company page shows the fields Magpie stores and "Live details from Google aren't available right now."

**Verify before coding.**
- [ ] SKU and price for the detail field mask.
- [ ] Whether the Maps terms allow showing details in a non-map list with attribution only (the policies page says attribution is needed outside a map; check the service-specific terms).

## 21. LLM providers through the AI SDK

**Sources:** AI SDK UI stream protocol on [ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol); Anthropic [models overview](https://platform.claude.com/docs/en/about-claude/models/overview) and API notes (model table dated 2026-11-03); Anthropic [commercial terms](https://www.anthropic.com/legal/commercial-terms); OpenAI's [data controls guide](https://developers.openai.com/api/docs/guides/your-data); Google's Gemini API billing and terms pages.

**Purpose.** All model calls, through `packages/llm` only (ARCHITECTURE §8). This section covers provider keys, versions and data settings; tiers, failover and budgets are ARCHITECTURE §8 and AGENT_RUNTIME.md.

**Packages.** `ai` 7.x, `@ai-sdk/anthropic` 4.x, `@ai-sdk/openai` 4.x, `@ai-sdk/google` (latest major) on 2026-11-10. Pin exact versions.

**Credentials.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` (the Google key belongs to a Cloud project with billing enabled). Use organization or workspace keys dedicated to Magpie production.

**Default catalog check.** ARCHITECTURE §8's Anthropic ids exist: `claude-sonnet-5-5` ($2 input and $10 output per million tokens), `claude-haiku-5-5` ($0.10 and $0.50 up to 100K-token prompts), `claude-opus-5-5` ($4 and $20), all 1M-token context, per Anthropic's model table of 2026-11-03. OpenAI and Google ids and prices are verify items. Prices go in `packages/llm/models.json` as configuration.

**Provider behaviour the gateway must handle.** From Anthropic's current API notes (verify against the pinned SDK):
- Requests on API version `2026-10-21` reject `temperature`, `top_p` and `top_k` with a 400 on every model, so the gateway never sends sampling parameters to Anthropic.
- `claude-opus-5-5` and `claude-sonnet-5-5` reject forced `tool_choice` (`any` or a named tool) with a 400; use `auto` with strict tool schemas, or structured output.
- Thinking is adaptive and cannot be disabled on `claude-opus-5-5`; control depth with effort (`claude-opus-5-5` defaults to `medium`; set it explicitly per tier).
- A response can stop with `stop_reason: "refusal"`; the gateway treats it as a failed call for that entry and moves to the next catalog entry for the tier, never retrying the same model with the same input.
- PDF input limits: 32 MB per request, 600 pages (100 on 200k-context models).

**No training on customer data.**

| Provider | Setting | Status |
|---|---|---|
| Anthropic | Commercial terms: Anthropic may not train on customer content from paid services. Retention of API inputs and outputs is set by the commercial terms and DPA (sources disagree between 7 and 30 days; some newer models require 30-day retention and are excluded from zero data retention). | Training: confirmed by multiple sources. Retention: verify in the DPA. |
| OpenAI | API data is not used for training unless the organization opts in; keep data sharing off in the organization settings. Abuse monitoring logs are kept up to 30 days. The Responses API stores application state 30 days by default: send `store: false` (AI SDK OpenAI provider option). Zero Data Retention needs OpenAI's approval. | Confirmed in substance; verify the per-endpoint retention table and the AI SDK option name. |
| Google Gemini API | Only paid-tier (billing-enabled) traffic is excluded from product improvement; free-tier traffic may be used and read by reviewers. Never use a free-tier key. | Confirmed from Google's billing docs as summarized; verify the current terms page. |

List all three as subprocessors (SECURITY.md). Tenants can exclude any provider (`tenant_settings.model_policy`).

**Prompt caching.** Anthropic: cache-control breakpoints passed through AI SDK provider options on the static system prompt and tool list. OpenAI: a per-tenant `prompt_cache_key` (AI SDK provider option; verify its name). Static content first, as ARCHITECTURE §8 says.

**Rate limits and failover.** Each provider enforces per-organization limits by tier; `429` and overload errors retry once, then fail over (ARCHITECTURE §8). Raise provider tiers before launch so the morning digest wave fits.

**Test fakes.** The AI SDK's mock language model (`ai/test`, verify the export name in v7) for unit tests; recorded model fixtures for the M4 eval set; never real model calls in the PR gate.

**Verify before coding.**
- [ ] AI SDK 7 API names used by `packages/llm` (`generateText`, `streamText`, `embed`, UI message stream helpers, provider options for cache control, `store`, `prompt_cache_key`).
- [ ] OpenAI and Google model ids and prices for the fallback entries; embedding model `text-embedding-3-small` still offered at 1536 dimensions.
- [ ] Anthropic retention terms in the current DPA.

## 22. Sentry and OpenTelemetry

**Source:** [Sentry with a custom OpenTelemetry setup (Node)](https://docs.sentry.io/platforms/javascript/guides/node/opentelemetry/custom-setup/).

**Purpose.** Errors in Sentry; traces in an OTLP backend; structured logs with pino (ARCHITECTURE §12).

**Setup (api and worker).**
1. Start the OpenTelemetry Node SDK first: resource `service.name` (`magpie-api` or `magpie-worker`), `service.version` (git SHA), `deployment.environment`; OTLP HTTP trace exporter from `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`; instrumentations for HTTP, undici (fetch), `pg` and pino; sampler parent-based with ratio `OTEL_TRACES_SAMPLER_ARG` (default 0.1).
2. Then `Sentry.init` (`@sentry/node` 11.x) with `dsn`, `environment`, `release`, `enableOpenTelemetrySetup: false`, `integrations: [Sentry.openTelemetryIntegration()]`, and no `tracesSampleRate` or `tracesSampler` (confirmed: this disables Sentry tracing, avoids duplicate spans, and still links errors to the active OpenTelemetry trace).
3. Web: `@sentry/react` with its own DSN, errors only.

**Scrubbing.** `beforeSend` and `beforeBreadcrumb` drop request bodies, `authorization` and `cookie` headers, and the query parameters listed in §2.3. Tags on every event and span: `tenant_id`, `user_id`, `request_id`, and when present `run_id`, `workflow_id`.

**Credentials.** `SENTRY_DSN` (per service), `SENTRY_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`. The OTLP backend is chosen in an ADR (any OTLP-compatible service); Sentry can also receive OTLP traces if the team prefers one vendor (`Sentry.getOtlpTracesEndpoint`).

**Verify before coding.**
- [ ] `enableOpenTelemetrySetup` and `openTelemetryIntegration` names in the pinned `@sentry/node`.
- [ ] DBOS's own OpenTelemetry support and how its spans join the same trace.

## 23. Web Push (VAPID)

**Sources:** [web-push library](https://github.com/web-push-libs/web-push), [RFC 8292 (VAPID)](https://www.rfc-editor.org/rfc/rfc8292).

**Purpose.** `WebPushSender` for approvals and alerts in the installed PWA (FR-CH-8).

**Credentials.** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` address). Library: `web-push`.

**Behaviour.** Payloads are small JSON (`{ title, body, url, tag }`), encrypted per subscription, TTL 24 hours, urgency `high` for approvals. A `404` or `410` from the push service means the subscription is gone: delete the `channel_bindings` row. Safari on iOS and iPadOS 16.4 or later delivers push only to a PWA installed to the home screen (PRD FR-CH-8).

**Verify before coding.**
- [ ] Current browser support notes for Safari on macOS and iOS.

## 24. Later releases

### 24.1 Slack (v1.5)

- **Purpose.** The same loop in Slack for Segment B: approvals with buttons, the digest, chat with the Assistant.
- **Shape.** One distributed Slack app with OAuth v2 per workspace (`connections.provider = 'slack'`, `purpose = 'chat'`), Events API and interactivity requests verified with Slack's signing secret (`X-Slack-Signature`, `X-Slack-Request-Timestamp`), Block Kit approval cards.
- **Facts to carry forward** (from the research report, verify at the time): Marketplace review takes up to 10 weeks and needs about 10 active installs first; since 2025 non-Marketplace apps get very low rate limits on conversation history reads ([Slack review guide](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide), [rate limit change](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps)).

### 24.2 HubSpot (v1.5)

- **Purpose.** Two-way sync of companies, contacts and deals for Segment B.
- **Shape.** Public app with OAuth 2.0 (`connections.provider = 'hubspot'`, `purpose = 'crm_sync'`), webhooks for changes, CRM v3 objects API, mapping and conflict rules (most recent change wins per field, with `record_history`).
- **Verify at the time.** Scopes, per-app rate limits, Marketplace listing requirements ([HubSpot developer docs](https://developers.hubspot.com/docs)).

### 24.3 Salesforce (v1.5)

- **Purpose.** As HubSpot.
- **Facts to carry forward.** Since Spring '26, new Connected Apps cannot be created by default; new integrations use External Client Apps, which require PKCE and refresh token rotation (from integration vendors' notices; verify in Salesforce's "Connected App to External Client App Migration" guide). AppExchange listing needs a security review.
- **Shape.** External Client App, OAuth web server flow with PKCE (`connections.provider = 'salesforce'`), Change Data Capture or polling with `SystemModstamp`, REST and Bulk API 2.0.

### 24.4 Gmail and Outlook reading (v2)

- **Purpose.** Capture email into the timeline (PRD v2).
- **Gmail.** Needs a restricted scope (`gmail.readonly` or `gmail.metadata`), so restricted scope verification and a CASA assessment by a Google-approved assessor, reassessed at least every 12 months (confirmed, §10). Start the assessment once paying customers exceed 50 (PRD §12). Sync design: Gmail push notifications through Pub/Sub with a watch renewed daily, catch-up with `history.list`, a periodic fallback poll ([Gmail push](https://developers.google.com/workspace/gmail/api/guides/push)); `/webhooks/google` receives the Pub/Sub pushes.
- **Outlook.** Graph `Mail.Read` (delegated) with change notification subscriptions renewed before expiry; `/webhooks/microsoft` receives them; publisher verification already done (§11).
- **Data rules.** Store only messages that involve known contacts or that the person chooses, with the same RLS, retention and deletion rules as every other activity.

## 25. Environment variables added by this spec

All validated in `packages/shared/src/env.ts`; SECURITY.md §5 must list them.

| Variable | Integration |
|---|---|
| `KONTRACT_URL`, `KONTRACT_SERVICE_KEY` | §3 |
| `SAM_GOV_API_KEY` | §4, §5 |
| `POSTMARK_TRANSACTIONAL_TOKEN`, `POSTMARK_OUTREACH_TOKEN`, `POSTMARK_INBOUND_BASIC_USER`, `POSTMARK_INBOUND_BASIC_PASSWORD`, `POSTMARK_EVENTS_BASIC_USER`, `POSTMARK_EVENTS_BASIC_PASSWORD`, `POSTMARK_WEBHOOK_IPS` (optional), `EMAIL_FROM_DOMAIN`, `OUTREACH_FROM_DOMAIN`, `INBOUND_EMAIL_DOMAIN` | §9 |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | §10 (and Better Auth sign-in) |
| `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET` | §11 (and Better Auth sign-in) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_WEBHOOK_BASE_URL` | §12 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME` | §13 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION` | §14 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | §15 |
| `CLAMD_HOST`, `CLAMD_PORT`, `CLAMAV_DISABLED` (non-production only) | §16 |
| `GOTENBERG_URL` | §18 |
| `MILLIONVERIFIER_API_KEY`, `MILLIONVERIFIER_COST_MICROS` | §19 |
| `GOOGLE_PLACES_API_KEY` | §20 |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | §21 |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER_ARG` | §22 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | §23 |
| `LINK_SIGNING_KEY` (HMAC for `/unsubscribe` and `/files/shared` tokens), `MCP_ALLOWED_ORIGINS` | API §7, §13 |

## 26. Schema additions requested

DATA_MODEL.md and ARCHITECTURE.md are not edited by this spec. These additions are needed by the integrations above, in addition to API.md §15.

**Columns**

1. `market_opportunities.documents_fingerprint text` and `market_opportunities.documents_checked_at timestamptz`: Kontract's `details.fingerprint` and when it was read, for amendment detection (§3, FR-DIS-7) and to know whether `market_opportunity_texts` is current.
2. `channel_bindings.disabled_reason` (also API.md §15 item 1): values `user`, `stop`, `blocked`, `undeliverable` are set by Twilio (§12) and Telegram (§13) handling.

**Vocabularies for existing text columns** (zod enums in `packages/shared`; add check constraints if DATA_MODEL prefers)

3. `market_opportunities.notice_type`: `solicitation`, `combined_synopsis_solicitation`, `presolicitation`, `sources_sought`, `special_notice`, `award`, `justification`, `intent_to_bundle`, `other`. Mapped from SAM `ptype` and type names (§4) and Kontract's `Opportunity.type`.
4. `market_opportunities.set_aside` mapping from SAM codes to DATA_MODEL's normalized values: `SBA`, `SBP` to `small`; `8A`, `8AN` to `8a`; `HZC`, `HZS` to `hubzone`; `SDVOSBC`, `SDVOSBS` to `sdvosb`; `WOSB`, `WOSBSS` to `wosb`; `EDWOSB`, `EDWOSBSS` to `edwosb`; null or empty to `none`; every other code (`LAS`, `IEE`, `ISBEE`, `BICiv`, `VSA`, `VSS`) to `other`.
5. `subscriptions.status`: Stripe's `incomplete_expired` is stored as `canceled` (DATA_MODEL's list lacks it), or add `incomplete_expired` to the check constraint.

**Infrastructure and schedules (ARCHITECTURE changes, not tables)**

6. Two private Railway services from vendor images: `clamav` (§16) and `gotenberg` (§18). Local `infra/docker-compose.yml` adds both.
7. Platform schedules: `award-sweep` (daily, §4), `sam-status-refresh` (daily, §5), `kontract-usage-reconcile` (monthly, §3), `telegram-webhook-check` (at worker start, §13).
