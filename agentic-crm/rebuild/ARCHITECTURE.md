# Magpie: system architecture

This is the technical spine for rebuilding Magpie as a multi-tenant SaaS from scratch. Read [PRD.md](PRD.md) first for what the product does. Read [DATA_MODEL.md](DATA_MODEL.md) next for every table. Every other spec uses the names defined in these three files. If two docs disagree, this file (including the rulings in §15) and DATA_MODEL.md (including §18) win.

## 1. Goals and constraints

| Goal | What it means for the design |
|---|---|
| One system for every customer | Pooled multi-tenancy: one app, one database, every tenant row keyed by `tenant_id` and enforced by Postgres row-level security (RLS). No per-customer deployments. |
| Cheap per tenant | Hosting for an idle tenant should be cents. AI runs are the main cost, so every model call is metered per tenant, Bot and feature. |
| Bots that work for days | Agent runs, approvals and scheduled jobs are durable. A run can wait days for an approval, survive deploys and resume exactly once. |
| Fair under load | One tenant's 500 queued runs must not delay another tenant's morning digest. Background work is queued with per-tenant concurrency. |
| Text-first | Every Bot output that needs a person is an approval card that renders on the web, in SMS and in Telegram from the same data. |
| Safe by default | Anything that leaves the workspace (email, SMS, a submission) needs a person's approval. Every extracted fact cites its source. |
| Small team, AI-built | Mainstream TypeScript stack, few moving parts, no service that a single process plus Postgres can do. |

Non-goals for v1: data residency outside the US, a dedicated-database tier (designed for, built later), native mobile apps (PWA plus SMS and Telegram cover phones), on-premises installs.

## 2. System overview

```
                 Browser (React PWA)            Phone (SMS, Telegram)
                        |                                 |
                        | HTTPS, cookies, SSE              | Twilio / Telegram webhooks
                        v                                 v
+-------------------------------------------------------------------------------+
|  api  (Node 22, Hono)                                                         |
|  /api/app/*   web app API (session auth)                                      |
|  /api/v1/*    public API (API keys)          /mcp   MCP server (OAuth)        |
|  /webhooks/*  stripe, twilio, telegram, postmark-inbound, google, microsoft  |
|  /api/app/events  SSE stream per user                                         |
|  enqueues work through the DBOS client; never runs long jobs inline           |
+-------------------------------+-----------------------------------------------+
                                |  Postgres (Neon): app data + DBOS system schema
+-------------------------------v-----------------------------------------------+
|  worker  (Node 22, DBOS runtime)                                              |
|  workflows: agent runs, approval waits, bid reading, quote chasing, digests   |
|  queues: per-tenant fair queues   schedules: cron fan-out per tenant          |
|  outbox relays: notifications, webhooks, Stripe usage, domain events          |
+---+-----------+-----------+-----------+-----------+-----------+---------------+
    |           |           |           |           |           |
 LLM providers  Kontract    Stripe     Twilio     Telegram    Postmark   R2 (files)
 (Anthropic,    (market     (billing)  (SMS)      (bot API)   (email out
  OpenAI,        data, bid                                     and inbound)
  Google)        text)
```

Two deployable processes share one codebase: `api` and `worker`. Both are stateless and scale horizontally. Postgres is the only stateful service besides object storage.

## 3. Stack decisions

Each choice is final for v1 unless a milestone's verification step proves it unworkable. In that case use the stated fallback and record why in `docs/decisions/`.

