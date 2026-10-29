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
| A1 | One app: OpenDuet hosts the CRM area | MVP | Build | Done | CRM screens run at `/crm` inside OpenDuet's app on real data, on desktop and phone. On phones the CRM's header is the page's only bar, beside OpenDuet's back button. On desktop the CRM has its own frame: an icon rail, a sidebar of objects and views, tabs for the current section, a Today panel (tasks due, meetings coming up, deals that moved) and a status bar. Tabs that don't fit go into a "more" menu instead of scrolling |
| A2 | One login for agent and CRM | MVP | OpenDuet | Done | The CRM uses OpenDuet's session. Email and password sign-in with admin-issued set-password links (`SIGNIN_EMAIL_PASSWORD`). No mail needed. |
| A3 | One database: CRM tables in OpenDuet's Postgres | MVP | Build | Done | `crm` schema with its own migrations (`server/drizzle-crm/`); Supabase removed from the data path |
| A4 | CRM API on OpenDuet's server | MVP | Build | Done | `/api/crm`: lists with Atomic's filter language, reads, writes, bulk updates and deletes, admin-only settings |
| A5 | White-label branding (name, logo, colors) | MVP | OpenDuet | Done | Magpie CRM by default; any deployment can have its own name, assistant, logo and brand color (`scripts/make-tenant.ts --color`, written to the tenant's `theme.css`). Shown in the tab, the sign-in pages, OpenDuet's screens and the CRM |
| A6 | One-command deploy per customer | MVP | OpenDuet | Done | `deploy/`: `new-customer.ts` then `up.sh <customer>`. Postgres, migrations, OpenDuet's image with the CRM and the customer's name, the assistant's computer in its own container off the database network, Caddy for HTTPS |
| A7 | SSO (SAML, OIDC) and SCIM provisioning | P1 | OpenDuet | Done | Better Auth's SSO and SCIM plugins, set up from the CRM's Settings, Sign-in: add a provider (the screen shows the redirect or ACS URL to give it), require SSO, make and revoke SCIM tokens. People the directory or an admin added sign in through SSO on the provider's domain; turning someone off in the directory turns off their CRM access and API keys. OIDC has an automated round-trip test and was checked in the browser; SAML was checked with a signed-assertion round trip against a dev server, not yet in the automated suite |
| A8 | Languages: English now, French later | MVP | Atomic | Done | English for the MVP. The CRM's screens already follow a French browser, including the embed's own buttons, but OpenDuet's screens are English only: OpenDuet has no translation layer. Stages and statuses show as they're written in the CRM's settings. Full French and more languages in P2 |
| A9 | Mobile | P2 | OpenDuet | In progress | Phones get contacts, companies, deals (list with stage filters, detail with stage change and notes) and tasks. OpenDuet has a mobile app; Atomic has PWA screens |
| A10 | Self-serve sign-up: landing page, sign-up form, a workspace made automatically | MVP | Build | In progress | `platform/`: the sign-up site creates a Railway project per company (Postgres and the CRM app from a prebuilt image), shows progress, and hands the owner their set-password link when it's ready. Releases roll out by changing `WORKSPACE_IMAGE`. Needs a Railway API token to create workspaces |
| A11 | Admins send invite links from their own mailbox | P1 | Build | Not started | The admin connects Gmail (or any mailbox) and Admin, People emails each new person their set-password link instead of showing it to copy |

## B. Core CRM records

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| B1 | Companies, contacts, deals, tasks, notes | MVP | Atomic | Done | On real data, checked in a browser |
| B2 | Deals pipeline kanban, configurable stages | MVP | Atomic | Done | |
| B3 | Tags and bulk tagging | MVP | Atomic | Done | Checked in a browser, including contacts the API made without tags |
| B4 | Global search | MVP | Atomic | Done | Postgres full-text search, prefix matching. Add indexes when data grows |
| B5 | CSV import and export | MVP | Atomic | Done | Contacts, companies and deals, checked in a browser |
| B6 | Activity log | MVP | Atomic | Done | |
| B7 | Attachments on notes | MVP | Atomic | Done | Stored in Postgres (`crm.files`), up to 20 MB each, downloads need sign-in; also company logos and avatars |
| B8 | Merge duplicate contacts | P1 | Atomic | Done | On the server, in one transaction: notes, tasks, meetings, proposals, email, deals and custom records that link to the duplicate move to the kept contact, whose gaps are filled from it |
| B9 | Capture emails sent or forwarded to the CRM | Out | Atomic | Dropped | Replaced by C4 (the agent reads the mailbox) |

## C. Agent (the differentiator)

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| C1 | CRM tools for the agent: search, read, create, update records | MVP | Build | Done | The built-in "CRM" plugin: search, find a contact by email, list, read with notes and tasks, create, update. Same rules as the screens. Generated from metadata once D1 lands |
| C2 | Agent asks before writing to the CRM | MVP | OpenDuet | Done | A team rule asks the person before every CRM write, even if they once said always allow |
| C3 | Morning brief includes the CRM | MVP | Build | Done | A "Follow up" section: tasks overdue or due within a day, deals that changed stage in the last day, open deals unchanged for 14 days, hot contacts not seen for 7 days |
| C4 | Email triage linked to the CRM | MVP | Build | Done | The brief marks mail from CRM contacts, and Start tells the Bot who the sender is. The Bot is told to offer to log the email as a note, or to add an unknown sender as a contact. Gmail, or the person's own IMAP mailbox when Gmail isn't connected |
| C5 | "Ask the agent" from any record, with that record as context | MVP | Build | Done | On contacts, companies and deals: the person types the ask, and it runs as a task that knows the record |
| C6 | Agent works under the user's CRM permissions | P1 | Build | Done | The CRM tools read and write through the same records layer as the screens, as the person, under their role |
| C7 | Agent builds charts and dashboards on request | P1 | Build | Done | CRM tools `run_report`, `list_reports` and `make_chart`. A chart is checked against the data before it's saved, goes on a new or existing report the person owns, and asks for approval like other CRM writes |
| C8 | Agent drafts workflows from plain language | P2 | Build | Not started | Depends on E1 |

## D. Data model and views

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| D1 | Metadata registry: objects and fields described in the database | P1 | Build | Done | `crm.objects` and `crm.fields`; standard objects registered at start-up |
| D2 | Custom fields from the settings screen | P1 | Build | Done | Settings, Data model. Text, long text, number, currency, date, date-time, yes/no, one choice, several choices, email, phone, link, rating, link to a record. On contacts, companies, deals, meetings and proposals, in their forms and asides |
| D3 | Custom objects from the settings screen | P1 | Build | Done | Records in `crm.records`; optional header tab |
| D4 | Table view on any object: sort, filter, choose columns | P1 | Build | Done | `/crm/o/<object>`, standard objects included |
| D5 | Kanban on any object, grouped by a select field | P1 | Build | Done | Also by yes/no or text fields; drag a card to change the field |
| D6 | Calendar view on any object, by a date field | P1 | Build | Done | Month grid |
| D7 | Saved views, personal and shared | P1 | Build | Done | Filters, sort, columns, layout, grouping and date field |
| D8 | Record page for any object | P1 | Build | Done | Fields, linked records, notes and history. Tasks stay on contacts |
| D9 | One-to-many relations between any objects | P1 | Build | Done | "Link to a record" fields; the linked record lists what links to it. Many-to-many in P2 |
| D10 | Merge duplicates on any object | P2 | Build | Not started | Generalizes B8 |
| D11 | Rich-text notes on any record | P2 | Build | Not started | |

## E. Workflows (4 triggers, 22 actions)

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| E1 | Workflow engine: versions, runs, run history, retries | P1 | Build | Done | Runs in the server's loops, with leases, 3 tries and per-step idempotency |
| E2 | Visual workflow builder | P1 | Build | Done | A form-based editor for the trigger, conditions and steps, with if/else branches; not a canvas |
| E3 | Trigger: record created, updated or deleted | P1 | Build | Done | Plus a date trigger: a moment before or after a record's date field |
| E4 | Trigger: schedule | P1 | Build | Done | Cron with a time zone, optionally once per matching record |
| E5 | Trigger: manual (button on a record or a list selection) | P1 | Build | Done | A Run menu on contacts, companies and deals; only on records the person could change. Not yet from a list selection |
| E6 | Trigger: incoming webhook | P1 | Build | Done | Each automation gets its own secret address |
| E7 | Actions, core 10: create, update, delete and find records; if/else; filter; delay; send email; HTTP request; AI agent | P1 | Build | Done | Find is the trigger's scope (the record, its contact, company, deal); filter is conditions plus stop. The AI agent step starts a task for the Bot |
| E8 | Actions, remaining 12: upsert, pick record, iterator, wait for event, form, draft email, create calendar event, send chat message, classify, code, logic function, empty | P2 | Build | In progress | 7 of 12 done: upsert contact, find a record, for each, wait until, draft email (send with review first), create meeting, classify. Not started: form, send chat message, code, logic function, empty |

## F. Dashboards

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| F1 | Dashboard pages with a grid of widgets | P1 | Build | Done | Reports: grids of charts per person or shared with the team. Atomic's fixed dashboard stays the home page |
| F2 | Charts on any object: bar, line, pie, number | P1 | Build | Done | Number, bars, columns and line over time, and a list; count, sum, average, minimum or maximum, by a field or a period, with filters. Pie left out on purpose: bars compare better |
| F3 | View widget: a saved table or kanban inside a dashboard | P2 | Build | Not started | |

## G. Roles and permissions

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| G1 | Custom roles beyond admin and user | P1 | Build | Done | Settings, Roles; given to people there |
| G2 | Object permissions: read, create, update, delete per role | P1 | Build | Done | Each as none, their own, or all |
| G3 | Field permissions: hidden or read-only per role | P1 | Build | Done | |
| G4 | One enforcement layer for the API, views, search, export, workflows and agent tools | P1 | Build | Done | **Security-critical.** The records layer (`server/src/crm/records.ts`); notes, email and history follow their parent record |
| G5 | Owner-only visibility (row level) | P2 | Build | Done | "Their own" in a role |
| G6 | Audit log of agent actions | MVP | OpenDuet | Done | OpenDuet's audit log records each CRM tool call and each approval |
| G7 | Audit log of user changes | P2 | Build | Done | Every record's history: who changed which field from what to what, people and automations alike |
| G8 | Two-factor authentication | Out | | Dropped | Product decision. Better Auth has a 2FA plugin if this changes. |

## H. Integrations and API

| ID | Feature | Tier | Starts from | Status | Notes |
|---|---|---|---|---|---|
| H1 | Public REST API with API keys | P1 | Build | Done | `/api/v1`, with an OpenAPI description built from the data model. A key acts as the person who made it, under their role. 600 requests a minute per key |
| H2 | Outgoing webhooks per record event | P2 | Build | Done | An automation on a record trigger with an HTTP request step |
| H3 | MCP server for outside AI clients (Claude, ChatGPT) | P2 | Atomic | Not started | Port Atomic's edge function, or expose C1's tools |
| H4 | Gmail, Google Calendar, Drive, Notion for the agent | MVP | OpenDuet | In progress | In the admin's Plugins screen as OpenDuet ships them. Google's need the deployment's own OAuth client, entered there; Notion needs none. Not yet tried with real accounts |
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
