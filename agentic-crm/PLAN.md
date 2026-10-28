# Plan: an agentic CRM built on OpenDuet and Atomic CRM

**Goal:** a CRM you can sell under your own brand, where an AI agent does the busywork. It should reach Twenty's most-used features without Twenty's code or licensing problems.

**Approach:**
- **MVP:** OpenDuet fused with Atomic CRM.
- **Then:** build what's missing, in the order set by the 80/20 rule: views on any object, workflows, dashboards, roles and permissions. No two-factor authentication.

Feature status lives in [FEATURES.md](FEATURES.md).

## Principles

1. **The agent is the product.** The CRM is the system of record. Every feature should also be usable by the agent, through tools generated from the same metadata the UI uses.
2. **Metadata drives the core.** Objects, fields, views and permissions are data, not code. That one decision is what makes "any object" possible across views, workflows, charts, the API and agent tools.
3. **One enforcement layer.** Every read and write, whether it comes from the UI, the API, an export, a workflow or the agent, goes through one data-access layer that applies roles and permissions. Nothing reads around it.
4. **Clean licensing.**
   - OpenDuet (MIT, CopilotKit) and Atomic CRM (MIT, Marmelab) are the base. Keep their notices in a NOTICE file.
   - Twenty is a behavior reference only. **Never copy Twenty code**: it's AGPL with Enterprise-licensed parts, and copying it would make this product AGPL or worse.
   - The product needs its own name. "OpenDuet", "CopilotKit" and "Atomic CRM" are other people's names.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Host app | OpenDuet (Bun, Hono, React 19, TanStack Router, Postgres via Drizzle, Better Auth) | The agent platform is the larger and harder part. The CRM moves into it, not the other way round. |
| CRM screens (MVP) | Atomic's React UI, mounted at `/crm` | Atomic talks to its backend through react-admin's data provider. We replace its Supabase provider with one that calls OpenDuet's server. Both apps already share React 19, TanStack Query, Tailwind 4 and Zod 4. |
| CRM screens (P1) | New metadata-driven table, kanban, calendar and record pages, built natively in OpenDuet's app | Atomic's screens are written per entity. They're a bridge, replaced as the generic views land. |
| CRM API | Hono routes in OpenDuet's server | One server, one deploy |
| Database | OpenDuet's Postgres | Supabase is removed: one database, one backup |
| Login | Better Auth (already in OpenDuet) | It also brings SSO and SCIM for free |
| Agent tools | Generic tools (`search_records`, `get_record`, `create_record`, `update_record`) whose descriptions come from metadata | A small, fixed toolset that covers every object, including custom ones |
| Agent writes | OpenDuet's approval and policy gateway | "Asks before it acts" and an audit trail come built in |
| Workflows | A step engine running in OpenDuet's worker; schedules reuse the routines scheduler | |
| Hosting | One instance per customer | Simple isolation, no multi-tenant code |

### How records are stored

- **Standard objects** (companies, contacts, deals, tasks, notes) stay real tables, with an extra `custom` JSONB column for custom fields.
- **Custom objects** live in one generic `records` table: object ID plus JSONB data.
- **Metadata tables** (`objects`, `fields`) describe both kinds, including where each field is stored: a column or a JSONB path.
- **A query builder** turns view filters, sorts and chart aggregations into SQL for either kind.

This avoids creating database tables at runtime, which is the hardest part of Twenty's design. It's fast enough for small and mid-sized customers. Storage stays hidden behind the data layer, so it can change later if a customer outgrows it.

## Phases

The estimates are rough, for one senior engineer working with agent teams. A second engineer shortens phases 2 and 3 the most.

### Phase 0: groundwork (about 1 week)

- **Decisions:** product name, first target customers, open or closed source. See the end of this document.
- **Repository: done.** The product lives in `agentic-crm/` in this repository. OpenDuet (`openduet/`, at `60fd4c7`) and Atomic CRM (`atomic-crm/`, at `1d96561`) are imported as pinned vendor snapshots, synced with [scripts/sync-vendor.sh](scripts/sync-vendor.sh). See [README.md](README.md).
- **CopilotKit account:** choose the plan (Pay as you go, $49/month with 10,000 interactions included, at the time of writing).
- **Spike: done.** Atomic's UI runs at `/crm` inside OpenDuet's app, so the second-bundle fallback isn't needed. See README.md, "How the CRM runs inside OpenDuet".

**Exit: met.** Both apps run as one, with OpenDuet's login and the CRM screens on fake data.

Checked in a browser:
- OpenDuet's menu opens the CRM.
- The CRM's tabs, records, Back, deep links and reloads all work.
- Creating a contact works.
- The CRM's user menu shows the OpenDuet user, and the CRM follows OpenDuet's dark mode.
- OpenDuet's back control leaves the CRM.
- A production build puts the CRM in its own lazily loaded chunk, with a single copy of React.

### What the spike found, for Phase 1