| Concern | Choice | Why | Fallback |
|---|---|---|---|
| Language | TypeScript 5, `strict: true`, ESM | One language end to end; AI coding agents are strongest here | none |
| Runtime | Node.js 22 LTS | Widest library support (DBOS, pg, OpenTelemetry, Stripe) | none |
| Package manager | pnpm workspaces + Turborepo | Fast installs, task caching | none |
| HTTP framework | Hono with `@hono/node-server` and `@hono/zod-openapi` | Small, typed, generates OpenAPI from zod | Fastify |
| Validation | zod (v4 if available, else v3) | One schema for API, forms, LLM tool args | none |
| Database | PostgreSQL 17 on Neon (prod), Docker `pgvector/pgvector:pg17` locally | Managed, branching for previews, point-in-time restore | Railway Postgres or RDS |
| Extensions | `pgvector`, `pg_trgm`, `citext`, `pgcrypto` | Embeddings, fuzzy search, case-insensitive email, hashing | none |
| ORM and migrations | Drizzle ORM + drizzle-kit; RLS and functions in hand-written SQL migrations | Typed queries, plain SQL when needed | Kysely |
| Auth | Better Auth with the organization, magic link, admin and (later) SSO and SCIM plugins | Self-hosted, organizations map to tenants, the current product already uses it | Lucia-style own sessions |
| Durable work | DBOS Transact for TypeScript (`@dbos-inc/dbos-sdk`) | Workflows, steps, queues, cron and durable waits stored in the same Postgres; no extra service | Trigger.dev v4 with `concurrencyKey` and waitpoint tokens |
| LLM access | Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) behind our own `llm` package | Provider-neutral tool calling and streaming; our wrapper adds policy, metering and failover | direct provider SDKs |
| Web app | React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui (Radix), react-hook-form, TipTap for rich text | Mainstream, well documented, matches the current product | none |
| Realtime | Server-Sent Events from `api`, fed by Postgres `LISTEN/NOTIFY` on `domain_events` | No extra broker | Redis pub/sub |
| Files | Cloudflare R2 (S3 API) with presigned URLs, key prefix `t/<tenant_id>/` | Cheap egress, S3-compatible | AWS S3 |
| Transactional and inbound email | Postmark (outbound transactional stream, inbound webhook) | Deliverability, simple inbound parsing | Resend + Cloudflare Email Routing |
| SMS | Twilio Programmable Messaging, one Magpie 10DLC brand and campaign for account notifications to our own users | We only text our own users, never their customers | Telnyx |
| Telegram | Bot API with webhook, one platform bot, deep-link account linking | Proven in the current product | none |
| Billing | Stripe Billing (Checkout, Customer Portal, Meters, Stripe Tax) | Subscriptions plus usage in one place | none |
| Market data | Kontract engine `/api/v1` (TayoAki/Kontract), behind an `OpportunitySource` port | Already indexes SAM.gov and state/local bids, reads bid text, prices past awards, finds subs | direct SAM.gov and USAspending adapters |
| Errors | Sentry (api, worker, web) | Standard | none |
| Logs and traces | pino JSON logs, OpenTelemetry traces exported via OTLP | Vendor-neutral | none |
| Hosting | Railway: `api` and `worker` services from Dockerfiles; Neon for Postgres; R2 for files | The team already runs Railway; one project, not one per customer | Fly.io or Render |
| Tests | Vitest (unit, integration against real Postgres), Playwright (e2e), MSW for HTTP fakes | Fast, standard | none |
| Malware scanning | ClamAV (`clamd`) as a private service from its vendor image | Uploads and inbound attachments are scanned before reading | a hosted scanning API |
| DOCX to PDF | Gotenberg as a private service from its vendor image | Bid package export | LibreOffice in the worker image |
| Web libraries | Lingui v5 (i18n), React Email (templates), openapi-fetch and openapi-typescript (typed client), vite-plugin-pwa, pdfjs-dist, dnd-kit, idb-keyval, Sonner, TanStack Table and Virtual, Recharts via shadcn Chart, react-qr-code, lucide-react | Named so the agent does not pick alternatives | none |

**Library APIs move.** Before using any third-party API in this table, check its current docs and pin the version in the lockfile. Do not write code from memory for DBOS, Better Auth, AI SDK, Stripe, Twilio, Telegram, Postmark or Kontract.

## 4. Repository layout

```
magpie/
  apps/
    api/                 Hono server: routes, auth, webhooks, SSE, MCP
    worker/              DBOS runtime: workflows, queues, schedules, relays
    web/                 React PWA
  packages/
    db/                  Drizzle schema, migrations (SQL + generated), seed, withTenant()
    core/                domain services (pure TS, no HTTP): crm, market, bids, pricing,
                         quotes, drafts, bots, approvals, channels, billing, usage, audit
    agent/               agent loop, tool registry, tool definitions, prompts
    llm/                 model catalog, policy, gateway, metering, failover
    integrations/        adapters: kontract, stripe, twilio, telegram, postmark, r2,
                         google, microsoft, places, verifier
    shared/              zod schemas and types shared by api, worker and web
    ui/                  shadcn components and design tokens used by web
    config/              eslint, tsconfig, vitest presets
  docs/
    spec/                these files
    decisions/           ADRs written during the build
  infra/
    docker-compose.yml   postgres+pgvector, mailpit, minio, stripe-mock (optional)
    railway/             service configs
  AGENTS.md              instructions for coding agents (from rebuild/AGENTS.md)
```

