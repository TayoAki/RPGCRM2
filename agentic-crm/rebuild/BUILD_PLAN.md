# Magpie: build plan

The order to build Magpie in, from an empty repository to general availability. Each milestone lists what it covers, the tasks in order, the tests it must add, the checks to run before coding against outside services, and how to tell it's done. Work through the milestones in order. Within a milestone, tasks can run in parallel unless one names another.

The requirement ids (FR-…) come from [PRD.md](PRD.md). Tables come from [DATA_MODEL.md](DATA_MODEL.md).

## 0. Before you start

### 0.1 Founder actions with lead time (start in week 1)

| Action | Why | Lead time |
|---|---|---|
| Register the Magpie brand and an "account notifications" campaign on Twilio 10DLC; buy a number | SMS digest and approvals (M5) | 1 to 3 weeks |
| Create the Telegram bot with BotFather; set name, picture and `/start` description | Telegram channel (M5) | 1 day |
| Postmark: a transactional server, an inbound server, DNS for the sending domain (SPF, DKIM, return path) and the inbound domain MX | Email (M0, M4) | 1 to 3 days |
| Google Cloud OAuth client: sign-in scopes, plus `gmail.send` with app verification | Google login (M0), sending from Gmail (M4) | days to weeks for verification |
| Microsoft Entra app registration; publisher verification | Microsoft login (M0), sending from Outlook (M4) | days |
| Stripe account in test and live mode; Stripe Tax on; products created from BILLING.md | Billing (M6) | 1 day |
| Kontract service key for staging and production | Market data (M2) | 1 day |
| Neon project, Railway project, Cloudflare R2 bucket, Sentry project | Hosting (M0) | 1 day |
| Anthropic and OpenAI API keys with no-training terms | Bots (M3) | 1 day |
| Pick 10 public solicitations from Magpie's trades and review the golden labels the agent drafts | Bid Reader evals (M4) | 2 hours of review |

### 0.2 Local setup the agent creates in M0

```
pnpm install
pnpm infra:up         # docker compose: postgres+pgvector, mailpit, minio
pnpm db:migrate       # runs as magpie_owner
pnpm db:seed          # plans, demo tenant, demo data
pnpm dev              # api :3001, worker, web :5173
pnpm test             # unit + integration (real Postgres)
pnpm test:isolation   # tenant isolation suites
pnpm test:e2e         # Playwright against a running stack
pnpm eval             # Bot evals (M3 onward); needs model keys or recorded responses
```

### 0.3 Definition of done for every pull request

- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:isolation` pass.
- New tenant tables have RLS, the policy, the `tenant_id` index and an entry in the isolation fixtures.
- New routes have zod schemas, appear in the OpenAPI output and have at least one integration test, including a 404 for another tenant's id.
- New model calls go through `packages/llm`. New tools are in the tool catalog with an effect and a default policy.
- User-facing strings follow PRD §9 and live in the message catalog.
- The PR description lists the FR ids it covers.
- No secrets in code, logs or fixtures. No AI attribution in commits.

## M0. Foundations (1 to 2 weeks)

**Covers:** ARCHITECTURE §3 to §5, §7.1, §9, §10 and §12; FR-ACC-1, FR-ACC-3 and FR-ACC-6.

Tasks:
1. Scaffold the monorepo from ARCHITECTURE §4: pnpm workspaces, Turborepo, TypeScript strict, ESLint with the import rules (no raw pool outside `packages/db`, no provider SDKs outside `packages/llm` and `packages/integrations`, no `apps/*` imports from packages), Prettier, Vitest, Playwright, and GitHub Actions running lint, typecheck, test, isolation and build.
2. `infra/docker-compose.yml`: `pgvector/pgvector:pg17`, Mailpit, MinIO.
3. `packages/shared/src/env.ts`: a zod-validated environment for api, worker and web, using the variable list in SECURITY.md §5.
4. `packages/db`: the roles, functions and extensions from DATA_MODEL §2; the `tenantTable()` migration helper; the pools (`app`, `ops`, `auth`); `withTenant()`; the identity and platform tables (§3, §4); the resolver functions (§2.2). Write the isolation harness and the "every tenant table has RLS" test now.
5. Better Auth in `apps/api`: email and password, magic link through Postmark (Mailpit locally), Google and Microsoft login, the organization plugin mapped to `tenants`, `memberships` and `invitations`, and the admin plugin for later impersonation. Sign-up calls `tenants.createTenant()` (DATA_MODEL §17; seed the parts whose tables exist, then extend the seeding in later milestones).
6. `apps/api` skeleton: Hono with request id, logging, auth, active workspace and membership middleware, problem+json errors, a rate limiter, `/health`, `/ready`, and the OpenAPI document at `/api/app/openapi.json`.
7. `apps/worker` skeleton: DBOS runtime, one example workflow, one queue and one schedule. In `apps/api`, the DBOS client enqueues it.
8. **Verify DBOS before going further** and write `docs/decisions/0001-dbos.md` covering:
   - enqueue from a client process;
   - `send` and `recv` with a timeout across processes;
   - scheduled workflows;
   - queue concurrency and per-tenant partitioning;
   - workflow id dedupe;
   - recovery after killing the worker mid-workflow.

   If partitioning is missing, build the fair dispatcher from ARCHITECTURE §7.2.
9. `domain_events`, publishing after commit with `NOTIFY`, and the SSE endpoint `/api/app/events` with `Last-Event-ID` replay.
10. `audit_log` writer and `feature_flags` reader.
11. `apps/web`: Vite, TanStack Router and Query, Tailwind v4 and shadcn/ui tokens from UX.md, the sign-in and sign-up pages, the app shell (rail, workspace switcher, empty Today), and the SSE client that invalidates queries.
12. Sentry, pino and OpenTelemetry wiring in all three apps.
13. Dockerfile with `api` and `worker` targets; Railway services; Neon staging branch; a migration release step. Deploy to staging.

Tests: the isolation harness on all identity and platform tables; auth flows (sign up, sign in, magic link, sign out everywhere); workspace switch; an SSE replay test; a DBOS recovery test (kill and resume).

**Done when:** a new person signs up on staging, lands in an empty app shell for their own workspace, can create a second workspace and switch to it, and CI is green including the isolation suites.

**Demo:** sign up as two people in two workspaces; show that neither sees the other's workspace in the switcher or the API (404).

## M1. CRM core (2 to 3 weeks)

**Covers:** FR-ACC-2, FR-ACC-4, FR-CRM-1 to FR-CRM-10, FR-SET-1 (basic), files.

Tasks:
1. Tables: DATA_MODEL §6 and §7, plus `tenant_settings`.
2. **The records layer** in `packages/core/crm/records.ts`. Every read and write of companies, contacts, deals, tasks and notes goes through it. It applies role permissions (SECURITY.md role matrix), writes `record_history`, `activities`, `domain_events` and `audit_log`, and validates custom fields against `field_definitions`.
3. Invitations and role changes (FR-ACC-2, FR-ACC-4).
4. Pipelines and stages with defaults; deals kanban and table.
5. Companies, contacts, deals, tasks, notes and tags: routes, screens and record pages with the timeline.
6. Custom fields (14 types) with the settings screen. AI fill settings are stored but do nothing until M3.
7. Saved views: table, kanban and calendar.
8. Global search with tsvector and trigram.
9. Files: presigned upload to R2 (MinIO locally), the malware scan step (INTEGRATIONS.md), download through short-lived presigned URLs, file links.
10. CSV import with mapping, dedupe and per-row errors, run as a DBOS workflow on the `sync` queue. CSV export of any view.
11. Merge duplicates for contacts and companies.
12. Basic workspace settings (name, logo, timezone).

Tests:
- The role matrix: one test per action per role.
- Isolation fixtures for every new table.
- Import of 10,000 rows in under 2 minutes in CI with a generated file.
- Merge moving every kind of link.
- Search latency on 50,000 seeded records under the PRD targets (run nightly).

**Done when:** a team of three with different roles can run their whole pipeline in Magpie without Bots.

**Demo:**
1. Import a CSV of 500 contacts and 200 companies.
2. Build a "Due this month" view.
3. Drag a deal through stages.
4. Show its history and timeline.
5. Show a viewer unable to edit.

## M2. Company profile, market data and matching (2 weeks)

**Covers:** FR-PRO-1 to FR-PRO-6, FR-DIS-1 to FR-DIS-5.

Tasks:
1. Tables: DATA_MODEL §5 and §8.
2. `OpportunitySource` port in `packages/core/market` with these operations:
   - `search`
   - `get`
   - `listDocuments`
   - `readText`
   - `lookupEntity` (by UEI or name)
   - `findComparables`
   - `findSubcontractors`
   - `health`
3. Build the Kontract adapter (INTEGRATIONS.md) first and a SAM.gov fallback adapter for `search`, `get` and `lookupEntity`. **Verify** Kontract `/api/v1` responses against recorded fixtures before writing the mappers.
4. Market cache: write-through upsert of `market_opportunities` from search and detail calls. A nightly job marks notices past their due date inactive.
5. Onboarding wizard (UX.md) with the UEI lookup prefill and `field_provenance` source `sam`.
6. Profile, past performance and library screens, with expiry warnings.
7. Market search screen with filters; notice detail screen.
8. Saved searches; suggestions built from the profile after onboarding.
9. **Scoring in code, not by a model:** a pure function `scoreMatch(profile, opportunity, history)` that returns a score from 0 to 100 and its reasons (PRD FR-DIS-3), with unit tests for each factor, eligibility zeroing and the dismissal penalty.
10. Scan job: the global schedule fans out to due searches, calls `search` with paging, upserts the cache, scores the results and inserts `opportunity_matches`. Idempotent per search per hour.
11. Matches screen with pursue, save and dismiss. Pursue creates the bid deal at Found and links `opportunity_id`.

Tests:
- Kontract adapter contract tests against fixtures.
- Scoring tables.
- Scan idempotency (run twice, matches don't duplicate).
- Pursuing twice creates one deal.
- Onboarding end to end.

**Done when:** a new workspace with a real UEI gets scored matches from live Kontract data within 2 minutes of finishing onboarding and can pursue one.

**Demo:** sign up as a janitorial company in Virginia using its UEI, accept the suggested searches, show the top matches with their reasons, dismiss one, pursue one.

## M3. LLM gateway, agent runtime, approvals and chat (2 to 3 weeks)

**Covers:** FR-BOT-1 to FR-BOT-5 and FR-BOT-7 to FR-BOT-9, FR-APR-1 to FR-APR-5 (web), FR-CH-6 and FR-CH-7 (web), FR-CRM-4 AI fill. Metering basics.

Tasks:
1. Tables: DATA_MODEL §11, plus `usage_events` and `usage_counters` from §14.
2. `packages/llm`:
   - the catalog (`models.json`), tiers and tenant model policy;
   - `generate`, `stream` and `embed`;
   - failover;
   - metering to `usage_events` and `agent_steps`;
   - budget checks;
   - prompt-cache ordering.

   **Verify** the AI SDK version's tool calling, streaming and usage fields (including cached tokens) per provider before writing the wrapper.
3. `packages/agent`:
   - the tool registry with zod args, effect, default policy and permission check;
   - context assembly (AGENT_RUNTIME.md);
   - the citations validator;
   - prompt files.
4. `agentRunWorkflow` as specified in AGENT_RUNTIME.md, with approval waits through `recv` and `send`, expiry, edited args, learning mode, step and cost caps, and cancellation.
5. Approvals: creation, previews (email, sms, record_change, stage_change, document), short codes, the inbox screen, the approval card, decide routes and the resume path.
6. Tool policies screen per Bot; trust counters; the earned-autonomy suggestion.
7. Seed the Bot team (DATA_MODEL §17) and the Assistant's CRM tools: search, read, create, update, note, task and move stage.
8. Chat: threads and messages, the web chat panel with streaming, and "Ask a Bot" from a record.
9. Runs log and run detail screens; cost per Bot.
10. Memory: propose, confirm, recall and delete; the memory screen.
11. AI fill for custom fields: suggest mode creates `field_suggestions`; auto mode writes the value and its provenance.

Tests:
- Unit tests with the AI SDK mock model for the loop and every tool's permission check.
- An approval round trip: the workflow waits, a decision from another process resumes it, expiry continues without the action.
- Learning mode executes no effect.
- A tool loop hits the step cap.
- Excluded providers are never called.
- Metering totals equal the sum of steps.
- First eval set: Assistant CRM questions with expected tool calls.

**Done when:** in the web app, a person asks the Assistant to "add a task to call the contracting officer on the Hampton bid tomorrow". The Assistant finds the bid, proposes the task, and the person approves it in the inbox. The task exists, the run log shows cost and steps, and the approval is audited.

**Demo:** the above, plus an edit-then-approve, a skip, an expiry, and turning on "without asking" after the suggestion appears.

## M4. Bid workspace Bots (3 to 4 weeks)

**Covers:** FR-BID-1 to FR-BID-9, FR-PRC-1 to FR-PRC-5, FR-SUB-1 to FR-SUB-6, FR-DRF-1 to FR-DRF-4, FR-DIS-7, FR-SET-2 (sending connections).

Tasks:
1. Tables: DATA_MODEL §9 and §10.
2. **Documents pipeline** on the `docs` queue:
   - fetch the notice's documents;
   - public text through Kontract `text` into `market_opportunity_texts`, read once for all tenants;
   - uploads through scan and extraction (PDF, DOCX, XLSX, OCR fallback) into `bid_document_chunks`;
   - chunk with page ranges, embed, and expose the page viewer with highlight.
3. **Bid Reader**: brief, requirements, deadlines, AI-use clause and bid decision tools. Every output passes the citations validator.
4. **Golden eval set**: 10 public solicitations across janitorial, landscaping, HVAC, roofing and moving, including at least 2 with AI-use clauses.
   - The agent drafts the expected labels: mandatory requirements, deadlines with times and AI clauses.
   - The founder reviews and corrects them before they become the bar.
   - CI thresholds: mandatory requirement recall of 90% or more, citation validity 100%, deadline accuracy 100%, AI clause detection 100%.
5. **Estimator**:
   - wage determination lookup with citation;
   - comparables through `findComparables`;
   - price sheet drafting with totals computed in code;
   - versions and approval;
   - out-of-range and margin warnings;
   - the limitations-on-subcontracting check.
6. **Sub Finder and quotes**:
   - sub suggestions from the CRM first, then market data;
   - quote request drafts with tracked reply addresses (`reply_token`);
   - sending through the connected Gmail or Outlook, or Postmark, after approval;
   - Postmark inbound routing to `quote_requests` and `messages`;
   - quote parsing with confirmation;
   - follow-ups through the `quote_followups` job;
   - comparison;
   - unsubscribe links and `suppressions`.
7. Gmail (`gmail.send`) and Outlook (`Mail.Send`) connections with encrypted tokens in `secrets` (the envelope encryption from SECURITY.md).
8. **Proposal Writer**:
   - section drafts mapped to requirements, with gaps shown;
   - TipTap editor with autosave, versions and compare;
   - page-limit warnings;
   - AI disclosure records;
   - the no-AI mode when banned.
9. Submission record; package export (DOCX, PDF, ZIP).
10. Deadlines: the ICS feed per user and `deadline_watch` reminders (in-app and email now; SMS and Telegram in M5).
11. Award watch and amendments (FR-DIS-7).

Tests:
- The golden evals in CI (recorded model responses for pull requests, live models nightly).
- Tracked reply routing, including unknown tokens and spam.
- Suppression blocks a send.
- Price totals are always computed in code (a property test).
- AI-banned bids block drafting tools.
- Export files open (validate DOCX with a parser and PDF with pdf-lib).

**Done when:** the demo below runs on staging against a real public solicitation with a teammate's email standing in as the subcontractor.

**Demo:**
1. Pursue a janitorial notice.
2. Within 15 minutes, show the bid brief with clickable citations, the compliance matrix and the deadlines.
3. Show the wage-based price sheet with comparables.
4. Approve a quote request and reply to it from the "sub" mailbox; the parsed quote appears and is confirmed into the price sheet.
5. Show the proposal draft with its requirement coverage.
6. Export the package and mark it submitted.

## M5. Channels and the digest (1 to 2 weeks)

**Covers:** FR-CH-1 to FR-CH-5, FR-CH-8; approvals by text.

Tasks:
1. Tables: DATA_MODEL §12.
2. SMS: verify the number with a code, store the binding, STOP and HELP, inbound webhook, status callbacks. Use the Twilio test credentials in staging.
3. Telegram: link code and deep link, webhook with secret token, private chats only, `/stop` and `/help`, inline approval buttons. Port the proven parts of the current product's `delivery/telegram.ts`.
4. **Reply grammar** parser as a pure function with a fixture table covering every case in PRD FR-CH-4, plus resolving short codes across a person's workspaces.
5. Notifications relay: outbox processing, channel choice per user, quiet hours through `send_after`, dedupe, retries.
6. `daily_digest` job and templates (UX.md character budgets); email digest fallback.
7. Deadline reminders and approval notifications over SMS and Telegram.
8. Web push (PWA service worker, VAPID keys) and the in-app notifications list.
9. Chat over Telegram and SMS: non-command text goes to the Assistant thread for that channel.

Tests:
- The grammar fixture table.
- Webhook signature checks (valid and invalid).
- Dedupe of repeated webhooks.
- Quiet hours.
- An approval decided by SMS resumes the run.
- A digest is sent at the right local hour across 3 timezones (fake clock).

**Done when:** the owner gets the morning digest by text at 7:00 local time, replies `1` to pursue a match and `A2` to approve a quote request, and both happen.

**Demo:** the above on a real phone, plus `?`, `E A2` (edit link) and STOP and START.

## M6. Billing and limits (1 to 2 weeks). MVP complete.

**Covers:** FR-BIL-1 to FR-BIL-7.

Tasks:
1. Tables: the rest of DATA_MODEL §14. Seed `plans` from BILLING.md.
2. Stripe Checkout and Customer Portal sessions; webhooks into `billing_events`, then `subscriptions` and `entitlements`.
3. Limit enforcement: reserve and settle around runs, document pages and SMS (BILLING.md). Apply the 80%, 100% and 120% rules with alerts, and pause scheduled jobs at 120%.
4. Run packs as one-off Checkout payments.
5. The subscription state machine with timers: trial reminders, past due, paused Bots, read-only, data retention.
6. Usage page and billing settings.

Tests:
- Stripe webhook fixtures for each handled event, replayed twice to prove idempotency.
- State machine transitions with a fake clock.
- The limit thresholds.
- Reserve and settle under concurrent runs (no overshoot beyond one run).

**Done when:** a trial workspace converts to Bid Desk in Stripe test mode, hits 120% of runs in a simulation, has scheduled jobs paused, buys a run pack and resumes.

**MVP launch checklist** (before inviting pilot customers):
- Isolation suites green.
- Evals at threshold.
- Backups and point-in-time restore tested once.
- Sentry alerts routed.
- 10DLC campaign approved.
- Postmark DNS verified.
- Google `gmail.send` verification approved, or Postmark sending used until it is.
- Terms, privacy policy, DPA and subprocessor page live.
- Stripe in live mode.
- Model provider keys on paid tiers with no-training terms.

## M7. Operator console, managed review, export and deletion (1 to 2 weeks)

**Covers:** FR-OPS-1 to FR-OPS-6, FR-ACC-5.

Tasks:
1. `/ops` area for staff only, on the `magpie_ops` pool. Every query audited.
2. Tenants list and detail: plan, status, MRR, usage, cost and margin.
3. Impersonation with reason, banner, 60-minute limit and external actions blocked.
4. Suspend and unsuspend, trial extension, credits, entitlement overrides.
5. Feature flags screen.
6. Managed review queue: `review_stage='staff'` routing, reviewer assignment, edit, approve and send on to the owner, send back with notes, and review time metrics.
7. Cost dashboard from `usage_events`.
8. Data export (ZIP of CSV, JSON and files) and workspace deletion (scheduled 30 days out, cancelable, then a hard delete of rows and R2 prefix).

Tests: staff-only access; impersonation audit and blocked externals; deletion removes every row in every tenant table (checked through the ops pool) and every object under the R2 prefix.

**Done when:** support can safely help a customer, and a Managed plan customer's outside messages pass through a reviewer first.

## M8. Public API, MCP and webhooks (1 to 2 weeks)

**Covers:** FR-API-1 to FR-API-3, FR-SET-3 and FR-SET-4.

Tasks:
1. API keys: create, list, revoke, scopes, the per-key rate limit; the key acts as its owner under their role.
2. `/api/v1` resources from API.md, published OpenAPI document and docs page.
3. MCP server at `/mcp` with OAuth; tools from API.md; writes follow approval rules.
4. Outgoing webhooks: endpoints, HMAC signatures, retries, the delivery log and resend.
5. Audit log viewer.

Tests: contract tests against the OpenAPI document; key revocation is immediate; MCP tool calls respect roles and approvals; webhook signature verification sample code works.

## M9. Automations and reports (2 weeks)

**Covers:** FR-AUT-1, FR-REP-1.

Tasks:
1. Automations from DATA_MODEL §16: the triggers and steps listed in the PRD, consuming `domain_events`. Runs are durable workflows with retries. Built as a form.
2. Reports: widgets over records and matches, and the fixed bid metrics.

Tests: each trigger and step; no infinite loops (an automation can't trigger itself more than 3 levels deep); widget queries respect roles.

## M10. Hardening and general availability (1 to 2 weeks)

Tasks:
1. Security review against SECURITY.md: headers, CSP, CSRF, SSRF tests, upload fuzzing, dependency audit, secret scanning.
2. Move the master key to a cloud KMS and rotate it.
3. Load test with k6 against the ARCHITECTURE §13 targets at 2,000 simulated tenants.
4. Restore drill from point-in-time restore into a Neon branch; record the time.
5. Accessibility audit (axe in Playwright plus a manual keyboard pass).
6. SOC 2 readiness: connect a compliance platform, write policies, turn on access reviews.
7. Migration tool for existing Magpie customers: read their old workspace through its `/api/v1` with an API key, map companies, contacts, deals, tasks and notes into a new workspace, and produce a report.
8. Public docs: getting started, the reply grammar, the API.

**Done when:** all targets are met or have ADRs explaining the gap, and the founder signs off on general availability.

## Timeline at a glance

| Milestone | Weeks (one agent, full time, estimate) | Cumulative |
|---|---|---|
| M0 Foundations | 1 to 2 | 2 |
| M1 CRM core | 2 to 3 | 5 |
| M2 Profile and matching | 2 | 7 |
| M3 Runtime, approvals and chat | 2 to 3 | 10 |
| M4 Bid Bots | 3 to 4 | 14 |
| M5 Channels and digest | 1 to 2 | 16 |
| M6 Billing (MVP) | 1 to 2 | 18 |
| M7 Ops and managed review | 1 to 2 | 20 |
| M8 API, MCP and webhooks | 1 to 2 | 22 |
| M9 Automations and reports | 2 | 24 |
| M10 Hardening (GA) | 1 to 2 | 26 |

These are estimates, not commitments. Parallel agents can overlap M1 with M2's adapter work, and M5 with M4's evals.