| Finding | What to do |
|---|---|
| OpenDuet has no email-and-password sign-in. Without Google, Microsoft or Okta, it only runs in single-user dev mode. | **Done.** `SIGNIN_EMAIL_PASSWORD=true` turns it on. Sign-up stays closed: an admin adds people and hands them a one-time link to set their password. |
| OpenDuet's build now needs Atomic's packages, installed by `npm ci` in `atomic-crm/`. | The Docker build (A6) installs both. Later, move Atomic's dependencies into OpenDuet's bun workspace. |
| The CRM chunk is 2.3 MB (712 kB gzipped), mostly the Supabase client and the fake-data generator. | Both go with the real data provider (A3, A4). |
| On phones, Atomic's mobile layout (fixed header and bottom bar) collides with OpenDuet's page header. | Desktop first for the MVP. On phones, hide one of the two headers when mobile (A9) comes up. |
| OpenDuet's self-hosting banner, CopilotKit's "Powered by CopilotKit, Get a license" badge, and the "Atomic CRM" title all show. | Part of branding (A5). The badge goes once a CopilotKit license is set. |
| The CRM's own theme switch and Logout repeat OpenDuet's. Logout does nothing in single-user mode. | Hide both in the embedded CRM. |
| CopilotKit's runtime sends telemetry by default. | Set `COPILOTKIT_TELEMETRY_DISABLED=true` in the deploy kit (A6). |
| ra-core 5.15 has a TanStack Router adapter, but Atomic imports react-router directly in 51 files. | Keep react-router through the history adapter. The native P1 screens use TanStack Router directly. |

### Phase 1: MVP (about 4 to 5 weeks)

Covers A1 to A6, A8, B1 to B7, C1 to C5, G6 and H4.

- **CRM backend:** Drizzle schema for Atomic's tables, Hono routes, a data provider, file storage, full-text search.
- **Agent:**
  - CRM tools, with approval before any write
  - CRM items in the morning brief
  - mail triage that matches senders to contacts and offers to log the email
  - an "Ask the agent" button on every record
- **Shipping:** branding, plus a one-command deploy per customer.

**Exit:** a pilot customer uses it daily for two weeks.

**Progress:**
- **Done:**
  - Email and password sign-in (A2).
  - The CRM's records in OpenDuet's Postgres (A3) and the CRM API (A4).
  - Companies, contacts, deals, tasks and notes on real data (B1, B2), global search (B4) and the activity log (B6).
  - Checked in a browser with two people.
- **Next, in this order:**
  1. File storage for attachments (B7).
  2. Check CSV import and export (B5) and bulk tagging (B3) against the real API.
  3. Remove Supabase and the fake-data generator from the CRM's bundle, and hide the CRM's own theme switch and Logout.
  4. The agent work (C1 to C5).
  5. Branding (A5), the deploy kit (A6) and languages (A8).

### Phase 2: metadata, views and permissions (about 5 to 6 weeks)

Covers D1 to D9, G1 to G4, C6 and B8.

1. **Metadata registry (D1) first.** Everything else builds on it.
2. **Then, in parallel:**
   - the settings screens for custom fields and custom objects
   - table, kanban and calendar views, saved views and record pages
   - the permission layer
3. **Permissions are built with the metadata, not after it.** Enforcement belongs in the data layer from day one, and the agent must work under the user's permissions (C6).

**Exit:** a customer creates a custom object, sees it in a kanban, saves a view, and a restricted role can't read a hidden field through the UI, API, export or agent. The last part is checked by an automated permission test suite.

### Phase 3: workflows, dashboards and API (about 5 to 6 weeks)

Covers E1 to E7, F1, F2, C7 and H1.

- **Workflows:** the engine and builder come first. After that, each trigger and action is independent and can be built in parallel.
- **Dashboards:** the grid plus bar, line, pie and number charts, built on the Phase 2 query builder.
- **API:** a public REST API with keys, going through the same permission layer.

**Exit:** a customer builds "when a deal moves to Won, create an onboarding task and have the agent draft a welcome email for approval", and a dashboard of deals by stage.

### Phase 4: P2 backlog

Prioritized by what pilot customers ask for.

**Total to the end of Phase 3:** about 4 months for one senior engineer with agents, or roughly 2.5 to 3 months for two.

## Using agent teams

- **Every feature ID in FEATURES.md is one task**, with acceptance criteria written before work starts.
- **Agents work in parallel on independent IDs**, each in its own branch, and update the tracker in the same pull request.
- **The foundations get one owner and a human review:** D1 (metadata), G4 (permissions) and E1 (the workflow engine). Everything else hangs off them, so they aren't split across agents.
- **CI gates every merge:** typecheck, unit tests, a Playwright end-to-end suite, and from Phase 2 on, the permission test suite.

## Risks

| Risk | Mitigation |
|---|---|
| CopilotKit Intelligence is required, and its interactions cost money as usage grows | Build the interaction cost into each customer's price. Get written resale terms from CopilotKit before the first sale (research in progress). |
| OpenDuet is in early development and changes fast | Pin a version, sync monthly through vendor snapshots, and keep fork changes in separate folders. |
| Two routers in one app (react-admin's and TanStack's) | Resolved by the Phase 0 spike: one shared history, covered by unit tests in `atomic-crm/src/embed/`. |
| The metadata layer and permissions are hard to get right | One owner, built early, permission tests on every merge. |
| Google requires verification and a yearly security assessment for apps that read Gmail | Start the verification during Phase 1. It takes weeks. |
| Reaching "Twenty's 80%" is still about four months of work | Sell the MVP to pilots during Phases 2 and 3. The agent is the differentiator, not feature parity. |

## Decisions needed from you

1. **Product name**, for the repository, the branding defaults and Google's verification.
2. ~~**Repository.**~~ Decided: a new folder, `agentic-crm/`, in this repository.
3. **First target customers**, which decides which P2 items move up.
4. **Open or closed source.** MIT allows either. Closed source protects your work; open source helps trust and adoption.
