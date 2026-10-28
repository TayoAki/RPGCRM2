# Feature tracker

Single source of truth for what the agentic CRM has, what's next, and what we deliberately skip. Update the **Status** column in the same pull request that changes the feature. The plan behind the tiers is in [PLAN.md](PLAN.md).

## How to read it

| Column | Values |
|---|---|
| **Tier** | **MVP**: OpenDuet fused with Atomic CRM, sellable to a pilot customer. **P1**: closes the gap with Twenty on what most customers use (views, workflows, dashboards, roles). **P2**: valuable but not urgent. **Out**: deliberately not built (see the end). |
| **Starts from** | **Atomic**: exists in Atomic CRM, port it. **OpenDuet**: exists in OpenDuet, wire it in. **Build**: new code. |
| **Status** | Not started, In progress, Done, Dropped |

Twenty is a behavior reference only. Never copy its code: it's AGPL with Enterprise-licensed parts, and this product's base is MIT.

## A. Platform

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| A1 | One app: OpenDuet hosts the CRM area | MVP | Build | In progress | CRM screens run at `/crm` inside OpenDuet's app on real data. Open: phone layout, one header instead of two |
| A2 | One login for agent and CRM | MVP | OpenDuet | Done | The CRM uses OpenDuet's session. Email and password sign-in with admin-issued set-password links (`SIGNIN_EMAIL_PASSWORD`). No mail needed. |
| A3 | One database: CRM tables in OpenDuet's Postgres | MVP | Build | Done | `crm` schema with its own migrations (`server/drizzle-crm/`); Supabase removed from the data path |
| A4 | CRM API on OpenDuet's server | MVP | Build | Done | `/api/crm`: lists with Atomic's filter language, reads, writes, bulk updates and deletes, admin-only settings |
| A5 | White-label branding (name, logo, colors) | MVP | OpenDuet | Not started | OpenDuet keeps its identity in one folder |
| A6 | One-command deploy per customer | MVP | OpenDuet | Not started | Extend OpenDuet's start scripts or Helm chart |
| A7 | SSO (SAML, OIDC) and SCIM provisioning | P1 | OpenDuet | Not started | Already in OpenDuet via Better Auth plugins; verify and expose |
| A8 | Languages: English and French | MVP | Atomic | Not started | More languages in P2 |
| A9 | Mobile | P2 | OpenDuet | Not started | OpenDuet has a mobile app; Atomic has PWA screens |

## B. Core CRM records

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| B1 | Companies, contacts, deals, tasks, notes | MVP | Atomic | Done | On real data, checked in a browser |
| B2 | Deals pipeline kanban, configurable stages | MVP | Atomic | Done | |
| B3 | Tags and bulk tagging | MVP | Atomic | In progress | API done and tested; check the screens |
| B4 | Global search | MVP | Atomic | Done | Postgres full-text search, prefix matching. Add indexes when data grows |
| B5 | CSV import and export | MVP | Atomic | In progress | Check against the real API |
| B6 | Activity log | MVP | Atomic | Done | |
| B7 | Attachments on notes | MVP | Atomic | In progress | Stored inside the note for now, up to 7 MB; move to S3 or local disk |
| B8 | Merge duplicate contacts | P1 | Atomic | Not started | The merge button says it isn't available yet |
| B9 | Capture emails sent or forwarded to the CRM | Out | Atomic | Dropped | Replaced by C4 (the agent reads the mailbox) |

## C. Agent (the differentiator)

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| C1 | CRM tools for the agent: search, read, create, update records | MVP | Build | Not started | Generated from metadata once D1 lands |
| C2 | Agent asks before writing to the CRM | MVP | OpenDuet | Not started | OpenDuet's approval and policy engine |
| C3 | Morning brief includes the CRM | MVP | Build | Not started | Overdue tasks, deals that moved or stalled, hot contacts |
| C4 | Email triage linked to the CRM | MVP | Build | Not started | Match the sender to a contact or company; offer "log to CRM" or "create contact" |
| C5 | "Ask the agent" from any record, with that record as context | MVP | Build | Not started | Draft a follow-up, summarize the history, suggest next steps |
| C6 | Agent works under the user's CRM permissions | P1 | Build | Not started | Depends on G4 |
| C7 | Agent builds charts and dashboards on request | P1 | Build | Not started | Depends on F2; OpenDuet's "Make" already makes dashboards |
| C8 | Agent drafts workflows from plain language | P2 | Build | Not started | Depends on E1 |

