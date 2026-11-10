# Multi-tenant SaaS architecture for an AI-native CRM with autonomous agents (as of 2026-11-10)

Scope: architecture patterns, managed services and costs for rebuilding a product that today runs one Railway project (app + Postgres container) per customer (Bun, Hono, React, Postgres, OpenAI, Composio, in-process routine worker) into a true multi-tenant SaaS. Prices were read from vendor pages in Nov 2026 unless a date is given. "Confirmed" = stated by a primary source (vendor page, official docs, the code itself). "Secondary" = vendor or third-party blog. Inferences are kept in their own subsections.

## 1. Tenancy models: pool (shared tables + tenant_id + RLS), bridge (schema per tenant), silo (DB per tenant)

### Takeaway
All the major guidance (AWS, Microsoft, Neon) treats isolation as a spectrum and recommends mixing models per tier: a pooled app tier, a pooled or per-tenant data tier, and a dedicated "silo" deployment sold as a premium tier for customers that need it. For Postgres, pooled + RLS is the cheapest to run; schema-per-tenant (what Twenty does) adds migration and PITR pain; DB-per-tenant is now cheap on scale-to-zero serverless Postgres (Neon) but multiplies migration and fleet operations.

### Cited Findings
**Definitions and trade-offs**
- AWS defines three Postgres partitioning models: silo (one DB instance per tenant: strongest separation, higher infra cost, harder onboarding), bridge (one shared instance, a schema per tenant: some savings but maintenance and onboarding get complicated), pool (shared instance and tables with a tenant key on each table: cheapest and least maintenance, but access enforcement is harder and is "commonly implemented by hoping the correct WHERE clause is implemented in every SQL statement") — [AWS Database Blog, 18 May 2020](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- The AWS Well-Architected SaaS Lens opens with "Silo, Pool, and Bridge Models"; its document revision date is 4 Apr 2023 (older but still the current lens) — [AWS SaaS Lens PDF](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/wellarchitected-saas-lens.pdf); the bridge model is defined as combining silo and pool within one system — [AWS SaaS Lens: Bridge model](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/bridge-model.html)
- AWS multi-tenant guidance: in the pool model tenants share a DB instance and objects, and "tenant isolation is provided by row-level security features in the database" — [Guidance for Multi-Tenant Architectures on AWS](https://docs.aws.amazon.com/solutions/multi-tenant-architectures-on-aws/)
- Microsoft (Azure Architecture Center, dated 11 Jun 2025, updated 11 Oct 2026) names four models: automated single-tenant deployments ("if a single tenant requires a specific infrastructure cost, 100 tenants probably require 100 times that cost"), fully multitenant, vertically partitioned (most tenants on shared infra, single-tenant deployments for customers needing higher performance or isolation, and "you can even charge customers a higher rate to use a single-tenant deployment"), and horizontally partitioned (shared app tier, per-tenant databases to contain noisy neighbors). It recommends a tenant-to-deployment mapping table ("deployment stamps") so tenants can be moved between deployments, and testing isolation for leakage and noisy-neighbor outcomes — [Microsoft Learn: Tenancy models](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- Microsoft risks for vertical partitioning: "Your codebase needs to be designed to support both multitenant and single-tenant deployments," and you need a migration path from shared to dedicated — [Microsoft Learn: Tenancy models](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)

**Postgres RLS mechanics and pitfalls (confirmed)**
- Recommended RLS pattern: one shared DB login; policy uses `current_setting('app.current_tenant')`; app sets it with `SET`/`set_config` per connection. Rows failing the policy are silently filtered on SELECT/UPDATE/DELETE; INSERT violations error — [AWS Database Blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- Superusers and `BYPASSRLS` roles skip policies; the table owner skips them unless `FORCE ROW LEVEL SECURITY` is set, so the app must connect as a non-owner role; role-per-tenant "doesn't scale well"; session variables can conflict with pgBouncer-style poolers and must be tested — [AWS Database Blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- RLS performance: index every column a policy filters on (only the leading column of a composite PK counts as indexed); wrap function calls as `(select auth.uid())` so Postgres caches the result per statement instead of per row; scope policies with `TO <role>`; move complex checks into `security definer` functions with `search_path = ''`. Supabase's `service_role` has `bypassrls` — never ship it to a browser — [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

**How specific products do it**
- **Twenty** (the open-source CRM this repo forks) uses bridge/schema-per-tenant: each workspace gets a Postgres schema named `workspace_${uuidToBase36(workspaceId)}`, created with `createSchema` at provisioning and dropped with `dropSchema(..., cascade)` on deletion — confirmed in code: `packages/twenty-server/src/engine/workspace-datasource/utils/get-workspace-schema-name.util.ts` and `workspace-schema.service.ts` in this repo ([upstream path](https://github.com/twentyhq/twenty/tree/main/packages/twenty-server/src/engine/workspace-datasource))
- **HubSpot** runs "Hublets": each Hublet (region, e.g. na1, eu1; launched July 2021) "runs an independent copy of our MySQL infrastructure" on Vitess; they built vTickets for globally unique IDs across Hublets and cross-Hublet replication for global data — [HubSpot product blog: vTickets](https://product.hubspot.com/blog/our-journey-to-multiregion-vtickets); a Percona talk reports 800+ MySQL clusters/keyspaces on Vitess + Kubernetes — [Speaker Deck: MySQL and Vitess at HubSpot](https://speakerdeck.com/jfg956/mysql-and-vitess-and-kubernetes-at-hubspot) (secondary summary of slides)
- **Neon** recommends one Neon project per tenant (not branch per tenant); calls schema-per-user "generally not recommended" for SaaS (it limits per-customer PITR); says a shared schema with FKs + RLS "can be a reasonable starting point" but compliance and big-table tuning get harder; cites Retool managing ~300k Postgres databases on Neon, and "some users manage hundreds of thousands of projects with one engineer" — [Neon multitenancy guide](https://neon.com/docs/guides/multitenancy)

**Per-tenant encryption keys**
- AWS KMS: $1/month per customer-managed key (prorated hourly); first and second rotations add $1/month each, then charges stop; 20,000 free requests/month; worked examples imply ~$0.03 per 10,000 symmetric requests — [AWS KMS pricing](https://aws.amazon.com/kms/pricing/)

### Inferences
- A pooled design with `tenant_id` on every table + `FORCE ROW LEVEL SECURITY` + a non-owner app role + transaction-scoped `set_config('app.tenant_id', ..., true)` is the standard way to make Postgres the backstop for app-layer tenant filters. With a pooler, use transaction-local settings (`SET LOCAL` / `set_config(..., true)`) so a tenant id cannot leak between pooled sessions (my inference from the AWS pgBouncer caveat).
- Twenty's schema-per-workspace model works at its scale but forces every migration to run N times; Neon's guide makes the same point against schema-per-user. For a rebuild starting from one-DB-per-customer, pooled + RLS for the standard tier plus a "silo" tier (a dedicated Neon project or dedicated deployment stamp) matches Microsoft's "vertically partitioned" model.
- Per-tenant KMS keys (envelope encryption of the tenant's data keys, e.g. OAuth tokens, email bodies) cost ~$1/tenant/month in key storage, which is fine for a paid enterprise tier but meaningful on a $99 seat plan for small tenants. A common middle ground is one KMS key per tier or region with per-tenant data keys (inference; not from a source).
- Noisy-neighbor controls in a pooled DB: per-tenant statement timeouts, per-tenant rate limits at the API and queue layers (see section 3), and moving heavy tenants to a dedicated stamp (inference from Microsoft guidance).

### Gaps
- Attio's tenancy/storage architecture: I found no engineering post describing it (searches returned only its help-center data model docs). Unknown whether Attio is pooled or sharded.
- Salesforce/HubSpot-style metadata-driven custom objects in a pooled schema (e.g., JSONB vs EAV vs per-tenant DDL) was not researched here.
- Quantified schema-per-tenant limits (catalog bloat, migrations at 10k+ schemas) not found in a primary source.

## 2. Control plane: provisioning, identity (Clerk, WorkOS, Auth0, Better Auth), billing and metering, entitlements, admin, flags

### Takeaway
Identity: WorkOS is cheapest for user auth (1M MAU free) but charges $125/month per enterprise SSO or SCIM connection; Clerk is cheaper per SSO connection ($75 → $48) and includes 100 orgs free, with an Enhanced B2B add-on at $100/month; Better Auth is open source with organization, SSO (OIDC + SAML) and SCIM plugins you run yourself. Billing: Stripe Billing (0.7% of billing volume) now includes a Meters API with up to 100M events/month, and Stripe owns Metronome (Jan 2026); Orb was acquired by Adyen (Jul 2026); Lago is the open-source option; Autumn targets credits/limits/entitlements.

### Cited Findings
**Identity providers**
- WorkOS: AuthKit first 1M MAUs free, then $2,500/month per additional 1M; SSO $125/connection (1–15), $100 (16–30), $80 (31–50), $65 (51–100), custom above 100; Directory Sync (SCIM) same tiers; Audit Logs SIEM streaming $125/month per connection, retention $99/month per 1M events; custom domain $99/month; staging free — [WorkOS pricing](https://workos.com/pricing)
- Clerk: Hobby free (50,000 monthly retained users per app, no SSO/SCIM); Pro $25/month ($20 annual), 50k MRUs then $0.02/MRU, falling to $0.012 at 10M+; Pro includes 1 SSO and 1 Directory Sync connection per app; extra SSO connections $75/month (2–15), $60 (16–100), $48 (101–250); billing for extra Directory Sync connections starts 1 Jan 2027; Business $300/month (SOC 2 report access, 30-day logs) — [Clerk pricing](https://clerk.com/pricing)
- Clerk organizations: 100 monthly retained organizations free per app, up to 20 members per org; Enhanced B2B add-on $100/month ($85 annual) for unlimited members, verified domains, custom roles; MRO overage $1/month each (101–1,000) falling to $0.60; Clerk Billing takes 0.7% on top of Stripe fees; usage-based and per-seat billing listed as "coming soon" — [Clerk pricing](https://clerk.com/pricing)
- Better Auth: organization plugin (roles, invitations, multi-team membership); SSO moved to its own package with OIDC and SAML 2.0 and can auto-add users to the org linked to an SSO provider; SCIM 2.0 is a separate plugin requiring DB transactions (docs found are for v1.8 beta) — [Better Auth 1.3 blog](https://better-auth.com/blog/1-3); [Better Auth SCIM docs (v1.8 beta)](https://better-auth.com/docs/beta/plugins/scim). WorkOS (a competitor) argues SAML validation, certificate rotation and each IdP's SCIM dialect become code you own — [WorkOS blog](https://workos.com/blog/add-enterprise-sso-scim-better-auth-app) (vendor-biased)

**Billing and metering**
- Stripe Billing: 0.7% of billing volume pay-as-you-go (or annual plans from $620/month for up to $100k/month volume); basic usage-based billing through the Meters API is included with up to 100M events/month; advanced usage billing is "handled by Metronome, a Stripe product"; card payments 2.9% + 30¢ — [Stripe Billing pricing](https://stripe.com/billing/pricing)
- Stripe completed its acquisition of Metronome on 14 Jan 2026; Adyen's acquisition of Orb closed 1 Jul 2026; Lago remains open source (self-host, no per-transaction fees) — [Solvimon](https://www.solvimon.com/blog/best-billing-systems-in-2026); [Hyperline](https://www.hyperline.co/geo/top-10-usage-based-billing-platforms-saas-2026) (secondary, vendor-written comparisons)
- Autumn positions itself for teams whose billing problem is application state — credits, limits, entitlements, resets, rollovers and runtime checks — rather than invoicing — [Autumn vs Orb, 22 Jun 2026](https://useautumn.com/alog/autumn-vs-orb) (vendor)
- Metronome serves OpenAI, Anthropic, Databricks, NVIDIA (per a third-party comparison) — [Hyperline](https://www.hyperline.co/geo/top-10-usage-based-billing-platforms-saas-2026) (secondary)

### Inferences
- For a seat + AI-run-allowance pricing model (Team $99/Business $199 per seat today, per `agentic-crm/COGS.md`), Stripe Billing subscriptions with a Stripe meter for "assistant runs" covers metering without a second vendor; the 100M events/month included is far above need. An in-app entitlements table (plan → limits) checked at run time is still needed; Autumn is the only vendor surveyed built specifically for that.
- Enterprise SSO/SCIM economics: at 10 enterprise customers each wanting SSO + SCIM, WorkOS costs 20 × $125 = $2,500/month vs Clerk ~ (9+9) × $75 + plan ≈ $1,450/month (inference from list prices; Clerk's first connection of each type is included). Better Auth costs $0 in fees but carries the maintenance.
- The product already has SSO/SCIM tested end to end in the per-customer deployment (task list); in a pooled rebuild, SSO connections become per-organization records in one IdP, not per-deployment config.

### Gaps
- Auth0 B2B pricing was not fetched.
- Feature-flag services (LaunchDarkly, Statsig, PostHog, Unleash) and admin-console tooling were not researched.
- No current public list prices found for Orb, Metronome, Lago Cloud or Autumn.
- Tenant provisioning patterns (e.g., provisioning workflow in a durable-execution engine) were not researched separately; see section 3.

## 3. Agent runtime at scale: durable execution, per-tenant queues, schedules across thousands of tenants, multi-day human approvals, LLM gateway, prompt caching

### Takeaway
Every leading durable-execution product now supports per-tenant fairness and long waits that do not consume concurrency: Trigger.dev has `concurrencyKey` per-tenant pools (Pro $50/month); Inngest has per-key flow control but its multi-tenant key-queue scheduling needs Enterprise, and run length (including waits) is capped at 30/90/366 days by plan; Temporal Cloud is $50 per million actions ($25 at volume); Cloudflare Workflows' `waitForEvent` can wait up to 365 days; DBOS is an open-source library that stores workflow state in your own Postgres. For per-tenant LLM cost, LiteLLM's self-hosted virtual keys/budgets are free; OpenAI's `prompt_cache_key` now keeps cache accounting per customer/workspace.

### Cited Findings
**Durable execution: prices and limits**
- Temporal Cloud: Pay-As-You-Go from $50 per 1M actions, down to $25 with volume; Business plan from $500/month (greater of $500 or 10% of usage) incl. 2.5M actions; active storage $0.042/GB-hour, retained $0.00105/GB-hour; $150 credits for 90 days for new sign-ups — [Temporal pricing](https://temporal.io/pricing)
- Inngest: Free 50k executions/month; Pro from $99/month with 1M executions, $50 per extra 1M; Business from $499 with 10M, $25 per extra 1M; concurrent steps 5 / 100 / 500; max run length including sleeps and waits 30 days (Free), 90 days (Pro), 366 days (Business) — [Inngest pricing](https://www.inngest.com/pricing)
- Inngest flow control: concurrency, throttling, rate limiting, debounce, priority, singleton, batching; waiting runs do not use a concurrency slot; multi-tenancy "applies limits by tenant key and reduces the effect of one tenant's backlog on another," but "key-queue scheduling currently requires Enterprise access" — [Inngest flow control docs](https://www.inngest.com/docs/guides/flow-control)
- Trigger.dev: Free ($5 compute credit, 20 concurrent runs, 10 schedules); Hobby $10; Pro $50/month (200+ concurrent runs then $10/month per 50; 1,000+ schedules then $10/month per 1,000); compute from $0.0000169/s (micro) and $0.0000338/s (default small-1x); $0.000025 per run invocation; waits longer than 5 s are checkpointed and not billed as compute; waiting tasks do not count toward concurrency; 1,500 API requests/min — [Trigger.dev pricing](https://trigger.dev/pricing)
- Trigger.dev per-tenant concurrency: pass a `concurrencyKey` (user or org id) and each key gets its own pool under `perKey`; add `total` to cap all runs; named limits can cap a tenant across several tasks; slots are released only when a run checkpoints at a waitpoint (`wait.for` checkpoints ~60 s into the wait); per-key overrides last at most 30 days — [Trigger.dev queue concurrency docs](https://trigger.dev/docs/queue-concurrency)
- Cloudflare Workflows: `waitForEvent` is intended for human approval and webhooks; events sent early are buffered; a waiting instance can last up to 365 days and waiting instances do not count against concurrency — [third-party skill summary](https://www.vibeindex.ai/skills/itechmeat/llm-code/cloudflare-workflows) (secondary); step and storage billing began 10 Aug 2026, requests and CPU billing unchanged — [Cloudflare changelog, 7 Jul 2026](https://developers.cloudflare.com/changelog/post/2026-07-07-workflows-billing-updates/)
- DBOS Transact is a free, open-source durable execution library (Python, TypeScript) that checkpoints to Postgres; DBOS Pro $99/month for tooling (2 seats, 3 apps) — [DBOS pricing](https://www.dbos.dev/pricing); Teams $499/month per a third-party listing — [Toolradar](https://toolradar.com/tools/dbos/pricing) (secondary)
- Restate Cloud bills by durable actions (invocations, steps, sleeps, RPCs), with free state reads/writes and a BYOC option; server under BSL 1.1 — [Beri.net review](https://www.beri.net/tools/restate) (secondary; Restate's own page did not render for the reviewer)
- One comparison estimates a sample agent run bills ~51–52 units across Temporal, Inngest, Restate and DBOS — [Beri.net comparison](https://www.beri.net/article/temporal-vs-inngest-vs-restate-vs-dbos-durable-execution-agent-cost) (secondary)

**LLM gateway and per-tenant cost tracking**
- LiteLLM proxy (open source, self-hosted): virtual keys, budgets, rate limits and spend tracking at $0; key and budget features require Postgres; logs per-request token cost per virtual key — [AI Tools Atlas: LiteLLM pricing](https://aitoolsatlas.ai/tools/litellm/pricing); [DEV: virtual keys per tenant](https://dev.to/marcuswwchen/virtual-keys-per-tenant-ditching-our-custom-llm-billing-layer-2p7b) (secondary)
- Portkey: Production plan reportedly $49/month + $9 per 100K logs (log-based pricing); unsupported models show $0.00 in its cost tracking — [Portkey cost management docs](https://portkey.ai/docs/product/observability/cost-management); [PkgPulse comparison](https://www.pkgpulse.com/guides/portkey-vs-litellm-vs-openrouter-llm-gateway-2026) (secondary)
- Helicone: observability-first, per-user/per-key cost attribution, free tier ~10K requests/month — [FutureAGI](https://futureagi.com/blog/helicone-alternatives-2026/) (secondary)
- Unverified reports: Portkey acquired by Palo Alto Networks (May 2026) and Helicone acquired by Mintlify — both from third-party comparison sites only ([Eden AI](https://www.edenai.co/post/best-portkey-alternatives-7-ai-gateways-compared); [FutureAGI](https://futureagi.com/blog/helicone-alternatives-2026/)); not confirmed by a primary source

**OpenAI prompt caching (confirmed, current docs)**
- Cached input is "discounted up to 95%"; for GPT-5.6 and later, cache reads cost 0.1× the input rate (0.05× on GPT-6.1 Sol and GPT-6.1 Terra); cache writes cost 1.25× (30-minute TTL, default) or 2.5× (12-hour TTL, Responses API only); minimum 1,024 tokens — [OpenAI prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching)
- For GPT-5.6+, `prompt_cache_key` "keeps cache accounting separate for customers, users, or workspaces" and helps prevent cache-hit probing across users; caches are never shared across organizations; caching is ZDR-compatible and stores encrypted KV tensors, max 24 h — [OpenAI prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching)

### Inferences
- "Scheduled routines across thousands of tenants" maps cleanly to: one schedule per routine type (cron), fanning out per-tenant runs with a per-tenant `concurrencyKey` (Trigger.dev) or tenant-keyed concurrency (Inngest/Temporal task-queue design), not one cron per tenant. Trigger.dev Pro's 1,000 included schedules would be exhausted quickly if each tenant routine is its own schedule.
- Human-in-the-loop approvals that pause for days: Inngest Pro caps a whole run (including waits) at 90 days; Trigger.dev and Cloudflare release concurrency while waiting; with DBOS the waiting state is just a row in your own Postgres. Any of these replaces the current in-process worker, which loses in-flight state on redeploy (inference about the current design, consistent with the "in-process worker" description).
- DBOS (library on the existing Postgres) is the smallest operational step from today's Bun/Hono/Postgres stack; Trigger.dev is the cheapest managed option with first-class per-tenant concurrency; Temporal is the most mature but the heaviest to adopt. (Judgment, not sourced.)
- For per-tenant AI cost, the product can either (a) run LiteLLM with one virtual key per tenant or (b) record OpenAI `usage` per call against tenant_id in its own table and send totals to a Stripe meter. Setting `prompt_cache_key = tenant_id` (or tenant+agent) keeps cache economics per tenant.
- With system prompts and tool definitions likely >1,024 tokens, caching could cut repeated input cost substantially for agents (inference; actual hit rate unmeasured).

### Gaps
- Cloudflare Workflows per-step price and Durable Objects pricing not confirmed from Cloudflare's own pricing page.
- Restate and Langfuse current list prices not confirmed from primary pages; OpenRouter's platform fee not checked.
- No source compared per-tenant fairness behaviour of these engines under load.

## 4. Integrations: managed OAuth platforms, Gmail/Calendar sync at scale, Google restricted-scope verification and CASA, Microsoft publisher verification

### Takeaway
Moving to one pooled SaaS means one Google OAuth client for all tenants, so restricted Gmail scopes (read/modify) require Google's restricted-scope verification plus an annual CASA assessment. In 2026 Google renamed CASA tiers (Tier 2 → AL1, Tier 3 → AL2) and began requiring AL1 from lab assessors — notices dated Aug and Nov 2026, with at least one citing a 1 Feb 2027 deadline. Lab fees are reported in the hundreds to low thousands of dollars per year, and one company went from evidence submission to approval in ~30 days. Composio's default OAuth app shares quota across all Composio customers; white-labeling with your own Google client is supported but makes you the party Google verifies. Microsoft publisher verification is free but needs a verified Microsoft AI Cloud Partner Program account.

### Cited Findings
**Google restricted-scope verification and CASA**
- Apps that access restricted-scope data and can reach it through a third-party server need a security assessment by "Google-empanelled security assessors," standardized through the App Defense Alliance's CASA framework; reassessment "at least every 12 months after your assessor's Letter of Assessment (LOA) approval date"; adding a restricted scope may need reassessment; verification "can potentially take several weeks"; exemptions: personal use, development/testing, service-owned data, internal (Workspace-org-only) apps — [Google: Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- Tier renaming: CASA Tier 2 is now Assurance Level 1 (AL1), Tier 3 is AL2; a Google notice dated 11 Aug 2026 required Tier 2/AL1; CellCog used TAC Security, submitted evidence 14 Aug 2026 and got OAuth verification approval 13 Sep 2026 (~30 days); AL1 is 48 checks based on OWASP ASVS, documented by the developer and validated by the lab, whereas AL2 has the lab test the app, infrastructure and storage — [CellCog blog, 16 Sep 2026](https://cellcog.ai/blog/casa-security-assessment/)
- A Google notice dated 3 Nov 2026 (quoted in a GitHub issue opened 4 Nov 2026) requires "an ADA-CASA AL1 (formerly Tier 2) security assessment by Feb 1, 2027," renewed yearly by a paid ADA-authorized lab; the self-scan path is deprecated; Google refused the author's waiver request on 9 Nov 2026; unverified apps show a warning screen and have a 100-new-user lifetime cap — [GitHub keytray issue #26](https://github.com/MehdiMamas/keytray/issues/26) (secondary, quoting Google)
- Cost: no lab publishes a CASA price; third-party pages cite TAC Security AL1 at ~$540/year (unconfirmed) — [GitHub keytray issue #26](https://github.com/MehdiMamas/keytray/issues/26); another blog puts TAC Tier 2 at $540–$1,800/year and calls the widely quoted $50,000 figure outdated — [Bright Softwares](https://bright-softwares.com/blog/en/google-workspace/the-50000-gmail-add-on-myth-what-google-s-casa-certification-really-costs); vendor blogs also cite a $500–$4,500 range attributed to Google and TAC list prices of $675–$855 (AL1 one-time), $4,500 (Enterprise AL1), $5,400 (AL2) — [DeepStrike](https://deepstrike.io/blog/google-casa-security-assessment-2025); [Agentic Fabriq](https://www.agenticfabriq.com/blog/google-oauth-verification-casa) (secondary; I could not tell which of the two blogs states which figure)
- Restricted Gmail scopes (per secondary sources): `https://mail.google.com/`, `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.insert`, `gmail.metadata`, `gmail.settings.basic`; `gmail.send` is Sensitive (verification but no CASA) — [DeepStrike](https://deepstrike.io/blog/google-casa-security-assessment-2025); [GitHub WindoM issue #321](https://github.com/YehudaBriskman/WindoM/issues/321) (secondary; Google's FAQ holds the authoritative list)

**Gmail and Calendar sync at scale**
- Gmail push uses Cloud Pub/Sub; grant publish rights to `gmail-api-push@system.gserviceaccount.com`; "You must call the watch method at least once every 7 days" (Google recommends daily); "maximum notification rate of one event per second" per watched user, excess dropped; payload carries only the email address and new `historyId`; call `history.list` from the last stored historyId; fall back to periodic `history.list` because notifications can be delayed or dropped — [Gmail API push guide](https://developers.google.com/workspace/gmail/api/guides/push)
- Nylas: ~$15/month Full Platform including 5 connected accounts, then $1.50–$2 per extra account/month (sources conflict); Calendar-only $10/month; enterprise deals estimated $1,500–$6,000/month — [Nylas CLI pricing guide](https://cli.nylas.com/guides/email-api-pricing-models); [Vendr](https://www.vendr.com/marketplace/nylas) (secondary)
- Unipile bills only on connected accounts, pay-as-you-go; one comparison cites $5.50/account/month (11–50 accounts) falling to $3.50 at 5,001+ — [Unipile billing docs](https://developer.unipile.com/v2.0/docs/billing); [OneCal](https://www.onecal.io/blog/the-best-nylas-alternatives) (rates secondary, unverified)

**Managed integration platforms**
- Composio: Free 10,000 tool calls/month; Standard $18/seat/month with 10,000 calls per seat pooled, then $0.005 per extra call; Enterprise adds BYOC, SCIM, audit logs, SIEM streaming; the page lists no dates — [Composio pricing](https://composio.dev/pricing)
- Composio white-labeling: only toolkits with a consent screen (Google, GitHub, Slack) need it; you register your own OAuth app, point its redirect at Composio's callback and create a custom auth config; "Composio's default OAuth app shares quota across all users. Your own app gets a dedicated quota"; existing connections cannot be moved to a new auth config without re-authentication — [Composio white-labeling docs](https://docs.composio.dev/docs/auth-configuration/white-labeling)
- Nango: Free 10 connections; pay-as-you-go $50/month (includes $50 credits), $0.29 per connection, $0.72/hour compute, $0.50/GB egress; Enterprise as low as $0.01/connection/month, self-hosting and BYOC; SOC 2 Type II; HIPAA BAA available — [Nango pricing](https://nango.dev/pricing)

**Microsoft 365**
- Publisher verification needs a verified Microsoft AI Cloud Partner Program (formerly MPN) partner global account, an app registered with an Entra work account, and a publisher domain matching a DNS-verified domain; "Microsoft doesn't charge developers for publisher verification"; since Nov 2020, with risk-based step-up consent enabled, users can't consent to multitenant apps registered after 8 Nov 2020 that are not publisher verified and request more than basic sign-in/profile permissions; Microsoft 365 App Certification is a separate, deeper program (page updated 15 Jun 2026) — [Microsoft Learn: Publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview)

### Inferences
- **Discrepancy to check:** the repo's own `agentic-crm/COGS.md` budgets Composio at ~$0.0003 per call and a $29 "Composio Pro" plan, but Composio's current pricing page shows $18/seat Standard and $0.005 per extra call. At ~1,600 calls per person/month (COGS.md's figure) the current list price could be much higher than modelled once included calls run out; re-verify against the account's actual plan.
- In the per-customer Railway model, using Composio's shared Google app avoids the company doing CASA itself, but a white-label SaaS that wants its own consent screen, its own quota and Gmail read/modify scopes must budget restricted-scope verification + annual CASA AL1 (low thousands of dollars/year and ~1–2+ months, per the sources) and keep `gmail.send`-only features separate where possible (sensitive scope, no CASA).
- For Gmail sync at thousands of mailboxes: Pub/Sub watch + daily re-watch + history.list, driven by a per-tenant job queue (section 3), is the documented pattern; Nylas/Unipile charge per connected account (~$1.50–$5.50/month) to take that over.
- Paragon, Merge, Pipedream Connect and Arcade could not be priced in this pass (see Gaps).

### Gaps
- Merge, Paragon, Pipedream Connect and Arcade pricing/features not researched.
- Google's authoritative restricted/sensitive scope list and Calendar scope classification not fetched (Calendar scopes are generally Sensitive, not Restricted, but this was not verified here).
- Whether Composio's shared Google app itself holds CASA for restricted Gmail scopes was not found in its docs.
- Exact CASA lab prices are not published by any lab; all figures are second-hand.

## 5. Data: Postgres hosting, vector search, full-text search, per-tenant backups, export/deletion, audit logs

### Takeaway
Neon (page updated 4 Nov 2026) prices compute at $0.106/CU-hour (Launch) and storage at $0.35/GB-month, with scale-to-zero, no monthly minimum, and a worked example of ~$0.85/tenant/month for 100 lightly used tenant databases. Supabase Pro is $25/month + compute ($10 Micro to $3,730 16XL), with SOC 2/HIPAA only on Team ($599/month) and above. Railway prices memory at ~$10/GB-month and vCPU at ~$20/month, and caps Pro at 100 projects. pgvector 0.8 added iterative index scans that fix filtered (per-tenant) ANN queries, but RLS filters are not visible to the planner for index choice.

### Cited Findings
**Postgres hosting**
- Neon: Launch $0.106/CU-hour, Scale $0.222/CU-hour, storage $0.35/GB-month, no monthly minimum, no per-project fee; projects: 100 (Free/Launch), 1,000 (Scale, more on request); scale-to-zero after 5 min; instant restore $0.20/GB-month; snapshots $0.09/GB-month; example: 100 tenant DBs at 0.25 CU ~1 h/day and 150 MB each ≈ $85/month (~$0.85/tenant); "Agent Plan" for platforms provisioning DBs at scale (up to $25,000 paid-tier credits); page last updated 4 Nov 2026 — [Neon pricing](https://neon.com/pricing)
- Supabase: Pro from $25/month incl. $10 compute credit (one Micro); compute Micro $10 (1 GB), Small $15, Medium $60, Large $110 (2 dedicated vCPU, 8 GB), XL $210 … 16XL $3,730; 8 GB disk included then $0.125/GB; PITR $100/month per 7 days of retention; SOC 2 and HIPAA (paid add-on) only on Team (from $599/month) and Enterprise — [Supabase pricing](https://supabase.com/pricing)
- Railway: Hobby $5, Pro $20/workspace (includes that much usage); ~$20 per vCPU-month, ~$10 per GB RAM-month, $0.15 per GB volume-month, $0.05/GB egress, billed per second; Pro limit 100 projects and 100 services (Enterprise by agreement) — [Railway pricing](https://railway.com/pricing)
- PlanetScale advertises "$50 Metal Postgres databases" (banner only) — [PlanetScale](https://www.planetscale.com/vitess) (not verified further)

**Vector and search**
- pgvector 0.8.0 (Nov 2024) added iterative index scans (`hnsw.iterative_scan`, `ivfflat.iterative_scan`) so filtered ANN queries keep scanning until enough rows pass the filter, capped by `hnsw.max_scan_tuples` (20,000 default); not automatic — [PostgreSQL.org: pgvector 0.8.0 released](https://www.postgresql.org/about/news/pgvector-0.8.0-released-2952/); [pgEdge docs mirror](https://docs.pgedge.com/pgvector/v0-8-0/iterative-index-scans/)
- With RLS, the planner may not see the tenant filter when choosing between a full-table HNSW index and a per-tenant partial index; fix is an explicit `WHERE tenant_id = ...` alongside RLS; per-tenant partial indexes do not scale to ~1,000 tenants — [pg_trickle blog: multi-tenant vector search with RLS](https://pgxn.org/dist/pg_trickle/0.36.0/blog/multi-tenant-vector-search-rls.html); [Render: multi-tenant RAG with pgvector](https://render.com/articles/multi-tenant-rag-postgresql-pgvector) (secondary; verify with EXPLAIN)

**Backups, audit logs**
- Neon lists per-customer PITR as a reason for project-per-tenant; schema-per-tenant limits per-customer PITR — [Neon multitenancy guide](https://neon.com/docs/guides/multitenancy)
- WorkOS Audit Logs: $125/month per SIEM stream, $99/month per 1M events retained — [WorkOS pricing](https://workos.com/pricing)

### Inferences
- In a pooled DB, "restore one tenant" means restoring a snapshot to a side branch (Neon branching makes this cheap) and copying that tenant's rows back; per-tenant export/deletion become tenant_id-scoped jobs. This is the main operational loss vs. DB-per-tenant (inference).
- Hybrid option consistent with Neon's guidance: pooled DB for the standard tier and a Neon project per tenant for enterprise silo customers, both with the same schema and migration pipeline.
- Postgres full-text search (`tsvector` + GIN with tenant_id leading in a composite index or as a partition key) is adequate for CRM-scale search; not separately sourced here.

### Gaps
- AWS RDS/Aurora pricing and Aurora Serverless v2 scale-to-zero not researched.
- PlanetScale Postgres pricing and feature set not verified.
- Full-text search options (Postgres FTS, ParadeDB/pg_search, Typesense) not researched.
- No primary source on GDPR-grade per-tenant deletion from backups.

## 6. Messaging channels: Telegram, Twilio A2P 10DLC as an ISV, Slack distribution

### Takeaway
Twilio requires an ISV to register itself and then each customer as a secondary brand with its own campaign: roughly $4–$46 per brand one-time plus $15 campaign vetting and $1.50–$10/month per campaign, and about a week for approval. Slack Marketplace listing needs 10+ active workspace installs and a review of up to 10 weeks, and non-Marketplace apps have been limited to 1 request/minute on `conversations.history`/`replies` since 2025 (existing installs since 3 Mar 2026). Telegram limits a bot to ~30 messages/second overall, 1/second per chat and 20/minute per group.

### Cited Findings
**Twilio A2P 10DLC (ISV)**
- ISVs register as "ISV," create a Customer Profile for themselves and secondary customer profiles for end customers; Standard: $44 one-time brand registration, $15 one-time campaign vetting, $1.50–$10 per campaign per month (for >6,000 segments/day); Low-volume standard (<6,000 segments/day): $4 brand registration; Sole proprietor (no EIN): $4 brand, $2/month campaign; Twilio estimates "under one week to get campaign approval" — [Twilio 10DLC page](https://www.twilio.com/en-us/phone-numbers/a2p-10dlc)
- Fee change effective 1 Aug 2025: brand registration $4.00 → $4.50; standard (secondary) vetting $40.00 → $41.50; vetting appeal $10 → $11 (so a Standard brand totals $46) — [Twilio: Pricing and fees for A2P 10DLC](https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service); the 10DLC product page still shows the older $44/$4 figures (conflict)
- "Each Secondary Brand will require a $41.50 fee" for secondary vetting; the Low Volume Brand option lets ISVs skip secondary vetting — [Twilio help: Secondary vetting](https://help.twilio.com/articles/4403988619163-Secondary-Vetting-for-A2P-10DLC) (from search snippet; page did not render on fetch)
- ISVs should register customers as secondary brands by organization type; fees and throughput reflect each customer's org and use case — [Twilio nonprofit and government guide](https://help.twilio.com/articles/4405850570267-Nonprofit-and-Government-Guide-to-A2P-10DLC-Text-Messaging)

**Slack**
- Marketplace: app must be installed on 10+ active workspaces (active = used in past 28 days); preliminary review up to 10 business days; functional review "up to 10 weeks for new submissions"; Slack cannot accelerate; restricted scopes include `admin.*` and `search:read` — [Slack Marketplace review guide](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide)
- From 29 May 2025, newly created non-Marketplace apps and new installs are limited to 1 request/minute on `conversations.history` and `conversations.replies`, with `limit` max/default 15 objects; existing installs of non-Marketplace apps became subject on 3 Mar 2026 (moved from 2 Sep 2025); internal customer-built apps are excluded — [Slack changelog, 29 May 2025](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps); [Slack terms/rate-limit FAQ](https://api.slack.com/changelog/2025-05-terms-rate-limit-update-and-faq)

**Telegram**
- Bot limits: avoid more than 1 message/second in a single chat; max 20 messages/minute in a group; ~30 messages/second for bulk notifications; paid broadcasts allow up to 1,000/s at 0.1 Stars per message above 30/s, requiring 100,000 Stars balance and 100,000 monthly active users; webhooks and getUpdates are mutually exclusive; webhook ports 443/80/88/8443 — [Telegram Bots FAQ](https://core.telegram.org/bots/faq)

### Inferences
- Telegram: one platform bot with per-user account linking (deep-link `/start <token>`) keeps a single webhook and token; a bot per tenant (each tenant creating a bot in @BotFather and pasting its token) gives white-label naming and separate 30 msg/s budgets but multiplies webhooks and token storage. At CRM message volumes the 30 msg/s platform limit is unlikely to bind early (inference).
- SMS as an ISV: budget per customer ~$19.50–$61 one-time (brand + vetting + campaign vetting) plus $1.50–$10/month per campaign plus per-message carrier fees; approval latency (~1 week) belongs in onboarding UX.
- Slack: agent features that read channel history need Marketplace approval (10 installs first) or must be installed as a customer's internal app to avoid the 1 req/min limit.

### Gaps
- Telegram's current position on one-bot-per-tenant or "managed bots" for platforms not found in the FAQ.
- Twilio per-message carrier fees and current throughput tiers by brand score not fetched.
- Microsoft Teams app store review not researched.

## 7. Compliance and trust: SOC 2 Type I/II path and cost, GDPR DPA, subprocessors

### Takeaway
A first SOC 2 for a small SaaS typically costs a compliance platform at ~$7.5k–$15k/year plus an auditor at ~$15k–$45k for Type II (estimates from vendor and consultant blogs); Type I first, then a Type II observation period, is the common path. GDPR Art. 28 requires a processor contract (DPA) and prior written authorization (specific or general, with notice of changes) for sub-processors, which is why SaaS vendors publish subprocessor lists.

### Cited Findings
- Auditor fees for a startup Type II: $15,000–$45,000 in one guide; $20,000–$40,000 for a first Type II at <50 employees in another; boutique firms $18,000–$40,000 — [Agency blog](https://blog.getagency.com/articles/soc-2-audit-cost-for-startups); [SOC2Auditors](https://soc2auditors.org/insights/soc-2-type-2-audit-cost/) (secondary)
- Platform pricing is quote-based; a 2026 comparison lists Drata $7.5k–$15k/year and Vanta $10k–$15k/year for startup tiers; buyers report using a Secureframe quote to get 20–30% off Vanta/Drata — [Techplained](https://www.techplained.com/best-soc2-compliance-tools); [Costbench](https://www.costbench.com/compare/drata-vs-vanta/) (secondary)
- Drata's own worked example for a 25-person startup totals ~$28,000 — [Drata: SOC 2 audit cost](https://drata.com/blog/soc-2-audit-cost); a Vanta-focused pricing page says a first SOC 2 can reach $80,000–$120,000+ — [UnderDefense, 2 Jul 2026](https://underdefense.com/blog/vanta-pricing/) (vendor/secondary)
- GDPR Art. 28(2): "The processor shall not engage another processor without prior specific or general written authorisation of the controller"; with general authorization the processor must inform the controller of intended changes so it can object. Art. 28(3) requires a contract covering processing only on documented instructions, confidentiality, Art. 32 security, sub-processor conditions, assistance with data-subject rights, deletion or return of data at the end of service, and audits — [GDPR Art. 28](https://gdpr-info.eu/art-28-gdpr/)
- Vendor compliance status relevant to the subprocessor list: Nango SOC 2 Type II and HIPAA BAA — [Nango pricing](https://nango.dev/pricing); Supabase SOC 2 only on Team/Enterprise — [Supabase pricing](https://supabase.com/pricing); Clerk SOC 2 report on Business plan — [Clerk pricing](https://clerk.com/pricing)

### Inferences
- Budget for year one: ~$25k–$60k all-in for SOC 2 Type I then Type II at a seed-stage company (inference from the ranges above; actual quotes vary widely).
- CASA AL1 (section 4) and SOC 2 overlap heavily (both ASVS-style controls); doing SOC 2 controls first makes CASA evidence cheaper (inference).
- The pooled rebuild collapses N Railway projects into one environment, which shrinks SOC 2 scope (one set of access controls, logging, backups) compared with auditing a fleet of per-customer deployments (inference).
- Subprocessor list for this stack would include at least: hosting (Railway or successor), Postgres host, OpenAI, Composio (or Nango), auth provider, Stripe, email/SMS providers, durable-execution vendor, LLM gateway/observability vendor.

### Gaps
- Secureframe pricing and Vanta/Drata current list prices are not public.
- No primary source on typical SOC 2 timelines (Type II observation windows of 3–12 months are common but not sourced here).
- EU data residency requirements (e.g., EU-hosted DB tier) not researched.

## 8. Unit economics: pooled multi-tenancy vs container + database per customer

### Takeaway
The product's own measurements put each Railway app + Postgres pair at $5/month idle and $8–$12 in use, and Railway Pro caps a workspace at 100 projects, so the per-customer model has a hard fleet ceiling and a floor cost of $5+ per customer before any AI spend. Pooled hosting turns that into a mostly fixed cost shared across tenants (Neon's own example: ~$0.85/tenant/month even for DB-per-tenant with scale-to-zero). AI model spend (~$0.10/run in the internal COGS model) dominates COGS either way, so the bigger wins of pooling are operational (one deploy, one migration, one SOC 2 scope) rather than raw hosting dollars.

### Cited Findings
- Internal measurement (UGCMediakits workspace): app 0.37 GB memory, 0.02 vCPU; database 0.11 GB memory, 0.9 GB disk; cost "$5 idle, $8 to $12 in use" per workspace; AI ~$0.10/run; COGS per seat $10.80–$74.30 depending on run volume; Railway share ~$2/seat for a $10 workspace over 5 seats — `agentic-crm/COGS.md` in this repo (internal, not independently verified)
- Railway resource prices: ~$10/GB-month memory, ~$20/vCPU-month, $0.15/GB-month volume; Pro plan limit 100 projects per workspace — [Railway pricing](https://railway.com/pricing)
- Neon DB-per-tenant example: 100 tenants at ~$0.85/tenant/month; idle databases scale to zero so add no compute cost (storage still billed) — [Neon pricing](https://neon.com/pricing)
- Supabase single shared project: Pro $25 + compute (e.g., Small $15 or Medium $60/month) — [Supabase pricing](https://supabase.com/pricing)
- Microsoft: dedicated per-tenant infrastructure means "100 tenants probably require 100 times that cost," while shared deployments are "often still lower" even after upsizing — [Microsoft Learn: Tenancy models](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)

### Inferences
- Per-customer floor today: ~0.5 GB RAM resident per app+DB pair ≈ $5/month at Railway's $10/GB-month, i.e. ~$500/month for 100 customers before any traffic, and the 101st customer needs a second Railway workspace or Enterprise (derived from Railway prices + COGS.md measurements).
- Pooled estimate (illustrative, not sourced as a quote): 2 app replicas × 1 GB + a worker 1 GB on Railway ≈ $30–$60/month, plus a shared Postgres (Neon Launch or Supabase Pro + Small/Medium) ≈ $25–$85/month, totals ~$60–$150/month for the first few hundred small tenants — i.e. ~$0.30–$1.50/tenant at 100–200 tenants vs. $5–$12/tenant today. Durable execution (Trigger.dev Pro $50 or Inngest Pro $99) and auth (Clerk Pro $25) add fixed cost that pooling amortizes.
- Because AI runs (~$0.10 each) are 70–95% of per-seat COGS in the internal model, per-tenant LLM metering, budgets and prompt caching (section 3) matter more to margin than the hosting move.
- Fixed costs that appear only with a true SaaS: CASA AL1 (~$0.5k–$5k/year), SOC 2 (~$25k–$60k year one), Twilio ISV registration per SMS customer, possibly Slack Marketplace review time. These are per-company, not per-tenant, so they also favour pooling.

### Gaps
- No public benchmark found for "typical hosting cost per tenant" for small-scale SaaS CRMs; figures above are derived.
- Railway Enterprise limits/pricing beyond 100 projects not published.
- Actual OpenAI per-run cost for `gpt-5.6-terra` is unverified in the internal COGS doc.