Rules:
- `packages/core` holds all business logic. Routes in `apps/api` and workflows in `apps/worker` are thin: validate input, call a core service, map the result.
- `packages/core` never imports from `apps/*`. `packages/integrations` never imports from `packages/core`; core depends on integration ports (interfaces), and adapters implement them.
- `apps/web` imports only from `packages/shared` and `packages/ui`, never from `core` or `db`.

## 5. Tenancy model

### 5.1 Pooled tenancy with Postgres RLS

- A **tenant** is one customer business (Better Auth "organization"). A **user** is a global identity who can belong to several tenants through **memberships**.
- Every tenant-owned table has `tenant_id uuid not null`, an index that starts with `tenant_id`, `ENABLE` and `FORCE ROW LEVEL SECURITY`, and the standard policy from [DATA_MODEL.md §2](DATA_MODEL.md#2-rls-template).
- The app connects as role `magpie_app`, which owns no tables and lacks `BYPASSRLS`. Migrations run as `magpie_owner`. Operator console reads that span tenants use role `magpie_ops` (has `BYPASSRLS`) through a separate connection pool that only `packages/core/ops` may use, and every such query writes an audit row.
- The tenant and user are set **per transaction** with `set_config('app.tenant_id', $1, true)` and `set_config('app.user_id', $2, true)`. Transaction-local settings are safe behind Neon's PgBouncer in transaction mode. Never use session-level `SET`.

### 5.2 The only way to touch tenant data

```ts
// packages/db/src/with-tenant.ts
export async function withTenant<TResult>(
  context: TenantContext,               // { tenantId, userId | null, actor }
  work: (tx: TenantTransaction) => Promise<TResult>,
): Promise<TResult>
```

- Opens a transaction on the `magpie_app` pool, sets `app.tenant_id`, `app.user_id` and `app.actor` (json: type and id), runs `work`, commits.
- Core services take a `TenantTransaction` or a `TenantContext`, never a raw pool.
- A lint rule (custom ESLint rule or `no-restricted-imports`) forbids importing the raw pool outside `packages/db`.
- Column defaults fill `tenant_id` from `app_tenant_id()`, so inserts can't land in the wrong tenant even if code forgets the column.

### 5.3 Isolation tests (mandatory)

`packages/db/test/isolation.test.ts` creates two tenants with data in every tenant table, then for each table asserts that a transaction scoped to tenant A:
1. selects zero rows of tenant B;
2. cannot update or delete tenant B rows (0 rows affected);
3. cannot insert a row with tenant B's id (policy violation).

A second test lists every table in the `public` schema and fails if a table with a `tenant_id` column lacks RLS, the policy or a leading `tenant_id` index. New tables can't merge without passing it.

An API-level suite (`apps/api/test/isolation.e2e.test.ts`) calls every `GET /api/app/*` list and detail route as a user of tenant A with ids from tenant B and expects 404.

### 5.4 Request lifecycle

1. Hono middleware resolves the session (Better Auth) or API key, then the **active tenant** (session's active organization, or the key's tenant).
2. Membership is checked; role and permissions are loaded into `c.var.auth`.
3. Entitlement middleware checks plan limits for metered routes (see [BILLING.md](BILLING.md)).
4. The handler calls a core service inside `withTenant`.
5. Domain events written in the same transaction (`domain_events` outbox) are published after commit via `NOTIFY`.
6. Errors map to RFC 9457 problem+json (see [API.md](API.md)).

### 5.5 Future dedicated tier

`tenants.cell` names the database a tenant lives on (default `pool-1`). v1 has one cell. A later "dedicated" tier adds a cell per customer with the same schema; `withTenant` picks the pool by cell. Do not build this in v1, but never hard-code a single pool outside `packages/db/src/pools.ts`.

## 6. Module map

| Module (packages/core/…) | Owns tables | Responsibilities |
|---|---|---|
| `tenants` | tenants, memberships, invitations, tenant_settings | create tenant on sign-up, invites, roles, settings, lifecycle (trial, suspend, delete) |
| `profile` | company_profiles, past_performance, library_items | the customer's own business: NAICS, certifications, areas, capabilities, past performance, boilerplate |
| `crm` | companies, contacts, deals, deal_contacts, pipelines, pipeline_stages, tasks, notes, tags, record_tags, field_definitions, field_provenance, field_suggestions, record_history, saved_views | records, permissions, history, custom fields, views, import and export |
| `activity` | activities, activity_links | the timeline: every email, message, call, note, stage change and Bot action, linked to records |
| `files` | files, file_links | upload, scan, store, presign, link to records |
| `search` | (tsvector columns) | global search across companies, contacts, deals, opportunities |
| `market` | market_opportunities, market_opportunity_texts | public market data cache from Kontract; shared across tenants |
| `matching` | opportunity_searches, opportunity_matches | per-tenant saved searches, scoring, match lifecycle |
| `bids` | bid_documents, bid_document_chunks, bid_requirements, bid_deadlines, submissions | bid workspace on a deal: documents, requirements with citations, compliance matrix, deadlines, submission record |
| `pricing` | price_sheets, price_lines, award_comparables | price builds from wage determinations, past awards and sub quotes |
| `quotes` | quote_requests, quotes | subcontractor quote requests, tracked replies, parsed quotes |
| `drafts` | drafts | proposals, letters, emails, SMS drafts with versions |
| `messaging` | messages, inbound_emails, suppressions | outbound email and SMS through the right provider; inbound parsing; unsubscribes |
| `bots` | bots, bot_jobs, tool_policies | the Bot team, their jobs and autonomy settings |
| `agentRuns` | agent_runs, agent_steps, threads, thread_messages, memories | run lifecycle and chat |
| `approvals` | approvals | approval cards, decisions, short codes, trust stats |
| `channels` | channel_bindings, link_codes, inbound_channel_messages | Telegram, SMS and web push bindings; reply grammar |
| `notifications` | notifications | outbox: digest, approvals, alerts, deadlines |
| `integrations` | connections, oauth_states, secrets | OAuth connections, encrypted credentials |
| `billing` | plans, subscriptions, entitlements, billing_events | Stripe sync, plan catalog, entitlements |
| `usage` | usage_events, usage_counters | metering, limit checks, Stripe meter reporting |
| `audit` | audit_log | append-only audit |
| `events` | domain_events, webhook_receipts | outbox, fan-out, inbound webhook dedupe |
| `ops` | impersonations, data_exports, tenant_deletions, feature_flags, pending_work, tenant_run_slots | operator console, flags, export, deletion, fair dispatch fallback |
| `apiKeys` | api_keys | public API keys |
| `automations` (M9) | automations, automation_runs | trigger → condition → steps |
| `reports` (M9) | reports, report_widgets | dashboards |

## 7. Background work

### 7.1 Processes

- `api` starts a **DBOS client** only (enqueue, send, get status). It never executes workflows.
- `worker` starts the **DBOS runtime**, registers all workflows, queues and schedules, and runs relays. Run at least 2 replicas in production.

### 7.2 Queues

| Queue | Used for | Concurrency |
|---|---|---|
| `agent` | agent runs (chat, jobs, events) | global 50 per worker; **per tenant 3** |
| `docs` | bid document fetch, text extraction, chunking, embeddings | global 20; per tenant 2 |
| `messaging` | sending email and SMS, follow-up sweeps | global 20; per tenant 5 |
| `sync` | Kontract match scans, Stripe usage reporting, data exports | global 10; per tenant 1 |
| `system` | tenant deletion, maintenance | global 2 |

**Per-tenant fairness.** Use DBOS queue partitioning keyed by `tenant_id` if the pinned DBOS version supports it. If it does not, implement a fair dispatcher: callers insert `pending_work` rows instead of enqueueing directly; a `dispatch` workflow moves rows into the DBOS queue in round-robin order across tenants and respects per-tenant limits held in `tenant_run_slots`. Both tables are in [DATA_MODEL.md §15](DATA_MODEL.md#15-operations). Record the choice in an ADR.

### 7.3 Idempotency

- Every workflow gets a deterministic workflow id when it has a natural key, for example `digest:<tenant>:<user>:<yyyy-mm-dd>`, `scan:<tenant>:<search>:<yyyy-mm-ddThh>`, `inbound:telegram:<update_id>`. Re-enqueueing the same id is a no-op.
- External side effects (send email, send SMS, Stripe calls) happen in DBOS steps with an idempotency key passed to the provider when it supports one (Stripe `Idempotency-Key`, Postmark `MessageID` dedupe via our `messages.id`).
- Webhook handlers store the provider event id in a unique column before doing work.

### 7.4 Schedules

Cron schedules are **global**, not per tenant. One schedule per job type fires every 15 minutes and fans out to tenants whose local time window matches (for example, digests where the tenant-local hour equals the user's digest hour and no digest was sent today). This keeps the scheduler O(job types), not O(tenants).

| Schedule | Every | Fans out to |
|---|---|---|
| `scan-opportunities` | 60 min | active saved searches due for a scan |
| `send-digests` | 15 min | users whose digest time has arrived in their timezone |
| `deadline-watch` | 15 min | deadlines in the next 72 hours without a sent reminder |
| `quote-followups` | 60 min | quote requests past their follow-up time |
| `bot-jobs` | 5 min | `bot_jobs` with `next_run_at <= now()` |
| `report-usage` | 60 min | tenants with unreported usage for Stripe meters |
| `expire-approvals` | 15 min | approvals past `expires_at` |
| `trial-lifecycle` | daily | trials ending in 3 days, ended trials |
| `cleanup` | daily | expired link codes, oauth states, idempotency keys, short links, old SSE cursors |
| `award-sweep` | daily | one SAM.gov sweep of award notices, matched to every tenant's submitted bids |
| `sam-status-refresh` | daily | SAM registration status and expiry for every company profile with a UEI |
| `kontract-usage-reconcile` | monthly | compare Kontract's usage report with our `usage_events` |
| `telegram-webhook-check` | at worker start | confirm the Telegram webhook URL and secret are set |

The `report-usage` schedule is registered behind the feature flag `stripe_meters`, off in v1 (BILLING.md). Schedules find due work across tenants through the `fanout_*` security definer functions in DATA_MODEL §18.5, then open `withTenant` per item.

### 7.5 Durable agent runs and approvals

An agent run is a DBOS workflow (`agentRunWorkflow`). Each model call and each tool call is a step. When a tool needs approval, the workflow writes an `approvals` row, emits `approval.requested`, sends notifications, then waits with `DBOS.recv("approval:<id>", timeoutSeconds)`. Because DBOS counts a waiting workflow against its queue's concurrency, the run is split into segments: a segment ends at an approval, a small waiter workflow outside the `agent` queue does the `recv`, and the decision enqueues the next segment (AGENT_RUNTIME.md). A pending approval therefore never holds one of the tenant's agent slots. Deciding an approval (web, SMS, Telegram, API) updates the row and calls `DBOS.send(workflowId, decision, "approval:<id>")`. On timeout the approval expires and the run continues without that action. Details in [AGENT_RUNTIME.md](AGENT_RUNTIME.md).

### 7.6 Outbox relays

Rows in `notifications` and `domain_events` are written in the same transaction as the change that caused them. Relays in `worker` pick them up with `FOR UPDATE SKIP LOCKED`, deliver them, and mark them sent. This gives at-least-once delivery without dual writes.

## 8. LLM gateway (`packages/llm`)

Every model call in the system goes through `llm.generate()`, `llm.stream()` or `llm.embed()`. Direct provider calls are forbidden by lint.

- **Model catalog** in `packages/llm/models.json`: entries with `id` (our name, for example `standard`), `provider`, `providerModelId`, `inputPerMTokMicros`, `cachedInputPerMTokMicros`, `outputPerMTokMicros`, `contextWindow`, `supportsTools`, `supportsVision`. Prices are configuration, set at deploy and checked against the provider's price page.
- **Tiers** used by code: `fast` (classification, extraction, routing), `standard` (agent turns, drafting), `deep` (long document reasoning), `embed`. Each tier maps to an ordered list of catalog entries (primary, then fallbacks).
- **Initial defaults** (verify ids and prices before launch): `standard` → `anthropic:claude-sonnet-5-5`, then `openai:<current flagship>`; `fast` → `anthropic:claude-haiku-5-5`, then `openai:<current small model>`; `deep` → `anthropic:claude-opus-5-5`, then `openai:<current flagship>`; every tier must keep at least one non-Anthropic entry, because some defense customers must exclude Anthropic; `embed` → `openai:text-embedding-3-small` (1536 dimensions).
- **Tenant model policy** (`tenant_settings.model_policy`): allowed providers and excluded providers. A tenant may exclude a provider (for example, defense contractors that must not use one vendor). The gateway skips excluded entries; if a tier has no allowed entry, the call fails with `model_unavailable` and the run stops with a clear message.
- **Metering.** After each call the gateway writes an `agent_steps` row (if inside a run) and a `usage_events` row with tokens, cached tokens, cost in micros, tier, provider, model, `bot_id`, `run_id`, and `feature`.
- **Budgets.** Before each call: check the tenant's monthly AI allowance (entitlement `ai_runs` and the hard cost ceiling `ai_cost_micros`), and the per-run step and cost caps. Over the limit, the call fails with `limit_reached`.
- **Prompt caching.** Static system prompt and tool definitions come first so providers cache them. Pass the provider's cache controls where the AI SDK exposes them, and a per-tenant cache key where supported.
- **Failover.** On provider 5xx, timeout or overload, retry once, then move to the next entry in the tier. Never fail over to an excluded provider.
- **No training.** Use provider settings and endpoints that do not train on customer data; list providers as subprocessors (see [SECURITY.md](SECURITY.md)).

## 9. Events and realtime

- `domain_events` rows: `type` (dot-namespaced, for example `deal.stage_changed`, `approval.requested`, `run.updated`, `match.created`, `message.received`), `tenant_id`, `payload`, `created_at`.
- After commit, `api` and `worker` call `NOTIFY domain_events, '<tenant_id>:<event_id>'`.
- Each `api` instance holds one `LISTEN` connection and pushes events to that tenant's connected SSE clients at `GET /api/app/events`. The client sends `Last-Event-ID`; the server replays missed events from `domain_events` (kept 7 days).
- The web app invalidates TanStack Query keys by event type (map in `packages/shared/src/events.ts`).
- Automations (M9) and outgoing webhooks (M8) consume the same events.

## 10. Configuration and secrets

- Platform configuration comes from environment variables, validated at boot by a zod schema in `packages/shared/src/env.ts`. The process exits on invalid config. The full list is in [SECURITY.md §5](SECURITY.md).
- Tenant configuration lives in `tenant_settings` (non-secret) and `secrets` (encrypted). Nothing tenant-specific lives in env vars.
- Tenant secrets (OAuth refresh tokens, bring-your-own API keys) use envelope encryption: a random data key per secret encrypts the value with AES-256-GCM; the data key is wrapped by the master key (`MASTER_KEY` env in v1, a cloud KMS key from M10). `secrets.key_version` supports rotation.

## 11. Environments and deployment

| Env | Database | Purpose |
|---|---|---|
| local | Docker Postgres 17 + pgvector, Mailpit, MinIO | development; `pnpm dev` runs api, worker and web |
| preview | Neon branch per pull request | e2e tests and review |
| staging | Neon `staging` branch | release candidate, Stripe test mode, Twilio test numbers |
| production | Neon `main` | customers |

- Migrations run as a release step (`pnpm db:migrate` as `magpie_owner`) before new `api` and `worker` versions start. Migrations must be backward compatible with the previous app version (expand, then contract in a later release).
- `api` and `worker` are built from one Dockerfile with two targets. Health checks: `GET /health` (process up), `GET /ready` (database reachable, migrations at the expected version).
- Zero-downtime deploys: Railway rolling deploys; DBOS workflows resume on the new worker version. Workflow code changes that alter step order must use a new workflow name (`agentRunWorkflowV2`) and leave the old one registered until its runs drain.

## 12. Observability

- Every log line and span carries `tenant_id`, `user_id`, `request_id`, and when present `run_id` and `workflow_id`.
- Sentry captures errors with the same tags. Never attach request bodies that may contain secrets or tokens.
- Metrics to watch from day one: queue depth and wait time per queue, run duration and cost, approvals pending by age, digest send success, provider error rates, webhook failures, RLS policy violations (should be zero).
- An internal `/ops` dashboard (M7) shows per-tenant cost (AI, SMS, Kontract) against revenue.

## 13. Performance and scale targets (v1)

| Measure | Target |
|---|---|
| Tenants | 5,000 active on one Postgres (Neon autoscaling) |
| API p95 latency | under 300 ms for record reads and writes, excluding AI |
| First token of a chat reply | under 2.5 s p95 |
| Digest delivery | within 10 minutes of the user's chosen time |
| Approval decision to action resumed | under 5 s p95 |
| Availability | 99.5% monthly for `api` |
| Recovery | RPO 1 hour (Neon point-in-time restore), RTO 4 hours |

## 14. Decisions already made (summary)

1. Pooled tenancy with forced RLS; dedicated cells later through the same code.
2. Postgres is the queue, the event bus and the workflow store (DBOS). No Redis in v1.
3. One LLM gateway with per-tenant model policy, metering and budgets.
4. External effects always need approval in v1. Internal writes can earn "without asking".
5. Public market data is cached globally; tenant decisions about it are tenant data.
6. Gmail and Outlook are used to **send** only in v1 (non-restricted scopes). Replies come back through tracked reply addresses on Postmark inbound. Reading mailboxes waits for Google's CASA assessment (v2).
7. We text only our own users (owners and their staff) in v1, under one Magpie messaging campaign.
8. Plans and prices are data in `plans`, not code.

## 15. Rulings across the specs

The supporting specs were written in parallel. Where they disagreed, these rulings decide. Code follows the ruling even if a sibling spec still says otherwise.

| # | Topic | Ruling |
|---|---|---|
| 1 | Telegram callback data | `apr:<approval uuid>:<a\|s\|e>` (42 bytes): approve, skip, edit link. |
| 2 | Notification preferences | `memberships.notification_prefs` (jsonb) plus `memberships.onboarded_at`. No `member_preferences` or `notification_preferences` table. A person's `digestHour` there overrides `tenant_settings.digest_hour`. |
| 3 | Calendar feed | An `api_keys` row with scope `calendar:read`; the feed URL is `/ics/<key>.ics`. No `calendar_feeds` table. |
| 4 | Bid brief storage | The `bid_briefs` table (versioned, one `current` row per deal), served as `BidBrief` by `GET /deals/:id/brief`. Not a column on `deals`. |
| 5 | Reviewer assignment (Managed plan) | `staff_assignments`. Not tenant metadata. |
| 6 | Bot model tier | Read-only for workspaces in v1. Staff can change it through ops. |
| 7 | Approval short codes across workspaces | Unique across all of a person's pending approvals in every workspace (`short_code_available`). If an ambiguity ever happens anyway, reply with a link. |
| 8 | Decisions made from an approval email | The email links to `/a/<approvalId>?via=email`; the decide request carries `via` (`web` or `email`, default `web`), stored in `decided_via`. |
| 9 | Memories | Members add and delete their own memories. Business-wide memories (`user_id` null) need admin or owner. |
| 10 | Shared saved views and tags | Members can create shared views and create and apply tags. Renaming or deleting a shared view or tag someone else made needs admin or owner. |
| 11 | API keys | Members can create keys for themselves; a key never exceeds its creator's role. Admins and owners can list and revoke every key. |
| 12 | Billing | Admins and owners change the plan, payment method and buy run packs. Only the owner cancels the subscription or deletes the workspace. |
| 13 | Roles | Only the owner grants or removes admin and transfers ownership. Admins invite people and set member or viewer roles. |
| 14 | Bot jobs | Owners and admins can change job times and turn jobs on or off. |
| 15 | Quote follow-ups | Every follow-up needs approval in v1, like every external action. The flag `quote_followup_preapproval` exists and stays off. |
| 16 | Model provider exclusions | The setting ships in MVP (FR-SET-1). |
| 17 | Better Auth admin plugin fields | The plugin's role maps to `users.auth_role`; add `banned`, `ban_reason`, `ban_expires` (DATA_MODEL §18.1). `auth_role = 'admin'` only for staff with `staff_role` support or admin. |
| 18 | Stripe `incomplete_expired` | Stored as `canceled`. |
| 19 | Stripe customer | Created at sign-up, before the seed transaction. |
| 20 | Stripe usage reporting | Off in v1 (`stripe_meters` flag). Allowances and prepaid run packs only. |
| 21 | Phone verification | Twilio Verify sends and checks the code; `link_codes.code` holds our challenge id. |
| 22 | Kontract workspace id | `magpie-<tenant_id>`. |
| 23 | Route and field names | API.md wins over UX.md on route and field names. UX.md wins on user-facing words; the settings page is "Channels and alerts". |
| 24 | Outreach email provider | Quote requests go out from the owner's connected Gmail or Outlook. Postmark sends quote requests only after Postmark confirms in writing that this use is allowed; until then a workspace without a connected mailbox can't send quote requests and is asked to connect one. Postmark always handles transactional mail and inbound replies. |
| 25 | Private services | `clamav` and `gotenberg` run beside `api` and `worker` in the same Railway project and in `infra/docker-compose.yml`. |