## D. Data model and views

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| D1 | Metadata registry: objects and fields described in the database | P1 | Build | Not started | **Foundation for everything below.** Standard objects get registered too. |
| D2 | Custom fields from the settings screen | P1 | Build | Not started | Text, number, currency, date, date-time, boolean, select, multi-select, email, phone, URL, rating, relation |
| D3 | Custom objects from the settings screen | P1 | Build | Not started | |
| D4 | Table view on any object: sort, filter, choose columns | P1 | Build | Not started | |
| D5 | Kanban on any object, grouped by a select field | P1 | Build | Not started | |
| D6 | Calendar view on any object, by a date field | P1 | Build | Not started | |
| D7 | Saved views, personal and shared | P1 | Build | Not started | Filters, sorts, columns, grouping |
| D8 | Record page for any object | P1 | Build | Not started | Fields, relations, notes, tasks, activity |
| D9 | One-to-many relations between any objects | P1 | Build | Not started | Many-to-many in P2 |
| D10 | Merge duplicates on any object | P2 | Build | Not started | Generalizes B8 |
| D11 | Rich-text notes on any record | P2 | Build | Not started | |

## E. Workflows (4 triggers, 22 actions)

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| E1 | Workflow engine: versions, runs, run history, retries | P1 | Build | Not started | Runs in OpenDuet's worker |
| E2 | Visual workflow builder | P1 | Build | Not started | |
| E3 | Trigger: record created, updated or deleted | P1 | Build | Not started | |
| E4 | Trigger: schedule | P1 | OpenDuet | Not started | Reuse the routines scheduler |
| E5 | Trigger: manual (button on a record or a list selection) | P1 | Build | Not started | |
| E6 | Trigger: incoming webhook | P1 | Build | Not started | |
| E7 | Actions, core 10: create, update, delete and find records; if/else; filter; delay; send email; HTTP request; AI agent | P1 | Build | Not started | The AI agent step runs an OpenDuet bot, with approvals |
| E8 | Actions, remaining 12: upsert, pick record, iterator, wait for event, form, draft email, create calendar event, send chat message, classify, code, logic function, empty | P2 | Build | Not started | Chat messages can use OpenDuet's Slack and Teams channels |

## F. Dashboards

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| F1 | Dashboard pages with a grid of widgets | P1 | Build | Not started | Atomic's fixed dashboard becomes the default one |
| F2 | Charts on any object: bar, line, pie, number | P1 | Build | Not started | Group by a field, aggregate (count, sum, average), filter |
| F3 | View widget: a saved table or kanban inside a dashboard | P2 | Build | Not started | |

## G. Roles and permissions

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| G1 | Custom roles beyond admin and user | P1 | Build | Not started | |
| G2 | Object permissions: read, create, update, delete per role | P1 | Build | Not started | |
| G3 | Field permissions: hidden or read-only per role | P1 | Build | Not started | |
| G4 | One enforcement layer for the API, views, search, export, workflows and agent tools | P1 | Build | Not started | **Security-critical.** Nothing may read records around it. |
| G5 | Owner-only visibility (row level) | P2 | Build | Not started | |
| G6 | Audit log of agent actions | MVP | OpenDuet | Not started | Already in OpenDuet |
| G7 | Audit log of user changes | P2 | Build | Not started | |
| G8 | Two-factor authentication | Out | | Dropped | Product decision. Better Auth has a 2FA plugin if this changes. |

## H. Integrations and API

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| H1 | Public REST API with API keys | P1 | Build | Not started | Generated from metadata; goes through G4 |
| H2 | Outgoing webhooks per record event | P2 | Build | Not started | Shares E3's event stream |
| H3 | MCP server for outside AI clients (Claude, ChatGPT) | P2 | Atomic | Not started | Port Atomic's edge function, or expose C1's tools |
| H4 | Gmail, Google Calendar, Drive, Notion for the agent | MVP | OpenDuet | Not started | Already in OpenDuet |
| H5 | Two-way email sync onto the CRM timeline | P2 | Build | Not started | The MVP covers this with C4 |
| H6 | Calendar events linked to contacts | P2 | Build | Not started | |

## Out of scope

These are Twenty features that cost much and few customers use (the "80%" of the 80/20 rule). Revisit only on customer demand.

- App marketplace and SDK
- Serverless logic functions beyond the workflow code step
- Email campaigns
- Call recording
- Page-layout editor
- Validation rules
- Record sharing beyond roles
- Custom domains per workspace
- Built-in billing (bill through Stripe outside the product)
- 33 languages
- Several workspaces in one install (run one instance per customer)
- Two-factor authentication (product decision)
