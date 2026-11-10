# Magpie CRM today: tenancy, hosting, control plane and feature inventory

Local codebase study at git HEAD `59dfc544` ("Message your Bot on Telegram", 2026-11). Every source below is a local file; link paths are relative to `/home/user/RPGCRM2/agentic-crm/` unless they start with `.github/` (repo root `/home/user/RPGCRM2/`). The Twenty fork in the repo root's `packages/` is a separate AGPL product that shares no code with Magpie ([README.md](README.md)); it is out of scope here.

## 1. What is a tenant today, and how is it hosted?

### Takeaway
A tenant ("workspace") is one whole deployment: its own Railway project holding one app container and one Postgres database, run from a shared image. Nothing in the database schema names a tenant; the code assumes one company per process and per database ("One instance per customer ... no multi-tenant code").

### Cited Findings

**Architecture decision**
- PLAN.md's architecture table: "Hosting | One instance per customer | Simple isolation, no multi-tenant code" — [PLAN.md](PLAN.md)
- FEATURES.md lists "Several workspaces in one install (run one instance per customer)" and "Custom domains per workspace" under deliberately out of scope — [FEATURES.md](FEATURES.md)
- The stack is OpenDuet (CopilotKit's agent platform, MIT: Bun, Hono, React 19, TanStack Router, Postgres via Drizzle, Better Auth) hosting Atomic CRM's (marmelab, MIT) react-admin screens at `/crm`. CRM data sits in a separate `crm` Postgres schema with its own migrations — [README.md](README.md), [PLAN.md](PLAN.md)
- Vendor snapshots are pinned: OpenDuet `60fd4c7` and Atomic CRM `1d96561` (2026-10-27), synced with `scripts/sync-vendor.sh`. Magpie's changes are made directly inside the vendor folders — [README.md](README.md)

**Hosting shape, Railway path (production sign-ups)**
- The provisioner creates one Railway project per sign-up named `magpie-<slug>` with a `production` environment ([platform/src/railway.ts](platform/src/railway.ts)). In it:
  - a `postgres` service on image `pgvector/pgvector:pg18`, with a volume at `/var/lib/postgresql/data`, user and database `crm`, and `RAILWAY_RUN_UID=0`;
  - an `app` service from `WORKSPACE_IMAGE` with `healthcheckPath: /health`, `healthcheckTimeout: 600`, `restartPolicyType: ON_FAILURE` and at most 3 retries;
  - a domain `magpie-<slug>.up.railway.app` on port 3001. If that name is taken, it falls back to the domain Railway generated.
- The database password is not stored. It is derived as `hmacHex(PLATFORM_SECRET, "database:<workspace id>")` — [platform/src/provision.ts](platform/src/provision.ts)
- `WORKSPACE_IMAGE` defaults to `ghcr.io/tayoaki/magpie-crm:edge`. Pinning `:sha-<commit>` controls when customers update — [platform/README.md](platform/README.md), [platform/src/config.ts](platform/src/config.ts)
- The image is built by `.github/workflows/magpie-image.yaml`:
  - on every push touching `agentic-crm/**`, except `*.md`, `platform/**` and `sample-data/**`;
  - tagged `sha-<commit>`, `edge` on the default branch, and `<version>` for `magpie-v*` tags;
  - `linux/amd64` only, with a 90-minute timeout;
  - from Dockerfile `agentic-crm/deploy/railway/Dockerfile`.
  — [.github/workflows/magpie-image.yaml](.github/workflows/magpie-image.yaml)
- `deploy/railway/make-dockerfile.ts` generates the Railway Dockerfile from OpenDuet's. It makes Atomic CRM's sources and a default Magpie tenant package into stages, and adds `deploy/railway/migrate.sh` and `first-admin.ts` — [deploy/railway/make-dockerfile.ts](deploy/railway/make-dockerfile.ts)

**One container, many processes (s6-overlay)**
- The image runs s6-overlay as the entrypoint (`ENTRYPOINT ["/init"]`). s6 was chosen over supervisord so the container dies when a supervised process dies — [deploy/railway/Dockerfile](deploy/railway/Dockerfile)
- The s6 services are in `openduet/openbot/docker/s6/s6-rc.d/`:
  - `postgres`: off unless `EMBEDDED_POSTGRES=on`;
  - `postgres-init`;
  - `migrate` (oneshot);
  - `worker-secret` (oneshot): generates `WORKER_SHARED_SECRET` into the container env if unset;
  - `computer-token`;
  - `computer`: the Bot's Playwright browser on loopback port 4100, on by default (`EMBEDDED_COMPUTER` defaults to `on`);
  - `api`: `bun src/index.ts` as `apiuser`;
  - `worker`: fires due routines every 30 s through `POST /internal/routines/run`.
  — [openduet/openbot/docker/s6/s6-rc.d/computer/run](openduet/openbot/docker/s6/s6-rc.d/computer/run), [openduet/openbot/docker/s6/s6-rc.d/worker/run](openduet/openbot/docker/s6/s6-rc.d/worker/run), [openduet/openbot/docker/s6/scripts/worker-secret.sh](openduet/openbot/docker/s6/scripts/worker-secret.sh)
- The Railway `migrate.sh` runs `scripts/migrate.ts` on every start ("Railway runs one replica against its own Postgres, so migrating on start can't race another replica"). Then `first-admin.ts` prints the first admin's set-password link once — [deploy/railway/migrate.sh](deploy/railway/migrate.sh), [deploy/railway/first-admin.ts](deploy/railway/first-admin.ts)
- The README says that on Railway "The assistant's computer runs inside the app's container ... so this is for testing rather than customers" — [README.md](README.md). Possible conflict:
  - the platform's `appVariables` never set `EMBEDDED_COMPUTER` ([platform/src/provision.ts](platform/src/provision.ts)), and the image defaults it to on;
  - COGS.md says the Bot computer is "not on customer workspaces yet" ([COGS.md](COGS.md)).

**Hosting shape, Docker Compose path (self-managed customers)**
- `deploy/new-customer.ts --customer --domain --admin [--name --assistant --logo --color]` writes `deploy/customers/<customer>/.env` with fresh secrets and a branded tenant package ([deploy/new-customer.ts](deploy/new-customer.ts)). The secrets are `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `KEY_ENCRYPTION_KEY`, `AGENT_TOOL_TOKEN` and `COMPUTER_TOKEN`.
- `up.sh <customer>` runs `docker compose -p crm-<customer>`, then prints the first admin's link once — [deploy/up.sh](deploy/up.sh)
- `compose.yml` has these services:
  - `db`: `pgvector/pgvector:pg17`;
  - `migrate`: a release step before the app;
  - `app`: OpenDuet with the CRM, built locally from source;
  - `computer`: its own container on a `bots` network without the database;
  - `caddy`: HTTPS.
  Several customers on one machine need `HTTP_PORT`/`HTTPS_PORT` and an external proxy. Backups are a manual `pg_dump` — [deploy/compose.yml](deploy/compose.yml), [README.md](README.md)
- The two paths use different Postgres majors: 17 in compose, 18 on Railway — [deploy/compose.yml](deploy/compose.yml), [platform/src/railway.ts](platform/src/railway.ts)

**Database schema: no tenant key**
- The OpenDuet core tables in the `public` schema carry no organization or tenant column:
  - `users`, `sessions`, `accounts`, `user_roles`, `agents`, `channels`, `credentials`, `audit_events`, `routines`, `approval_requests`, `delivery_bindings`, `personal_memories`, `work_items`, etc.;
  - the only such-named columns are `sso_providers.organization_id`, a Better Auth field, and `deployment_packages.tenant_id`, which records which tenant package was loaded.
  — [openduet/openbot/server/src/db/schema/core.ts](openduet/openbot/server/src/db/schema/core.ts) (lines ~238, ~263)
- `users.email` is globally unique, and `user_roles` uses a deployment-wide enum `role` = `admin | user` — [openduet/openbot/server/src/db/schema/core.ts](openduet/openbot/server/src/db/schema/core.ts)
- CRM tables (`crm` schema):
  - `sales` (CRM users, linked to `users.id`, with `role_id`), `companies`, `contacts`, `contact_notes`, `deals`, `deal_notes`, `tags`, `tasks`, `meetings`, `proposals`, `emails`, `mailboxes`, `deal_stage_history`, `files` (bytea), `installs`, `configuration`;
  - `record_events`, `workflows`, `workflow_runs`, `workflow_firings`;
  - `objects`, `fields`, `records`, `record_notes`, `roles`, `views`, `api_keys`, `scim_tokens`, `dashboards`, `bids`;
  - SQL views `companies_summary`, `contacts_summary` and `activity_log`.
  None has a tenant column. — [openduet/openbot/server/src/crm/schema.ts](openduet/openbot/server/src/crm/schema.ts)
- Single-tenant shapes baked into the CRM schema:
  - `crm.configuration` is a singleton row (`id integer primary key default 1`, one `config` JSONB). It holds the company settings, the business brief (`business_brief`), the prospecting spend ledger (`prospecting_spend`) and the GovCon profile;
  - `crm.objects` has `name` as its primary key;
  - `crm.installs` records one-time setup "already done in this deployment".
  — [openduet/openbot/server/src/crm/schema.ts](openduet/openbot/server/src/crm/schema.ts), [openduet/openbot/server/src/crm/business/brief.ts](openduet/openbot/server/src/crm/business/brief.ts), [openduet/openbot/server/src/crm/prospecting/settings.ts](openduet/openbot/server/src/crm/prospecting/settings.ts)
- Migrations: 69 OpenDuet files in `server/drizzle/`, up to `0067_morning_brief_on.sql`, and 15 CRM files in `server/drizzle-crm/` (`0000_crm_tables` to `0014_govcon_bids`). `scripts/migrate.ts` applies OpenDuet's, then `applyCrmMigrations` — [openduet/openbot/server/scripts/migrate.ts](openduet/openbot/server/scripts/migrate.ts), [README.md](README.md)

**Users, roles and ownership scoping**
- Two role layers:
  - OpenDuet's `user_roles` (admin/user), for the assistant side and Admin screens;
  - CRM roles in `crm.roles.rules` JSON, assigned through `crm.sales.role_id`. Per object, read, update and delete each reach `none | own | all` (own = the row's `sales_id`) and create is a boolean. Per field, a field is `hidden | read_only`. Admins and people with no role get full access.
  — [openduet/openbot/server/src/crm/access.ts](openduet/openbot/server/src/crm/access.ts), [openduet/openbot/server/src/crm/schema.ts](openduet/openbot/server/src/crm/schema.ts)
- Default visibility: "Everybody signed in reads and edits all records, as in Atomic. Only admins change the CRM's settings". A person's CRM user is created on their first visit — [README.md](README.md)
- Enforcement is one records layer, `server/src/crm/records.ts`, for the API, views, search, export, workflows and agent tools (G4) — [FEATURES.md](FEATURES.md)
- `ownerUserId`/`owner_user_id` appears 56 times across 13 OpenDuet schema files: plugins, passwords, group, demonstrations, memory, coworker/routines, proactive, responsibilities, defaults, approvals, delivery, lifecycle and openduet pages/tasks. Assistant-side objects (routines, approvals, memories, delivery bindings, Make pages) are scoped per person inside the deployment, not per tenant — grep of [openduet/openbot/server/src/db/schema/](openduet/openbot/server/src/db/schema/)

**In-process state that assumes one tenant per process**
- Configuration is parsed once from env at boot: `config.ts` is 1,594 lines and holds `deploymentId`, the Composio and Arcade keys, prospecting (`TREG_API_KEY`, budget), GovCon (`KONTRACT_URL`, key, budget) and auth. It refuses to boot without `KEY_ENCRYPTION_KEY` (a 32-byte base64 key that encrypts the deployment's credential vault) and the Intelligence contract — [openduet/openbot/server/src/config.ts](openduet/openbot/server/src/config.ts) (~lines 521, 1425–1445)
- The tenant package (name, Bots, skills, model, channels) is loaded once at boot (`const tenantPackage = await loadTenantPackage(...)`, [openduet/openbot/server/src/index.ts](openduet/openbot/server/src/index.ts) ~line 454). "The name and logo are read when the app is built", so branding is baked into each image build ([README.md](README.md)).
- CRM background loops run in the API process ([openduet/openbot/server/src/crm/services.ts](openduet/openbot/server/src/crm/services.ts)), with leases owned by `${hostname()}:${process.pid}`:
  - send due mail and mark proposals sent, every 30 s;
  - read IMAP inboxes, every 5 min;
  - dispatch and run workflow events, every 3 s;
  - date and schedule sweeps, every 60 s;
  - event purge, every 6 h.
- The routine worker is one loop per container against one `DATABASE_URL`, every 30 s, with an hourly queue purge — [openduet/openbot/worker/src/index.ts](openduet/openbot/worker/src/index.ts)
- `setInterval` timers live in 8 server files: `admin/controls.ts`, `agents/handoff-runner.ts`, `agents/lifecycle.ts`, `delivery/opentag.ts`, `proactive/engine.ts`, `channels/stall-guard.ts`, `audit-retention.ts` and `learning/auto-assign.ts` — grep of [openduet/openbot/server/src/](openduet/openbot/server/src/)
- `AsyncLocalStorage` scopes (run, turn and approval context, not tenant) are in `approvals/service.ts`, `openduet/run-channel.ts`, `openduet/reply-turn.ts`, `auth/email-password.ts` and `crm/sso-origins.ts` — grep of [openduet/openbot/server/src/](openduet/openbot/server/src/)
- The public API's rate limit is an in-memory `Map` per key, at 600 requests a minute (`REQUESTS_PER_MINUTE`) — [openduet/openbot/server/src/crm/public-api.ts](openduet/openbot/server/src/crm/public-api.ts)
- Module-level caches include `routines/schedule.ts` (`timeZoneVerdicts`, `floorVerdicts`) and `desktop-connection-failure.ts` — grep
- Identity bound to the deployment:
  - Intelligence thread ids embed a 6-byte SHA-256 fingerprint of `DEPLOYMENT_ID` ([openduet/openbot/server/src/channels/thread-identity.ts](openduet/openbot/server/src/channels/thread-identity.ts));
  - Telegram's webhook is registered at boot from the deployment's one `TELEGRAM_BOT_TOKEN` ([openduet/openbot/server/src/index.ts](openduet/openbot/server/src/index.ts) ~line 2108);
  - Better Auth has a single `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` per deployment ([platform/src/provision.ts](platform/src/provision.ts)).

**Per-customer secrets and config**
- Every Railway workspace gets these as Railway service variables from `appVariables()` ([platform/src/provision.ts](platform/src/provision.ts)):
  - URLs: `PORT=3001`, `DATABASE_URL` (via `${{postgres.RAILWAY_PRIVATE_DOMAIN}}`), `OPENBOT_PUBLIC_URL`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `APP_PUBLIC_URL`;
  - fresh secrets: `BETTER_AUTH_SECRET`, `KEY_ENCRYPTION_KEY`, `AGENT_TOOL_TOKEN`;
  - first owner: `SIGNIN_EMAIL_PASSWORD=true`, `INITIAL_ADMIN_EMAILS`, `WORKSPACE_OWNER_EMAIL/NAME`, `WORKSPACE_SETUP_TOKEN`;
  - switches: `OPENBOT_SELF_HOST_BANNER=false`, `COPILOTKIT_TELEMETRY_DISABLED=true`;
  - Intelligence URLs;
  - "fleet" variables `DEPLOYMENT_ID=magpie-<slug>`, `OPENBOT_LEARNING_AUTO_ASSIGN=false` and `OPENBOT_SETUP_COMING_SOON=google,gmail,chat`, plus the shared keys.
- Per-deployment env the platform does not set, so it is configured by hand per workspace:
  - `TELEGRAM_BOT_TOKEN`;
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`;
  - `OPENTAG_URL`, `OPENTAG_SHARED_SECRET`;
  - `EXPO_ACCESS_TOKEN`;
  - `KONTRACT_URL`, `KONTRACT_SERVICE_KEY`;
  - `PROSPECTING_MONTHLY_BUDGET_USD`, `GOVCON_MONTHLY_BUDGET_USD`;
  - `OPENBOT_INBOUND_EMAIL_DOMAIN`.
  — [openduet/openbot/server/src/delivery/routes.ts](openduet/openbot/server/src/delivery/routes.ts) (~lines 451–520), [openduet/openbot/server/src/config.ts](openduet/openbot/server/src/config.ts), [APP_MAP.md](APP_MAP.md)
- Admin-entered secrets live in each workspace's `credentials` table, encrypted with that workspace's `KEY_ENCRYPTION_KEY`: the model key, the Google OAuth client for the Gmail/Calendar connector, and API keys for "authenticated" Firecrawl, Exa and Parallel (`auth: { kind: "deployment-bearer" }`) — [APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/plugins/catalogue.ts](openduet/openbot/server/src/plugins/catalogue.ts)

**Migrations and upgrades across customers**
- A release reaches customers only through the sign-up service's `rollout()` ([platform/src/provision.ts](platform/src/provision.ts), [platform/src/index.ts](platform/src/index.ts)):
  - it runs only when that service starts (`void provisioning.rollout()`);
  - for each `ready` workspace in creation order, it compares `railway.image` and an HMAC fingerprint of the fleet variables;
  - it calls `setVariables` and/or `setImage`, then `deploy`, one workspace at a time;
  - a failure is logged and skipped.
- Railway switches a workspace only after the new release passes `/health`, so "a release that doesn't start leaves customers on the old one". The operator is told to "try the image on your own CRM, then set `WORKSPACE_IMAGE`" — [platform/README.md](platform/README.md)
- Each workspace migrates its own database at container start, before the API starts (s6 `migrate` oneshot) — [deploy/railway/migrate.sh](deploy/railway/migrate.sh)

**Cost floor per tenant (COGS.md, October 2026 prices)**
- Railway app plus database costs $5 a month idle and $8 to $12 in use. Measured on the UGCMediakits workspace:
  - app: 0.37 GB memory, 0.02 vCPU;
  - database: 0.11 GB memory, 0.9 GB disk;
  - Railway rates: $10/GB memory, $20/vCPU, $0.15/GB disk a month.
  — [COGS.md](COGS.md)
- The Bot computer, if enabled, costs ~$3 to $6 a month with idle stop and $10 to $20 always on (1 to 2 GB while a browser runs) — [COGS.md](COGS.md)
- Fixed fleet cost is ~$99 a month: Railway Pro $20, CopilotKit Intelligence $49 (10,000 interactions a month across all customers), Composio Pro $29, domain ~$1 — [COGS.md](COGS.md)
- AI is ~85% of a typical seat's cost: ~$0.10 a run, ~230 runs a month, $26.30 per seat. A 14-day trial costs ~$13, and "a 3-person team costs about $87 a month to serve" — [COGS.md](COGS.md)

### Inferences
- The Railway hosting floor of $5 to $12 per tenant per month is small next to AI cost. The per-tenant overhead that matters more is operational: N databases to migrate and back up, and N services to roll out serially from one loop. Per-tenant CopilotKit Intelligence interactions are also capped fleet-wide.
- Several things would break or misbehave if one process served several tenants:
  - the singleton `crm.configuration`;
  - globally unique `users.email`;
  - `crm.objects` keyed by name;
  - boot-time config and tenant package;
  - DEPLOYMENT_ID-derived thread ids;
  - per-process loops scanning one database.
- Several things would break or misbehave with more than one replica per tenant:
  - the in-memory rate limiter;
  - start-up migrations ("can't race another replica");
  - the embedded browser holding per-Bot login profiles on local disk.

### Gaps
- No measured per-tenant Railway bill in the repo other than the single UGCMediakits measurement in COGS.md.
- I could not confirm from code whether platform-provisioned workspaces actually run the embedded browser. Its default is on and the platform does not turn it off, but the docs say it is not offered to customers.
- No load or scale testing data, such as how many workspaces one operator has run.

## 2. What does the control plane (`platform/`) do today, and what is missing?

### Takeaway
`platform/` is a ~1,640-line Bun + Hono sign-up and provisioning service with one table. It creates and resumes Railway projects, hands the owner a set-password link, and pushes image and shared-key updates to existing workspaces. It has no billing, metering, limit enforcement, operator admin, suspension, deletion, backups or per-tenant secret management.

### Cited Findings

**What it does today**
- Stack: Bun, Hono ^4.10, `postgres` ^3.4.9 and Zod; Dockerfile on `oven/bun:1.4.3`, port 3000. It is deployed on Railway as the "web" service — [platform/package.json](platform/package.json), [platform/Dockerfile](platform/Dockerfile), [platform/OAUTH_RELAY.md](platform/OAUTH_RELAY.md)
- Its one table, `platform.workspaces`, has:
  - `id`, `slug` (unique), `company`, `owner_name`, `owner_email`;
  - `status` (`queued | provisioning | ready | failed`), `step`, `error`;
  - `claim_hash`, `setup_token_sealed` (AES-256-GCM with `PLATFORM_SECRET`);
  - `railway` (JSONB of Railway ids made so far, plus `image` and the `fleet` fingerprint), `app_url`, timestamps and `ready_at`.
  — [platform/migrations/0001_workspaces.sql](platform/migrations/0001_workspaces.sql), [platform/src/db.ts](platform/src/db.ts), [platform/src/secrets.ts](platform/src/secrets.ts)
- Routes ([platform/src/app.ts](platform/src/app.ts)):
  - `GET /` (landing page), `/signup`, `/login`;
  - `GET /api/slug/:slug`: availability check;
  - `POST /api/signup`: rate-limited to 5 per IP per hour in an in-memory `Map`, capped at `MAX_WORKSPACES` (default 50), and sets a `magpie_claim` cookie for 30 days;
  - `GET /welcome/:id` and `GET /api/workspaces/:id`: progress, gated by the claim cookie. When the workspace is ready, it fetches the owner's link from the workspace's `POST /api/workspace/owner-link`, authenticated with `WORKSPACE_SETUP_TOKEN`;
  - `POST /api/login`: slug lookup that redirects to `<app_url>/sign`.
- Reserved slugs: admin, api, app, auth, billing, docs, help, login, magpie, mail, signup, status, support, www — [platform/src/signup.ts](platform/src/signup.ts)
- Provisioning steps are `project → database → app → building`. Each step records what it made, so a restart resumes instead of duplicating. The `building` step probes `/health` every 15 s for up to 20 minutes. `resume()` restarts unfinished workspaces on boot. Without `RAILWAY_API_TOKEN`, sign-ups are recorded and wait — [platform/src/provision.ts](platform/src/provision.ts), [platform/README.md](platform/README.md)
- It sends eight Railway GraphQL mutations, checked against Railway's schema by `bun run check:railway`: `projectCreate`, `serviceCreate`, `volumeCreate`, `serviceInstanceUpdate`, `serviceDomainCreate`, `serviceDomainUpdate`, `variableCollectionUpsert` and `serviceInstanceDeployV2` — [platform/src/railway.ts](platform/src/railway.ts), [platform/scripts/check-railway-queries.ts](platform/scripts/check-railway-queries.ts)
- Tests: `tests/app.test.ts` and `tests/provision.test.ts` (fake provisioner) — [platform/tests/](platform/tests/)
- FEATURES A10 (self-serve sign-up) is still "In progress" — [FEATURES.md](FEATURES.md)

**What is missing**
- No Railway delete, pause or suspend mutation exists in `QUERIES`, and no route or store method deletes a workspace. COGS.md wants "Delete trial workspaces 7 days after they lapse" — [platform/src/railway.ts](platform/src/railway.ts), [platform/src/db.ts](platform/src/db.ts), [COGS.md](COGS.md)
- Billing: FEATURES.md puts "Built-in billing (bill through Stripe outside the product)" out of scope. COGS.md §5 lists as to-do "Stripe subscriptions with a seat quantity and run packs. The sign-up service holds the subscription and pauses a workspace's Bots when payment fails". No Stripe code exists in `platform/` — [FEATURES.md](FEATURES.md), [COGS.md](COGS.md)
- Metering and limits: COGS.md §4 says "None of these are enforced yet". That covers runs a month, steps per run, routines per person, Composio triggers, web research pages, lead lookups, browsers, storage, API requests a day and SSO by plan. §5 says to "Meter runs. Count runs and tokens per workspace ... show them in Admin" — [COGS.md](COGS.md)
- Operator admin: the platform has no operator login or admin screen. APP_MAP's "Operator" role has no screens listed beyond the sign-up site — [platform/src/app.ts](platform/src/app.ts), [APP_MAP.md](APP_MAP.md)
- Backups: no automation in the platform. The only documented backup is a manual `docker compose ... pg_dump` for the compose path — [README.md](README.md)
- The Google OAuth relay is planned, not built: one platform return address that forwards to `magpie-<slug>` by `state`, with a `platform.oauth_relays` table and `/oauth/start` and `/oauth/google/callback`. Until then, customer workspaces show Google apps and Gmail as "Coming soon" — [platform/OAUTH_RELAY.md](platform/OAUTH_RELAY.md)
- Rollout runs only at service start, serially, with no canary, staged waves, per-tenant version pinning UI or retry — [platform/src/index.ts](platform/src/index.ts), [platform/src/provision.ts](platform/src/provision.ts)

### Inferences
- The platform is a provisioner plus fleet-config pusher, not a SaaS control plane. Every SaaS concern (account, subscription, plan entitlements, usage, quotas, lifecycle, data export and deletion, support access) is unbuilt.
- With `MAX_WORKSPACES=50` and an in-memory sign-up limiter, the service is sized for a pilot fleet.

### Gaps
- No evidence in the repo of how many live workspaces exist or what the live platform's environment holds; I did not read env files, by instruction.
- No data-retention, GDPR export or deletion policy documents found.

## 3. Which external accounts are shared across tenants, and how is usage attributed?

### Takeaway
The operator's keys for OpenAI, CopilotKit Intelligence (one project for all workspaces), Composio (one project), treg and the CopilotKit license are copied into every workspace. Attribution relies on app-side conventions (`DEPLOYMENT_ID`, per-workspace spend ledgers) rather than vendor-side isolation. Only Kontract meters per workspace on its own side.

### Cited Findings
- `SHARED_WORKSPACE_VARIABLES` = `OPENAI_API_KEY`, `INTELLIGENCE_API_KEY`, `INTELLIGENCE_API_URL`, `INTELLIGENCE_GATEWAY_WS_URL`, `COPILOTKIT_LICENSE_TOKEN`, `COMPOSIO_API_KEY` and `TREG_API_KEY`. They are copied into every workspace and re-pushed by `rollout()` when they change — [platform/src/config.ts](platform/src/config.ts), [platform/src/provision.ts](platform/src/provision.ts)
- CopilotKit Intelligence ([platform/README.md](platform/README.md)):
  - "Workspaces share one CopilotKit Intelligence project. Each gets its own `DEPLOYMENT_ID` so it only sees its own conversations, and automatic Learning is off so one client's learned skills never reach another";
  - "The separation is kept by the app, not by Intelligence: every workspace's server holds a key that can read the whole project".
- Intelligence is mandatory: it "owns durable threads, memory and learning". `config.ts` refuses to boot without it — [openduet/openbot/server/src/copilot.ts](openduet/openbot/server/src/copilot.ts)
- Composio:
  - a person's connections are filed under `vendorUserId = userId`, the workspace's Better Auth user id, with no workspace prefix ([openduet/openbot/server/src/plugins/shared-accounts.ts](openduet/openbot/server/src/plugins/shared-accounts.ts), `personAccount`);
  - deployment-shared accounts use `mintDeploymentVendorUserId(deploymentId)`, which is the deployment prefix plus a random suffix ([openduet/openbot/server/src/plugins/shared-accounts.ts](openduet/openbot/server/src/plugins/shared-accounts.ts)).
- treg (lead data):
  - requests carry `X-Treg-Token` and `X-Treg-Route-Max-Cost`, but no workspace identifier;
  - the cost comes back in `X-Treg-Cost-Micro` and is added to the workspace's own `crm.configuration.prospecting_spend` ledger, capped by `PROSPECTING_MONTHLY_BUDGET_USD`;
  - a non-lookup word list blocks spending on mutating tools.
  — [openduet/openbot/server/src/crm/prospecting/treg.ts](openduet/openbot/server/src/crm/prospecting/treg.ts), [openduet/openbot/server/src/crm/prospecting/settings.ts](openduet/openbot/server/src/crm/prospecting/settings.ts), [COGS.md](COGS.md)
- Kontract (GovCon):
  - one engine at `kontract-production.up.railway.app` serves all workspaces;
  - each call sends `Authorization: Bearer <service key>` and `X-Workspace-Id` = `workspaceIdOf(DEPLOYMENT_ID)`;
  - Kontract records `service_call(workspace_id, endpoint, cost_micro, ...)`, serves `GET /api/v1/usage?workspace=&month=`, and rate-limits per workspace (60/min, 10/min on Claude routes);
  - Magpie adds `X-Kontract-Cost-Micro` to a monthly ledger capped by `GOVCON_MONTHLY_BUDGET_USD` (default 20).
  — [KONTRACT.md](KONTRACT.md), [openduet/openbot/server/src/crm/govcon/kontract.ts](openduet/openbot/server/src/crm/govcon/kontract.ts), [openduet/openbot/server/src/config.ts](openduet/openbot/server/src/config.ts)
- KONTRACT.md says "The service key is set on Kontract and on the sign-up service ... ready for GovCon sign-ups". But `KONTRACT_*` is not in the platform's shared list, and KONTRACT.md also says "They aren't shared to every workspace". GovCon is therefore switched on per workspace by hand — [KONTRACT.md](KONTRACT.md), [platform/src/config.ts](platform/src/config.ts)
- Web research: the Firecrawl, Exa and Parallel catalogue entries come in keyless variants (`auth: none`) and "authenticated" variants with a deployment-entered key — [openduet/openbot/server/src/plugins/catalogue.ts](openduet/openbot/server/src/plugins/catalogue.ts)
- Model usage attribution:
  - `model_usage` records `user_id`, `agent_id`, `thread_id`, `run_id`, `model`, `source` and `allowed` per Bot run, with no tokens or cost columns;
  - Admin shows a per-model summary over N days.
  — [openduet/openbot/server/src/db/schema/admin.ts](openduet/openbot/server/src/db/schema/admin.ts), [openduet/openbot/server/src/admin/settings-store.ts](openduet/openbot/server/src/admin/settings-store.ts)
- COGS.md names CopilotKit pricing beyond 10,000 interactions as "the biggest unknown ... If one interaction is one run, the allowance covers only ~40 typical seats in total" — [COGS.md](COGS.md)
- Per-tenant channel accounts: each workspace needs its own Telegram bot from @BotFather ("so the bot carries the business's name"), and Slack/Teams needs "OpenTag plus each company's own Slack app" — [openduet/openbot/server/src/delivery/telegram.ts](openduet/openbot/server/src/delivery/telegram.ts), [APP_MAP.md](APP_MAP.md)

### Inferences
- OpenAI, Composio and Intelligence spend can only be attributed per tenant from each tenant's own database, and today that database records model runs without tokens. The vendor bills are one pooled line with no per-tenant split. A compromised workspace's Intelligence key exposes every tenant's threads, by the platform README's own statement.
- A multi-tenant rebuild needs:
  - tenant-tagged vendor identities, such as Composio `user_id = <tenant>:<user>`;
  - a central usage ledger fed from the model gateway;
  - either per-tenant Intelligence projects or replacing Intelligence's thread store with Magpie's own.

### Gaps
- No vendor dashboards or invoices in the repo to confirm actual shared-account spend.
- I did not verify whether OpenAI calls pass a `user` or tenant tag. No such header was evident in the files read.

## 4. What would have to change to make Magpie a true multi-tenant SaaS?

### Takeaway
Going from "one Railway project per customer" to one shared fleet means adding a tenant key to every table and query: about 125 tables, 95 `pgTable` definitions in OpenDuet's `server/src/db/schema/*.ts` and 30 `crm.table` definitions in `server/src/crm/schema.ts` (grep counts). It also means making boot-time config, branding and secrets per-request, making the background loops tenant-aware, and building a real control plane. Alternatively, keep isolated data planes and build the missing control plane around them.

### Cited Findings (the things that are single-tenant today)
- Schema: no tenant column on any OpenDuet or CRM table. There is a singleton `crm.configuration`, globally unique `users.email`, and name-keyed `crm.objects` — [openduet/openbot/server/src/db/schema/core.ts](openduet/openbot/server/src/db/schema/core.ts), [openduet/openbot/server/src/crm/schema.ts](openduet/openbot/server/src/crm/schema.ts)
- Enforcement point: all CRM reads and writes already pass through one records layer, `crm/records.ts` with `crm/access.ts` (G4). That is the natural place for a tenant predicate. OpenDuet's own stores (approvals, routines, plugins, memory, delivery) do not go through it — [FEATURES.md](FEATURES.md), [openduet/openbot/server/src/crm/access.ts](openduet/openbot/server/src/crm/access.ts)
- Boot-time singletons:
  - `loadConfig(env)`, including `KEY_ENCRYPTION_KEY`, `DEPLOYMENT_ID` and per-integration keys;
  - `loadTenantPackage` and the build-time brand;
  - Better Auth's single base URL and trusted origins;
  - Telegram webhook registration;
  - Intelligence thread-id fingerprint.
  — [openduet/openbot/server/src/config.ts](openduet/openbot/server/src/config.ts), [openduet/openbot/server/src/index.ts](openduet/openbot/server/src/index.ts), [openduet/openbot/server/src/channels/thread-identity.ts](openduet/openbot/server/src/channels/thread-identity.ts)
- Loops: the CRM mail, IMAP, workflow and sweep loops and the routine worker each scan one database — [openduet/openbot/server/src/crm/services.ts](openduet/openbot/server/src/crm/services.ts), [openduet/openbot/worker/src/index.ts](openduet/openbot/worker/src/index.ts)
- Bot computer: one shared browser per workspace today. A per-Bot computer needs `COMPUTER_SUPERVISOR_URL` (OpenDuet's supervisor, which holds the Docker socket) — [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md), [README.md](README.md)
- Upstream coupling: Magpie edits OpenDuet's files in place and syncs about monthly ("OpenDuet changes fast, so pin it and sync about monthly") — [README.md](README.md), [PLAN.md](PLAN.md)
- The OAuth return-address problem: Google needs exact redirect URIs, and each workspace has its own host. This is why the relay is planned — [platform/OAUTH_RELAY.md](platform/OAUTH_RELAY.md)
- The security pitch relies on isolation: "Each company gets its own isolated project and database ... Nothing is shared between companies" — [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)

### Inferences
**Option A: a shared-everything multi-tenant rebuild.** It needs:
- a `tenant_id` on every table, with Postgres RLS or query-builder enforcement;
- tenant resolution per request (subdomain or session);
- per-tenant config and secrets in a vault table, not env;
- per-request branding;
- tenant-scoped loops and queues, with leases that include the tenant;
- a shared, Redis-backed rate limiter;
- users that can belong to many tenants (email no longer globally unique per tenant membership);
- one shared OAuth app and redirect;
- tenant-tagged vendor identities;
- a migration rewrite of OpenDuet's ~70 migrations. This would effectively fork OpenDuet permanently, since upstream assumes single-tenant.

**Option B: keep cell-per-tenant data planes and build the control plane.** Plausibly cheaper given the $5 to $12 hosting floor. It needs:
- billing (Stripe) and entitlements;
- a central usage ledger and limit enforcement;
- operator admin and impersonation;
- suspension, deletion and backups (Railway volume backups or scheduled `pg_dump`);
- staged rollouts;
- the OAuth relay and a shared Slack/Telegram front;
- per-tenant Intelligence projects or removing Intelligence.

**Hybrid:** pooled cells with schema-per-tenant inside one Postgres. This keeps the code mostly unchanged, since the schema has no tenant column, but still needs boot-time config made per-request.

### Gaps
- No ADR or plan document in the repo weighs multi-tenancy against cell-per-tenant beyond PLAN.md's one-line rationale.
- I did not quantify how many OpenDuet stores bypass the CRM records layer. The 13 schema files with `owner_user_id` suggest the assistant side holds the majority of the state.

## 5. Feature inventory: what is built and what is planned?

### Takeaway
Magpie has a broad, mostly built CRM core: Atomic CRM objects plus a metadata registry, custom objects and fields, table, kanban and calendar views, roles with field-level permissions, workflows, dashboards, a public API, and SSO/SCIM. On top sits a deep agent layer: Bots, tasks, approvals, routines, morning brief, company brief, work plan and Bot teams, prospecting and warm outbound, and GovCon bids. The weakest areas are automatic email and calendar capture into the timeline, built-in Google connectors on customer workspaces, enrichment of existing records, MCP for outside clients, mobile, Slack and Teams, and billing.

### Cited Findings

**CRM data model** (FEATURES B, D, G; [openduet/openbot/server/src/crm/schema.ts](openduet/openbot/server/src/crm/schema.ts))
- Built (B1 to B7, all Done) ([FEATURES.md](FEATURES.md)):
  - standard objects: companies, contacts, deals, tasks and notes, plus meetings, proposals, emails, mailboxes and deal stage history;
  - companies and contacts have `lifecycle_stage`, `lead_source` and a `custom_fields` JSONB; contacts also have `lead_source_detail`, `linkedin_url`, JSON email/phone and a tag array;
  - deals pipeline kanban with configurable stages;
  - tags and bulk tagging;
  - Postgres full-text global search with prefix matching;
  - CSV import and export for contacts, companies and deals;
  - activity log;
  - attachments up to 20 MB stored in Postgres `crm.files`.
- Built, P1 (D1 to D9 Done):
  - metadata registry `crm.objects` and `crm.fields`;
  - 14 field types: text, long_text, number, currency, date, datetime, boolean, select, multi_select, email, phone, url, rating, relation;
  - custom objects as JSONB rows in `crm.records`;
  - table, kanban (drag to change a field) and calendar (month grid) views on any object at `/crm/o/<object>`;
  - saved personal and shared views;
  - a record page for any object;
  - one-to-many relations.
  — [FEATURES.md](FEATURES.md), [atomic-crm/src/extensions/objects/](atomic-crm/src/extensions/objects/)
- Built: B8, merge duplicate contacts, in one server transaction ([FEATURES.md](FEATURES.md))
- Built: G7, field-level change history for people and automations ([FEATURES.md](FEATURES.md))
- Not started ([FEATURES.md](FEATURES.md), [MODULES.md](MODULES.md)):
  - D10, merge on any object;
  - D11, rich-text notes on any record;
  - many-to-many relations;
  - formula fields and a rich-text field type;
  - the assistant creating objects or fields ("The assistant can't create objects or fields", MODULES M1).
- Storage design: standard objects are real tables with a `custom` JSONB column; custom objects share one generic `records` table, which "avoids creating database tables at runtime" — [PLAN.md](PLAN.md)

**Data capture: email and calendar**
- C4 email triage is Done: the morning brief marks mail from CRM contacts, and the Bot offers to log an email as a note or add an unknown sender. It works over Gmail (built-in connector or Composio) or the person's own IMAP mailbox — [FEATURES.md](FEATURES.md)
- CRM mailboxes (IMAP/SMTP) send and log email. Inboxes are read every 5 minutes. "Mail from senders who aren't contacts is dropped today" — [openduet/openbot/server/src/crm/services.ts](openduet/openbot/server/src/crm/services.ts), [openduet/openbot/server/src/crm/mail-inbox.ts](openduet/openbot/server/src/crm/mail-inbox.ts), [MODULES.md](MODULES.md)
- Not started: H5 (two-way email sync onto the CRM timeline) and H6 (calendar events linked to contacts). B9 (capture emails sent or forwarded to the CRM) was Dropped and replaced by C4 — [FEATURES.md](FEATURES.md)
- H4 (Gmail, Calendar, Drive, Notion for the agent) is "In progress ... Not yet tried with real accounts". Built-in Google is "Coming soon" on customer workspaces pending the OAuth relay and Google review; Composio covers Gmail meanwhile — [FEATURES.md](FEATURES.md), [APP_MAP.md](APP_MAP.md), [platform/OAUTH_RELAY.md](platform/OAUTH_RELAY.md)
- Meetings: a booking webhook, a call-outcome form, and reminders through ready-made automations — [APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/crm/bookings.ts](openduet/openbot/server/src/crm/bookings.ts)

**Enrichment and prospecting** (built, gated on `TREG_API_KEY`)
- Lead lists run weekly or on demand ([APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/crm/prospecting/](openduet/openbot/server/src/crm/prospecting/)):
  - a Bot finds people engaging with LinkedIn posts the buyers care about;
  - enriches them through Hunter and Apollo via treg and verifies their emails;
  - scores them A to D against an ICP derived from won deals (`profile.ts`);
  - drafts personal emails to A and B leads.
- Bot tools: `find_data_tools`, `data_tool_details`, `look_up_data`, `customer_profile`, `save_customer_profile`, `add_leads`, `score_leads`, `draft_outreach`, `send_outreach`, `save_outreach_footer` — [openduet/openbot/server/src/crm/prospecting/tools.ts](openduet/openbot/server/src/crm/prospecting/tools.ts)
- Skills: `/linkedin-miner`, `/lead-enricher`, `/email-verifier`, `/icp-scorer`, `/outreach-writer`, `/warm-outbound` — [openduet/openbot/examples/openduet/skills.yaml](openduet/openbot/examples/openduet/skills.yaml)
- No automatic enrichment of existing CRM records, such as company firmographics on create, appears in FEATURES or the code read. Enrichment exists only inside the prospecting flow — [FEATURES.md](FEATURES.md)

**Outreach drafting and sending**
- Warm outbound ([openduet/openbot/server/src/crm/prospecting/outreach.ts](openduet/openbot/server/src/crm/prospecting/outreach.ts), [APP_MAP.md](APP_MAP.md)):
  - the person approves the list, each draft batch and each send;
  - sends go from the person's own mailbox, spaced out, with `DAILY_LIMIT = 50` a day;
  - every email carries a CAN-SPAM opt-out line and postal address.
- Proposals ([APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/crm/proposals.ts](openduet/openbot/server/src/crm/proposals.ts)):
  - drafted by AI from the deal;
  - edited in a TipTap editor and stored as Markdown;
  - sent by email, with a public page where the client accepts or declines.
- Workflow steps `draft email` (sent only after review), `ai_write` and `send_email` — [FEATURES.md](FEATURES.md)
- Email campaigns are out of scope — [FEATURES.md](FEATURES.md)

**AI Bots: the agent layer** (OpenDuet plus Magpie additions)
- Built ([APP_MAP.md](APP_MAP.md)):
  - Chat with the main Bot ("Maggie"), Start (message any Bot with `@`), and Groups (several Bots and people);
  - Tasks / Inbox (Needs input, In progress, Resolved);
  - Approvals and approval rules;
  - Bots pages (setup, tools, approvals, memory, reach, responsibilities, routines, sharing) and Team Bots;
  - Capabilities (skills called with `/`, and memory);
  - Routines (cron) and Responsibilities (event-started duties);
  - Make (docs, slides, dashboards, designs and web pages kept as pages);
  - the morning brief and the Today desktop home.
- CRM tools (C1, C2, C6, C7 Done; [openduet/openbot/server/src/crm/agent-tools.ts](openduet/openbot/server/src/crm/agent-tools.ts), [FEATURES.md](FEATURES.md)):
  - `search`, `find_contact`, `list_records`, `get_record`, `create_record`, `update_record`, `run_report`, `list_reports`, `make_chart`;
  - they run under the user's CRM role;
  - a team rule makes a Bot ask before every CRM write.
- Morning brief CRM section (C3 Done; [FEATURES.md](FEATURES.md)), "Follow up":
  - tasks overdue or due within a day;
  - deals whose stage changed in the last day;
  - open deals stale for 14 days;
  - hot contacts not seen for 7 days.
- "Ask the agent" on contacts, companies and deals runs a task that knows the record (C5) — [FEATURES.md](FEATURES.md)
- Company brief (`/about-your-business`): one document read by every Bot on every run, stored in `crm.configuration.business_brief` — [APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/crm/business/brief.ts](openduet/openbot/server/src/crm/business/brief.ts)
- Work plan and Bot team (`/plan-my-work`) ([APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/crm/business/plan.ts](openduet/openbot/server/src/crm/business/plan.ts), [openduet/openbot/server/src/crm/business/team.ts](openduet/openbot/server/src/crm/business/team.ts)):
  - 2 to 4 specialist Bots, each with at most 10 tools;
  - up to 10 weekly jobs, run as routines;
  - a per-job "can do without asking" choice for admins.
- Last-7-days report: [openduet/openbot/server/src/crm/business/report.ts](openduet/openbot/server/src/crm/business/report.ts)
- Memory and skills: personal memories, skills and team skills; skill-creator and bot-creator skills. Automatic learning is off on customer workspaces — [APP_MAP.md](APP_MAP.md), [platform/src/provision.ts](platform/src/provision.ts)
- Shipped skills: morning-brief, first-day, about-your-business, plan-my-work, reply-to-an-email, research-public-web, find-a-document, find-a-notion-page, whats-changed, who-owns-this, check-a-claim, skill-creator, bot-creator, plus the prospecting and GovCon skills — [openduet/openbot/examples/openduet/skills.yaml](openduet/openbot/examples/openduet/skills.yaml)
- Default model: `openai` / `gpt-5.6-terra` — [openduet/openbot/examples/openduet/model.yaml](openduet/openbot/examples/openduet/model.yaml)
- Bring-your-own agents over AG-UI: adapters exist for ADK, AG2, Agno, Claude SDK, CrewAI, LangGraph, LlamaIndex, Mastra, Microsoft, Pydantic-AI, Strands and others (`openduet/openbot/agent-*`) — [openduet/openbot/server/src/copilot.ts](openduet/openbot/server/src/copilot.ts)
- Generative UI: Bots draw charts, tables, metrics and forms in chat (gallery components, A2UI, sandboxed open generative UI). These "disappear into the chat thread"; Make pages are static snapshots — [MODULES.md](MODULES.md)
- Bot computer (browser and shell) for research: one per workspace. Per-Bot computers need the supervisor — [README.md](README.md), [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)
- Audit: G6 (agent actions and approvals) Done — [FEATURES.md](FEATURES.md)
- Not started or planned:
  - C8, the agent drafting workflows from plain language;
  - MODULES M1 to M5: the assistant shapes the data model, feeds, multi-series charts, documents, and modules as installable specs.
  — [FEATURES.md](FEATURES.md), [MODULES.md](MODULES.md)

**Workflows** (E1 to E7 Done; E8 7 of 12)
- Engine: versions, runs and history, leases, 3 tries and per-step idempotency. The editor is form-based with if/else, not a canvas — [FEATURES.md](FEATURES.md)
- Triggers: record created, updated or deleted; date offset; cron with time zone; webhook (secret address per automation); manual Run menu on contacts, companies and deals (not from list selection) — [FEATURES.md](FEATURES.md)
- Steps in code: create, update, delete and find record, upsert_contact, if, filter/stop, delay, wait_until, for_each, send_email, ai_write, ai_agent, classify, http_request, create_task, add_note, create_meeting, generate_proposal, send_proposal — [openduet/openbot/server/src/crm/workflows/definition.ts](openduet/openbot/server/src/crm/workflows/definition.ts)
- Not done: form, send chat message, code, logic function, empty. `create_record` "doesn't work on custom objects yet" — [FEATURES.md](FEATURES.md), [MODULES.md](MODULES.md)
- The 12 ready-made automations ([openduet/openbot/server/src/crm/workflows/recipes.ts](openduet/openbot/server/src/crm/workflows/recipes.ts)):
  - booking updates the CRM;
  - reminders before calls;
  - call outcome updates the CRM;
  - follow-up email by outcome;
  - "proposal is coming" email;
  - write a proposal after a call;
  - send a proposal after approval;
  - follow up until they answer;
  - accepted proposal wins the deal;
  - won deal moves into the client list;
  - welcome a new customer;
  - capture website leads with their source.
- H2 outgoing webhooks are done through a record trigger plus an HTTP step — [FEATURES.md](FEATURES.md)

**Reporting and dashboards**
- F1 and F2 Done:
  - report pages of chart grids, personal or shared;
  - number, bar, column, line and list charts, plus pie (Recharts, per MODULES);
  - count, sum, average, min and max, grouped by a field or period, with filters.
  — [FEATURES.md](FEATURES.md), [MODULES.md](MODULES.md), [atomic-crm/src/extensions/dashboards/](atomic-crm/src/extensions/dashboards/)
- FEATURES says pie was "left out on purpose", while MODULES and APP_MAP say pie is done. That is a doc conflict — [FEATURES.md](FEATURES.md) vs [MODULES.md](MODULES.md), [APP_MAP.md](APP_MAP.md)
- Not done: F3 (view widgets), multiple series, ratio measures — [FEATURES.md](FEATURES.md), [MODULES.md](MODULES.md)
- Atomic CRM's fixed home dashboard remains alongside Reports — [APP_MAP.md](APP_MAP.md)

**Channels**
- Web is built: desktop shell with a sidebar, Cmd+K, an assistant panel and a status bar; on phones, bottom tabs for Chat, Tasks and Make — [APP_MAP.md](APP_MAP.md)
- Telegram is built and newest: the HEAD commit is "Message your Bot on Telegram". It needs a per-workspace `TELEGRAM_BOT_TOKEN`, and approvals come back with Allow once and Deny buttons — [openduet/openbot/server/src/delivery/telegram.ts](openduet/openbot/server/src/delivery/telegram.ts), [APP_MAP.md](APP_MAP.md)
- SMS through Twilio is in code: bindings, Verify, and STOP/START/HELP handling. It needs `TWILIO_*` per deployment. AI_TEAMS_PLAN says "phone and text are out of version 1" — [openduet/openbot/server/src/delivery/twilio.ts](openduet/openbot/server/src/delivery/twilio.ts), [openduet/openbot/server/src/delivery/routes.ts](openduet/openbot/server/src/delivery/routes.ts), [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)
- Slack and Teams through OpenTag: the transport is in code (`delivery/opentag.ts`, with a `confirm_write` approval contract), but OpenTag is not deployed per company. They show as Coming soon — [openduet/openbot/server/src/delivery/opentag.ts](openduet/openbot/server/src/delivery/opentag.ts), [APP_MAP.md](APP_MAP.md), [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)
- Push through Expo (`delivery/push.ts`, `push_devices`, `EXPO_ACCESS_TOKEN`) — [openduet/openbot/server/src/delivery/push.ts](openduet/openbot/server/src/delivery/push.ts)
- Voice exists only in the app, in the browser — [openduet/openbot/server/src/voice/](openduet/openbot/server/src/voice/), [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)
- Inbound email triggers through Amazon SES (`OPENBOT_INBOUND_EMAIL_DOMAIN`) are "not set up yet". Bot email addresses are planned — [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)

**API and MCP**
- H1 Done: `/api/v1` REST with an OpenAPI description built from the data model. A key acts as its creator under their role, at 600 requests a minute — [FEATURES.md](FEATURES.md), [openduet/openbot/server/src/crm/public-api.ts](openduet/openbot/server/src/crm/public-api.ts)
- Internal `/api/crm` speaks Atomic's filter language; `/api/crm-public` serves webhooks and public proposal pages — [openduet/openbot/server/src/extra-routes.ts](openduet/openbot/server/src/extra-routes.ts)
- H3, an MCP server for outside AI clients, is Not started. OpenDuet is an MCP client only (`plugins/mcp.ts`) — [FEATURES.md](FEATURES.md)
- Integrations through plugins:
  - Composio (hundreds of apps);
  - Arcade adapter;
  - built-in Gmail and Calendar, Google Drive, Notion;
  - web research: Parallel, Exa and Firecrawl;
  - GitHub.
  — [APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/plugins/catalogue.ts](openduet/openbot/server/src/plugins/catalogue.ts)

**Admin and security**
- A7 Done: SSO (OIDC with an automated test; SAML checked manually) and SCIM, set up from CRM Settings, Sign-in — [FEATURES.md](FEATURES.md)
- G1 to G5 Done: custom roles; object CRUD reach none, own or all; hidden or read-only fields; one enforcement layer; owner-only rows — [FEATURES.md](FEATURES.md)
- G8 two-factor authentication was Dropped as a product decision — [FEATURES.md](FEATURES.md)
- Admin screens: People, Identity providers, Enterprise controls, Credentials, Plugins, Skills, Components, Playground, Computers, Boundaries, Approvals, Audit, Automatic learning, Check your setup — [APP_MAP.md](APP_MAP.md)
- A11 (admins send invite links from their own mailbox) is Not started; today an admin copies a set-password link — [FEATURES.md](FEATURES.md)
- White-label (A5 Done): a tenant package (name, assistant name, logo, colour via `scripts/make-tenant.ts`). The "Powered by CopilotKit" badge and the self-host banner remain until paid CopilotKit plans are in place — [README.md](README.md)

**Mobile**
- A9 is In progress: phones get contacts, companies, deals (list with stage filters; detail with stage change and notes) and tasks through Atomic's responsive screens (`extensions/mobile/DealListMobile.tsx`, `DealShowMobile.tsx`) — [FEATURES.md](FEATURES.md), [atomic-crm/src/extensions/mobile/](atomic-crm/src/extensions/mobile/)
- The native app is OpenDuet's Expo app, still named "OpenBot" (`ai.openbot.mobile`). Its screens are approvals, bot, bots, computer, conversation, memory, plugins, routine and rules, with no CRM screens — [openduet/openbot/mobile/app.config.ts](openduet/openbot/mobile/app.config.ts), [openduet/openbot/mobile/app/](openduet/openbot/mobile/app/)
- Languages: the CRM screens follow English and French; OpenDuet's screens are English only (A8) — [FEATURES.md](FEATURES.md)

**Editions: GovCon / Kontract**
- Milestone 1 is built ([KONTRACT.md](KONTRACT.md), [openduet/openbot/server/src/crm/govcon/tools.ts](openduet/openbot/server/src/crm/govcon/tools.ts)):
  - 17 Bot tools: `find_bids`, `bid_notice`, `read_bid_documents`, `read_bid_text`, `bid_breakdown`, `past_pricing`, `find_subcontractors`, `read_business_website`, `permit_leads`, `permit_contractors`, `list_bids`, `company_profile`, and approval-gated `track_bid`, `update_bid`, `save_company_profile`, `save_bid_reading`, `save_bid_document`;
  - a `crm.bids` table with stages found, sourcing, quoted, submitted, won and lost;
  - skills find-government-bids, read-a-bid, price-a-bid, find-subcontractors, write-a-proposal and permit-leads;
  - a Kontract engine live on Railway.
- Milestone 2 is planned: Bids screens, public quote links `/q/:token`, Word export, a sub bench, Today cards, permit-lead pages and an edition tenant package — [KONTRACT.md](KONTRACT.md)
- AI_TEAMS_PLAN calls Kontract "the first, half built" edition. Editions are packages (name, logo, Bots, skills, work-plan template, CRM fields, sample data, landing page) — [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)
- Sample data exists for `sample-data/ugc-mediakits` (CSV and seed) and `sample-data/govcon-prime` (seed) — [sample-data/](sample-data/)

**Code size and tests (rough)**
- `openduet/openbot/server/src` has 392 `.ts` files, ~140k lines including OpenDuet. Magpie's `server/src/crm/**` is ~16.7k lines. `atomic-crm/src/extensions` is ~12.5k lines — `wc` over the directories
- There are 22 CRM test files in `server/tests/crm-*.test.ts`, covering model and permissions, platform, workflows, mail, prospecting, outreach, govcon, work plan and team, SSO and workspace setup — [openduet/openbot/server/tests/](openduet/openbot/server/tests/)

### Inferences
- Atomic's per-entity screens are still the "bridge" for standard objects. Generic screens exist for any object. APP_MAP lists duplicated surfaces to sort out:
  - two settings areas;
  - two dashboards;
  - approvals in three places;
  - three ways to connect mail;
  - two "Tasks";
  - two homes.
  This suggests UI coherence debt rather than missing capability ([APP_MAP.md](APP_MAP.md)).

### Gaps
- Several items are "Done" in docs but were not verified by running the app, by instruction: the FEATURES statuses, browser checks and Telegram end-to-end.
- No usage analytics show which features pilot customers use.

## 6. Strengths competitors may lack, and obvious gaps

### Takeaway
Magpie's edge is a governed, agent-first operating layer on a real CRM:
- approval before every write, an audit trail, and agents acting under the user's field-level permissions;
- Bot teams with scheduled jobs from a company brief;
- reach over Telegram, SMS and push;
- a browser computer;
- bring-your-own agents over AG-UI;
- vertical editions (GovCon);
- per-customer isolated databases;
- SSO/SCIM at a small-business price.

Its gaps against AI-native CRMs are mostly in automatic data capture and enrichment:
- no automatic email/calendar sync to the timeline;
- built-in Google connectors not yet live for customers;
- no meeting recording;
- no enrichment of existing records;
- no MCP server;
- Slack/Teams not live;
- mobile partial;
- no billing or metering.

### Cited Findings
**Strengths**
- Approvals: "A team rule asks the person before every CRM write, even if they once said always allow" (C2). The audit log records each CRM tool call and approval (G6) — [FEATURES.md](FEATURES.md)
- The agent works under the user's CRM role through the same records layer, with field-level hidden and read-only rules (C6, G3, G4) — [FEATURES.md](FEATURES.md)
- The agent builds checked charts and reports on request (C7). Workflows include AI agent, AI write and classify steps — [FEATURES.md](FEATURES.md)
- Company brief, work plan, specialist Bot teams, routines and a last-7-days report — [APP_MAP.md](APP_MAP.md), [openduet/openbot/server/src/crm/business/](openduet/openbot/server/src/crm/business/)
- Reach outside the app: Telegram with approval buttons, Twilio SMS, Expo push, and Slack/Teams through OpenTag in code — [openduet/openbot/server/src/delivery/](openduet/openbot/server/src/delivery/)
- A built-in browser and shell computer for research, isolated from the database in the compose path — [deploy/compose.yml](deploy/compose.yml)
- Compliance-aware warm outbound: approval per batch and send, 50 a day, CAN-SPAM footer, and a budget-capped paid lookup spend — [openduet/openbot/server/src/crm/prospecting/outreach.ts](openduet/openbot/server/src/crm/prospecting/outreach.ts), [COGS.md](COGS.md)
- A vertical edition with a live public-data engine (SAM.gov notices, state and local bids, permits, past awards, subcontractor search) — [KONTRACT.md](KONTRACT.md)
- The pricing comparison COGS.md makes: "Attio Pro is $86 a seat monthly and HubSpot Sales Hub Professional about $100. Neither runs Bots on your mail, calendar and CRM". Magpie's plans are Team at $99 a seat and Business at $199 a seat — [COGS.md](COGS.md)
- Isolation as a selling point: own project and database per company; connected accounts stay the owner's — [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)

**Gaps**
- H5 and H6 (email and calendar sync to the timeline) are Not started. Mail from unknown senders is dropped — [FEATURES.md](FEATURES.md), [MODULES.md](MODULES.md)
- Google's built-in connectors are blocked on customer workspaces by the OAuth relay and Google's restricted-scope review (CASA for `gmail.readonly`) — [platform/OAUTH_RELAY.md](platform/OAUTH_RELAY.md), [PLAN.md](PLAN.md)
- Call recording, email campaigns, a page-layout editor and validation rules are out of scope — [FEATURES.md](FEATURES.md)
- H3 (MCP server) is Not started — [FEATURES.md](FEATURES.md)
- Phone and voice agent are out of v1. Bot email addresses are not set up — [AI_TEAMS_PLAN.md](AI_TEAMS_PLAN.md)
- No billing, metering or limits — [COGS.md](COGS.md)
- Mobile is partial and the native app is unbranded — [FEATURES.md](FEATURES.md), [openduet/openbot/mobile/app.config.ts](openduet/openbot/mobile/app.config.ts)
- Vendor dependencies:
  - CopilotKit Intelligence is required, with interaction pricing past 10k unknown and resale terms not yet obtained;
  - OpenDuet is "in early development and changes fast".
  — [PLAN.md](PLAN.md), [COGS.md](COGS.md)
- UI duplication between OpenDuet and the CRM (APP_MAP §7) — [APP_MAP.md](APP_MAP.md)
- Open decisions: first target customers, open or closed source, the license for Magpie's own additions, and the trademark check — [PLAN.md](PLAN.md), [README.md](README.md)

### Inferences
- Against AI-native CRMs that auto-build the record graph from inbox, calendar and meetings, Magpie's capture is triage-on-request rather than ambient. Its differentiation is governed autonomy (Bots that act, with approvals, roles and audit) and vertical editions, not data capture.
- Magpie's strongest moat candidates are the approval and permissions model applied to agents, and the edition packaging. The cell-per-tenant model is a sales asset for security-sensitive SMBs but a cost and operations liability at scale.

### Gaps
- No competitor feature data appears in this codebase beyond COGS.md's Attio and HubSpot price comparison. The competitor side of the comparison must come from other researchers.
