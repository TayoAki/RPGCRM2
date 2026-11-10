# Magpie: product requirements

**Status:** ready to build. **Owner:** founder. **Last updated:** 2026-11-10.

Magpie is a CRM whose Bots find work, do the paperwork and text the owner to approve. This document says what to build and how to tell it works. [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md) say how. [BUILD_PLAN.md](BUILD_PLAN.md) says in what order.

## 1. Summary

**Who it's for (first):** owners of small trades and facilities companies that already win public contracts. That means janitorial, landscaping, HVAC and plumbing, painting, roofing and moving, with 1 to 50 employees, in the US, with an active SAM.gov registration and $50K to $5M a year in public awards.

**Their problem:** the owner finds and writes bids personally, at 8 to 40 hours a proposal, or pays an offshore assistant $3 to $12 an hour to search portals, read solicitations, chase subcontractor quotes and track deadlines. Bid tools sell data the owner thinks is free. Proposal tools are built for teams with capture managers.

**What Magpie does:** a team of Bots does that assistant's job:
- Bid Scout searches federal, state and local bids every day and scores them against the business.
- Bid Reader reads the solicitation and lists every requirement and deadline, each with the page it came from.
- Estimator prices the job from wage rules, past awards and subcontractor quotes.
- Sub Finder finds subcontractors, asks them for quotes and chases replies.
- Proposal Writer drafts the package.
- Deadline Keeper and Follow-up keep everything on time.

The owner gets a morning text, replies to approve, and nothing leaves the business without their yes.

**Why we win:**
1. It brings opportunities, where other CRMs only record them.
2. It does the response work, where other tools stop at a search feed.
3. The owner runs it from their phone.
4. Trust is earned and visible: every fact cites its source, and every outside action waits for approval.
5. Month-to-month pricing per business, compared with the cost of a hire rather than a seat.

**Expansion (later releases):** tech companies selling to government (Slack, CRM sync, SOC 2), then sales teams selling to local businesses (permits, new businesses, local listings). The same engine serves all three.

## 2. Evidence

Full research: [`../reports/Ideal customer profile.md`](../reports/Ideal%20customer%20profile.md) and [`../reports/AI native CRM SaaS rebuild.md`](../reports/AI%20native%20CRM%20SaaS%20rebuild.md).

- **Owner time:** "somewhere between 8 and 40 hours of my time" per complex proposal (JetCo Federal owner, House hearing, 2025-09-10).
- **They already outsource it:** 105 open job posts on OnlineJobs.ph on 2026-11-10 asked for SAM.gov bid assistants. They list daily portal searches, solicitation reading, wage-determination pricing and subcontractor quote calls. One says: "Opportunities must be reviewed and approved before any supplier outreach."
- **Price anchors:** Bid Banana $49.99 a month, HigherGov $500 a year, an offshore assistant $400 to $1,500 a month. Reviews show they resent paying for public data, auto-renewals and lock-ins.
- **AI objections:**
  - GAO dismissed protests built on AI-fabricated citations (2025-09-25).
  - Some 2026 solicitations ban AI or require disclosing it.
  - 51% of firms under $10M are "open to AI but not using it".
- **The market:** in FY2025 about 1,000 to 1,400 small businesses per trade code won federal contracts, mostly under $250K each. The same firms also bid state and local work.

## 3. Users

| Persona | Who | What they need |
|---|---|---|
| **Owner** (primary) | Dana, 44, owns a 12-person janitorial company in Virginia with three federal contracts. Bids at night. Lives on her phone. | New winnable bids every morning, the paperwork done, a yes or no by text, nothing sent without her. |
| **Office manager or estimator** | Runs the office, keeps the bid calendar, prepares price sheets. Works on a laptop. | One place for bids, deadlines, quotes and documents. Bots that do the reading and chasing. |
| **Magpie reviewer** (staff) | Magpie employee on the Managed plan | A queue of Bot drafts to check and edit before the owner sees them. |
| **Magpie operator** (staff) | Runs the platform | Tenant health, costs, support access with an audit trail, flags, suspensions, exports. |
| Later: **GovTech founder** | Founder or first public-sector seller at a 5 to 50 person tech company | The same loop in Slack, synced with HubSpot or Salesforce, behind SOC 2. |
| Later: **SDR manager** | Sells to local businesses | Prospects from permits and new filings, with verified owner phones and a reason to call. |

## 4. Product principles

These settle disagreements during the build.

1. **AI drafts, a person sends.** Any action that reaches someone outside the business (email, SMS, a submission, a calendar invite to an outsider) needs a person's approval. No setting turns this off in v1.
2. **No citation, no claim.** Every requirement, deadline, price input and extracted quote amount links to the document, page and sentence it came from. If the Bot can't cite it, it says it doesn't know.
3. **Text first.** Anything that needs the owner arrives as a short message they can answer by replying. The web app is the back office.
4. **Trust is earned.** Internal actions (create a task, move a bid to Reviewing, add a note) start as "ask first". After a Bot's suggestions are approved unchanged often enough, Magpie offers to let it do them without asking.
5. **Respect the solicitation.** If a solicitation bans or limits AI, Magpie flags it, switches that bid to no-AI drafting and keeps a log of what AI produced anywhere else.
6. **No lock-in, no hype.** Month-to-month billing, cancel in the app, export everything. Never claim guaranteed contracts.
7. **Cheap to run.** Every model call is metered per tenant and Bot. Public data is read once and shared.

## 5. Releases

| Release | Milestones | Contents |
|---|---|---|
| **MVP** (sellable to 10 pilot owners) | M0 to M6 | Sign-up and workspaces, company profile, bid discovery and matching, CRM core, bid workspace with all seven Bots, approvals, SMS, Telegram and the digest, billing and limits |
| **v1** (general availability) | M7 to M9 | Operator console, Managed plan review queue, public API, MCP server, outgoing webhooks, automations, reports, import and export polish, hardening |
| **v1.5** (Segment B) | after v1 | Slack app, HubSpot and Salesforce sync, SSO and SCIM, per-seat Team plans, SOC 2 Type I, SBIR topic feed |
| **v2** (capture and Segment C) | after v1.5 | Gmail and Outlook reading (after Google's CASA assessment), meeting notes, local-business prospecting (permits, new filings, local listings), custom objects, WhatsApp, native apps, dedicated database tier |

Everything below is MVP unless its row says otherwise.

## 6. Functional requirements

Each requirement has an id used in tests and commits (`FR-BID-3`). "Done" means its acceptance criteria pass in automated tests where stated, and in the demo script in [BUILD_PLAN.md](BUILD_PLAN.md).

### 6.1 Accounts and workspaces (FR-ACC)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-ACC-1 | Sign up with email and password, a magic link, or Google or Microsoft login. Sign-up creates a user and a workspace (tenant) with the person as owner. | A new visitor reaches the onboarding screen in under 60 seconds. The tenant, membership, settings, pipelines, Bot team, default jobs and trial plan exist (DATA_MODEL §17). |
| FR-ACC-2 | Invite teammates by email with a role: admin, member or viewer. | The invitee gets an email and joins with that role. Invites expire after 7 days. Only owners and admins invite. |
| FR-ACC-3 | One person can belong to several workspaces and switch between them. | The switcher lists memberships. Data from one workspace never appears in another (isolation suite passes). |
| FR-ACC-4 | Roles control what people can do (matrix in [SECURITY.md](SECURITY.md)). | Viewers can't write. Members can't change billing, roles or Bot autonomy. The API returns 403 with a plain message. |
| FR-ACC-5 | Owners can transfer ownership, export all data and delete the workspace. | Export produces a ZIP of CSV and JSON plus files within 1 hour. Deletion is scheduled 30 days out and can be canceled; after that, every row and file is gone. |
| FR-ACC-6 | Sessions expire after 30 days of inactivity. People can sign out of all devices. | Covered by tests. |

### 6.2 Onboarding and company profile (FR-PRO)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-PRO-1 | A guided setup of five steps, each skippable: business lookup, what you do, where you work, certifications and limits, phone. | It completes in under 5 minutes with a UEI. Progress is saved after each step. |
| FR-PRO-2 | Look up the business by UEI or name and prefill legal name, address, NAICS codes, certifications and SAM status. | With a valid UEI, those fields fill from market data (Kontract or SAM.gov). Each prefilled field records `field_provenance` source `sam`. |
| FR-PRO-3 | Edit the profile: NAICS codes, PSC codes, certifications, service area (states, counties, radius), trades the business performs itself, capabilities, differentiators, bonding, insurance, labor rates, contract size range. | Saving validates codes against the NAICS list and stores them in `company_profiles`. |
| FR-PRO-4 | Add past performance entries and library items (boilerplate, certificates, insurance certificates, W-9, licenses) with expiry dates. | Items expiring within 30 days show on Today and in the digest. |
| FR-PRO-5 | After setup, suggest two or three saved searches built from the profile and show sample matches right away. | At least one saved search is created with one tap. A first scan runs within 2 minutes. |
| FR-PRO-6 | Warn when the SAM registration expires within 60 days or has lapsed. | A warning shows on Today and in the digest. |

### 6.3 Bid discovery (FR-DIS)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-DIS-1 | Search federal (SAM.gov) and state and local bids from one screen. Filters: keywords, exclude words, NAICS, PSC, set-aside, state, agency, value range, due within N days, notice type. | Results come back in under 3 seconds p95 and show title, agency, place, set-aside, due date, value range and source. |
| FR-DIS-2 | Save a search. Bid Scout scans saved searches on schedule (default every 4 hours on business days) and creates matches. | New notices matching an active search appear as `opportunity_matches` with status `new`. The same notice never matches twice. |
| FR-DIS-3 | Score each match 0 to 100 against the profile, with reasons. Factors: NAICS fit, set-aside eligibility, distance from service area, value against contract size range, time to due date, related past performance, known incumbent. | Each match shows its score and three or more reasons. Matches the business isn't eligible for (for example, an 8(a) set-aside without 8(a)) are scored 0 and hidden by default. |
| FR-DIS-4 | Open a notice: summary, key dates, documents list, place of performance, agency, links to the source. | Opens in under 2 seconds. Documents can be read in the app. |
| FR-DIS-5 | Act on a match: Pursue (creates a bid in the Bids pipeline at Found, linked to the notice), Save for later, or Dismiss with a reason. | Pursue creates exactly one deal per notice per workspace. Dismissal reasons teach the scorer: similar notices from the same agency and NAICS lose points for 90 days. |
| FR-DIS-6 | Matches can be acted on from the digest by text (see FR-CH). | Replying with the number and "yes" pursues that match. |
| FR-DIS-7 | Watch for amendments and award notices on pursued bids. | An amendment creates a `bid_documents` row of kind `amendment`, notifies the bid owner and re-runs Bid Reader on what changed. An award notice moves the bid to Won or Lost when the awardee is clear, and asks the owner otherwise. |

### 6.4 Bid workspace (FR-BID)

The bid workspace is the deal page for `kind='bid'` deals.

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-BID-1 | Collect documents automatically from the notice; let people upload more (PDF, DOCX, XLSX, images). | Public documents are fetched once and shared through `market_opportunity_texts`. Uploads go to `bid_documents` plus `files` and are scanned for malware before reading. |
| FR-BID-2 | Bid Reader writes a **bid brief**: scope in plain words, place, dates, contract type and length, evaluation method, bonding and insurance, wage determination, site visit, submission method, AI-use rules, red flags. | The brief arrives within 10 minutes for a 100-page solicitation. Every fact has a citation link that opens the document at the page with the sentence highlighted. |
| FR-BID-3 | Bid Reader builds the **compliance matrix**: one row per requirement, with category, mandatory flag, citation and status. | On the golden test set (BUILD_PLAN M4), recall of mandatory requirements is at least 90% and every row has a valid citation. Rows can be edited, added, assigned and marked met or not met. |
| FR-BID-4 | Extract **deadlines** (questions due, site visit, proposal due, amendment acknowledgment) into `bid_deadlines` with citations, in the solicitation's timezone. | Deadlines show on the bid, on Today and in an ICS feed. Reminders go out at 72, 24 and 2 hours before. |
| FR-BID-5 | **Bid or no-bid** recommendation with score and reasons: eligibility, fit, capacity, distance, competition, price range, time left. | The owner can accept or override. The decision and reasons are stored in `deals.bid_decision`. No-bid moves the deal to No bid with the reason. |
| FR-BID-6 | **AI-use clause** detection. If the solicitation bans AI drafting, set `deals.is_ai_drafting_allowed=false`, show a banner and stop drafting tools on that bid. If it requires disclosure, keep `drafts.ai_disclosure` up to date and offer a disclosure statement. | The test fixtures with ban and disclosure clauses are detected. Drafting tools return `ai_drafting_not_allowed` on banned bids. |
| FR-BID-7 | Track **submission**: method, time, confirmation, files. | Marking Submitted needs a submission record. It moves the deal to Submitted and starts the award watch. |
| FR-BID-8 | Show a **bid timeline**: documents, Bot actions, approvals, messages, quotes, stage changes. | Built from `activities` linked to the deal. |
| FR-BID-9 | **Bid package export**: the approved drafts, price sheet and checklist as DOCX and PDF, plus a ZIP of everything. | Exports open in Word and Acrobat without errors. |

### 6.5 Pricing (FR-PRC)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-PRC-1 | Estimator finds the **wage determination** that applies (Service Contract Act or Davis-Bacon) from the solicitation, and its rates for the needed labor categories. | Rates show with WD number, revision and a citation. If none is found, the Estimator says so and asks. |
| FR-PRC-2 | Estimator pulls **comparable past awards** (agency, NAICS, place, size) and shows a price range. | At least 3 comparables when market data has them. Each links to its award record. |
| FR-PRC-3 | Estimator drafts a **price sheet**: labor lines from the profile's labor rates and the wage determination (with fringe and burden), materials, equipment, subcontract lines from received quotes, overhead and profit. The sheet is versioned. | Totals are computed in code, never by the model. Each line shows its source. A person approves a version before it goes into a package. |
| FR-PRC-4 | Warn when the price falls outside the comparable range or the margin is below the tenant's floor. | A warning shows with the numbers. |
| FR-PRC-5 | Check **limitations on subcontracting** for set-aside bids: the share paid to subs against FAR 52.219-14 caps (50% services, 85% general construction, 75% special trades). | A warning shows when the price sheet's subcontract share exceeds the cap for the bid's type. |

### 6.6 Subcontractors and quotes (FR-SUB)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-SUB-1 | Sub Finder suggests subcontractors near the place of performance by trade: from the CRM first, then from market data (SAM entities, Kontract's sub search, the businesses' own websites). | Suggestions show distance, source and contact path. Places data stores only `place_id`. |
| FR-SUB-2 | Draft **quote requests** with scope, site details, due date and attachments. Each request uses a tracked reply address unique to that request. | Sending needs approval (external action). The email goes out from the owner's connected Gmail or Outlook with `Reply-To` set to the tracked address. Sending through Magpie's own domain waits for Postmark's written OK (ARCHITECTURE §15 ruling 24). |
| FR-SUB-3 | Route **replies** to the right quote request. Parse amounts, validity, scope notes and exclusions from the body and attachments. | A reply to the tracked address shows on the bid within 1 minute and is forwarded to the owner's email. Parsed amounts need a person to confirm before they reach a price sheet. |
| FR-SUB-4 | **Follow up** on quote requests with no reply: default 2 follow-ups, spaced before the due date. Sub Finder drafts them on time. | Each follow-up is an approval in v1, like every external action. |
| FR-SUB-5 | Compare quotes side by side; pick one to use in the price sheet. | The chosen quote becomes a subcontract line with its citation. |
| FR-SUB-6 | Honor opt-outs. Every outreach email has a working unsubscribe link and the tenant's postal address. | Unsubscribed or bounced addresses go to `suppressions`, and sending to them is blocked. |

### 6.7 Proposal drafting (FR-DRF)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-DRF-1 | Proposal Writer drafts the sections the solicitation asks for: cover letter, technical approach, staffing, past performance, quality control, quote letter, capability statement. It uses the profile, past performance, library items and the compliance matrix. | Each draft section lists the requirements it answers. Uncovered mandatory requirements show as gaps. |
| FR-DRF-2 | Rich-text editor with versions, compare, restore and comments. | Editing never loses work (autosave every 5 seconds). Versions are kept. |
| FR-DRF-3 | Respect page limits, fonts and file naming rules from the solicitation. | A warning shows when the export breaks a stated limit. |
| FR-DRF-4 | Never invent facts. Claims about the business must come from the profile, past performance or the library. | Evaluated in the M4 eval set: zero invented contract numbers, dollar amounts or references. |

### 6.8 CRM core (FR-CRM)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-CRM-1 | Companies (agencies, primes, subs, customers, suppliers, partners, competitors), contacts, deals, tasks and notes with full create, read, update and archive. | All screens and APIs go through one records layer that applies roles. |
| FR-CRM-2 | Pipelines and stages, editable per workspace. Kanban and table views of deals. | Drag a card to change stage. Each stage change writes `record_history` and an activity. |
| FR-CRM-3 | Timeline on every record from `activities`. | Shows notes, emails, texts, Bot actions, approvals, quotes, stage changes and files, newest first, paginated. |
| FR-CRM-4 | Custom fields on companies, contacts and deals (14 types). Each field can be set to be filled by Bots: off, suggest or auto, with instructions. | "Suggest" creates `field_suggestions` that a person accepts. "Auto" writes the value and its provenance. |
| FR-CRM-5 | Saved views: filters, sort, columns, layout (table, kanban, calendar), personal or shared. | Views persist and load in under 1 second for 10,000 records. |
| FR-CRM-6 | Global search across companies, contacts, deals and matches, with fuzzy matching. | Results in under 300 ms p95 for a workspace with 50,000 records. |
| FR-CRM-7 | Tags and bulk actions (tag, assign, change stage, archive). | Bulk actions on 1,000 records finish in under 10 seconds. |
| FR-CRM-8 | CSV import with column mapping and dedupe (by email for contacts, by UEI or domain for companies), and CSV export of any view. | A 10,000-row import finishes in under 2 minutes and reports errors per row. |
| FR-CRM-9 | Merge duplicate contacts and companies. | Links, notes, tasks, activities and deals move to the kept record in one transaction. |
| FR-CRM-10 | Field history on every record: who changed what, from what, to what, including Bots. | Shown on the record and stored in `record_history`. |

### 6.9 Bots and autonomy (FR-BOT)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-BOT-1 | A Bot team per workspace: Assistant, Bid Scout, Bid Reader, Estimator, Sub Finder, Proposal Writer, Deadline Keeper and Follow-up (roles in [AGENT_RUNTIME.md](AGENT_RUNTIME.md)). People can rename them, add instructions and turn them off. | Seeded on sign-up. A turned-off Bot's jobs stop. |
| FR-BOT-2 | Bots act only through tools, under the permissions of the person they act for. | A Bot acting for a viewer cannot write. Tested per tool. |
| FR-BOT-3 | Each tool has a policy per Bot: always allow, needs approval, or off. External tools are locked to needs approval. | Policies are shown and editable on the Bot's page (owners and admins only). |
| FR-BOT-4 | **Earned autonomy:** after 10 approvals in a row unchanged for an internal tool, Magpie suggests letting the Bot do it without asking. | The suggestion appears once per tool per Bot. Accepting changes the policy and writes an audit row. |
| FR-BOT-5 | **Learning mode** for a new job: the Bot runs and reports what it would have done, without doing it. | No tool with an effect executes in learning mode. Tested. |
| FR-BOT-6 | **Bot jobs** on schedules or events: scan opportunities, daily digest, deadline watch, quote follow-ups, award watch. Owners and admins can change times and turn jobs off. | Jobs run within 5 minutes of their time. Runs show in the Bot's activity. |
| FR-BOT-7 | A **runs log** per Bot: trigger, steps, tools used, approvals, cost and outcome. | Owners see cost per Bot per month. |
| FR-BOT-8 | **Memory:** Bots remember facts and preferences the owner states ("we don't do work in DC", "always add 12% overhead"), shown and editable on a Memory page. | A remembered preference changes the next relevant run (eval). People can delete a memory. |
| FR-BOT-9 | **Limits:** caps on steps per run and cost per run by plan. A run that hits a cap stops cleanly and tells the person. | Tested with a tool loop. |

### 6.10 Approvals (FR-APR)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-APR-1 | Every approval shows what will happen: the full email or SMS, the record change as a before and after, or the document. It also shows why the Bot wants it and its sources. | The preview renders the same on web, SMS (short form plus link) and Telegram. |
| FR-APR-2 | Decide with Approve, Edit then approve, or Skip, on the web, by SMS reply, by Telegram button, or through the API. | The decision resumes the waiting run within 5 seconds p95. |
| FR-APR-3 | An Approvals inbox lists pending items, oldest first, with bulk approve for internal ones. | External approvals can't be bulk approved. |
| FR-APR-4 | Approvals expire after `approval_expiry_hours` (default 72). Deadline-bound approvals expire at the deadline. | The run continues without the action and says so in the timeline. |
| FR-APR-5 | Every decision is audited: who, when, through which channel, and what was edited. | Rows in `audit_log`, and counters on `tool_policies`. |

### 6.11 Channels, digest and chat (FR-CH)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-CH-1 | Connect **SMS** by verifying a mobile number with a 6-digit code. | Codes expire in 10 minutes, with at most 5 tries. STOP turns SMS off for that number. HELP replies with instructions. |
| FR-CH-2 | Connect **Telegram** with a deep link (`/start <code>`) from the app. | Only private chats are accepted. `/stop` disconnects. |
| FR-CH-3 | The **morning digest** at the owner's chosen hour, by SMS or Telegram, plus email: new matches (top 5), deadlines this week, approvals waiting, quotes received, expiring documents, and one-line Bot news. | Delivered within 10 minutes of the time. Under 1,000 characters for SMS, with numbered items and a link. |
| FR-CH-4 | **Reply grammar** for SMS and Telegram: `1` or `Y1` pursues match 1; `N1` dismisses it; `A7` or `Y A7` approves approval A7; `X A7` skips it; `E A7` returns an edit link; `?` lists pending items; any other text goes to the Assistant as chat. | Each reply is answered with a confirmation. Unknown codes get a helpful reply. Tested with a fixture table of inputs and outputs. |
| FR-CH-5 | **Quiet hours** (default 9pm to 7am local): non-urgent texts wait. Deadline reminders inside 2 hours ignore quiet hours. | Notifications get `send_after` set to the end of quiet hours. |
| FR-CH-6 | **Chat** with the Assistant on the web (streamed) and in Telegram and SMS. The Assistant can answer from the CRM and bids ("what's due this week?"), take actions through tools, and start other Bots' work. | First token in under 2.5 seconds p95 on the web. Tool actions follow the approval rules. |
| FR-CH-7 | "Ask a Bot" from any record, with that record as context. | The thread links to the record. |
| FR-CH-8 | In-app notifications and web push (PWA) for approvals and alerts. | Web push works on Chrome, Edge and Safari on macOS and iOS 16.4+ when installed. |

### 6.12 Billing, plans and limits (FR-BIL)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-BIL-1 | 14-day trial without a card. | Trial limits apply (BILLING.md). Reminders go out 3 days and 1 day before the end. |
| FR-BIL-2 | Choose a plan through Stripe Checkout; manage card, plan and invoices through the Stripe Customer Portal. | Subscription changes reach `subscriptions` and `entitlements` within 1 minute through webhooks. |
| FR-BIL-3 | A usage page shows runs, document pages and texts used against the plan, plus cost per Bot (owners and admins). | Numbers match `usage_counters`. |
| FR-BIL-4 | Limits: alert at 80%, keep working and alert everyone at 100%, pause scheduled Bot jobs at 120% until a run pack is bought or the period resets. Chat and approvals keep working. | Tested by simulating usage. |
| FR-BIL-5 | Run packs (1,000 runs) as one-off purchases. | The entitlement rises right after payment succeeds. |
| FR-BIL-6 | Failed payment: past due for 7 days with banners and email, then Bot jobs pause, then read-only after 14 days, then data kept for 60 days. | State machine tested (BILLING.md). |
| FR-BIL-7 | Cancel in the app at any time. Access lasts until the period ends. | No retention dark patterns: one confirmation screen with an optional reason. |

### 6.13 Settings and admin (FR-SET)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-SET-1 | Workspace settings: name, logo, timezone, digest hour, quiet hours, outreach footer and postal address, approval expiry, AI drafting switch, model provider exclusions. | Owners and admins only. Changes are audited. |
| FR-SET-2 | Connections: Gmail or Outlook for sending, verification and enrichment keys (bring your own). | Tokens are encrypted (`secrets`). Disconnect revokes and deletes them. |
| FR-SET-3 | People and roles, invites, and API keys (v1). | Revoking a key takes effect immediately. |
| FR-SET-4 | Audit log viewer for owners: filter by person, Bot, action and date. | Read-only. |

### 6.14 Operator console and managed review (FR-OPS, v1)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-OPS-1 | A staff-only console at `/ops`: tenants with plan, status, MRR, usage, AI and vendor cost, and margin. | Visible only to `users.is_staff`. Every view is audited. |
| FR-OPS-2 | Impersonate a tenant user for support with a required reason, a visible banner and a time limit (60 minutes). | Writes during impersonation are tagged with `impersonated_by`. External actions are blocked while impersonating. |
| FR-OPS-3 | Suspend, unsuspend, extend a trial, grant credit, set entitlement overrides, schedule deletion. | Each is audited and reversible except completed deletion. |
| FR-OPS-4 | Feature flags, global or per tenant. | Changes take effect within 1 minute. |
| FR-OPS-5 | **Managed review queue**: on the Managed plan, external approvals first go to a staff reviewer (`review_stage='staff'`), who can edit, approve to send on to the owner, or send back to the Bot with notes. | Reviewers see only their assigned tenants. Median review time shows per reviewer. |
| FR-OPS-6 | Cost dashboard: AI, SMS, Kontract and enrichment spend per tenant per day against revenue. | Matches `usage_events` totals. |

### 6.15 API, MCP and webhooks (FR-API, v1)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-API-1 | Public REST API at `/api/v1` with API keys acting as a person, an OpenAPI document and docs page. | Resources: companies, contacts, deals, tasks, notes, matches, approvals (list and decide), runs (read). Rate limit 600 requests a minute per key. |
| FR-API-2 | MCP server at `/mcp` with OAuth sign-in, for Claude, ChatGPT and other AI clients. | Tools: search records, read a record, list bids due, list matches, create a task, add a note, create a draft. Writes follow approval rules. |
| FR-API-3 | Outgoing webhooks for record and approval events, signed with HMAC. | Retries with backoff for 24 hours. Deliveries are visible and can be resent. |

### 6.16 Automations and reports (FR-AUT, FR-REP, v1)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-AUT-1 | Simple automations: a trigger (record created, field changed, stage changed, date reached, schedule, incoming webhook), conditions, then steps (update record, create task, notify, start a Bot task, send a templated email for approval, call a webhook). | Built as a form, not a canvas. Runs are logged and retried 3 times. |
| FR-REP-1 | Reports with number, bar, line and table widgets over companies, contacts, deals and matches, plus fixed bid metrics: bids found, pursued, submitted, won, win rate, average bid value, time spent by Bots. | Widgets load in under 2 seconds for 50,000 records. |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Security and privacy | Pooled tenancy with forced RLS and an isolation test suite. Encryption in transit and at rest. Secrets use envelope encryption. Audit log. Least-privilege database roles. See [SECURITY.md](SECURITY.md). |
| Performance | Targets in [ARCHITECTURE.md §13](ARCHITECTURE.md#13-performance-and-scale-targets-v1). |
| Availability | 99.5% monthly. Planned maintenance under 10 minutes, announced 48 hours ahead. |
| Data | Point-in-time restore for 7 days, plus daily logical backups kept 30 days. Restore drill every quarter. |
| Accessibility | WCAG 2.2 AA for the web app: keyboard paths, focus states, contrast, labels. |
| Devices | Latest two versions of Chrome, Edge, Safari and Firefox. Phone layouts from 360px wide. The PWA is installable. |
| Language | US English at launch. All strings live in message catalogs so French and Spanish can follow. |
| Compliance | CAN-SPAM for outreach. SMS only to verified users of the workspace (no texts to their customers in v1). Google and Microsoft API policies. FAR AI-use clauses respected. No training on customer data by model providers. SOC 2 readiness controls from M10. |
| Cost | Typical tenant COGS under 30% of plan price. AI cost per run tracked and alerting when a tenant's cost passes 50% of its revenue. |

## 8. Plans (provisional)

Prices and allowances live in `plans` and can change without a deploy. Confirm them with metering data from the pilot.

| Plan | Price | Users | AI runs a month | Document pages read | Saved searches | SMS segments | Notes |
|---|---|---|---|---|---|---|---|
| Trial | free, 14 days | 3 | 150 | 300 | 2 | 100 | No card needed |
| Bid Desk | $149 a month | 3 | 600 | 1,500 | 5 | 300 | Month-to-month |
| Bid Desk Pro | $399 a month | 10 | 2,000 | 6,000 | 25 | 1,000 | Priority support |
| Managed | $999 a month | 10 | 4,000 | 10,000 | 50 | 2,000 | A Magpie reviewer checks every outside message and package before the owner sees it |
| Team (v1.5) | $99 per seat | per seat | 400 per seat | 1,000 per seat | 10 | 200 per seat | For Segments B and C |
| Run pack | $150 | | +1,000 | +2,500 | | | One-off |

An **AI run** is one Bot turn: a chat reply, a job firing or a task step, whatever the number of model calls inside it, up to the plan's step cap.

## 9. Words in the product

Use these words everywhere a person reads text, including server error messages that reach the browser.

| Say | Not |
|---|---|
| **Bot**, **Bots** (capitalized) | agent, AI, assistant (as a generic noun) |
| **bid** (a deal you're pursuing) | opportunity (in the UI), deal (on bid pages) |
| **match** (a notice that fits your searches) | lead, hit |
| **approve**, **skip**, **edit** | accept, reject, deny |
| **workspace** | tenant, organization, account (in the UI) |
| **connect**, **disconnect** | link, integrate |
| **admin** | administrator |

Style:
- Say what happened, then what to do.
- Keep sentences short and use second person.
- Use sentence case for headings and buttons. Buttons are verbs.
- No internals outside admin screens: no "token", "OAuth", "webhook" or "RLS".
- No em dashes.

## 10. Success metrics

| Metric | Target by end of pilot |
|---|---|
| Activation: profile done and first match acted on within 24 hours of sign-up | 60% of sign-ups |
| Time from Pursue to first full bid brief | under 15 minutes median |
| Bids submitted per active workspace per month | 2 or more |
| Approvals decided by text (SMS or Telegram) | 50% or more |
| Approvals accepted unchanged, per Bot, by week 4 | 70% or more |
| Monthly logo churn | under 5% |
| Gross margin per workspace | 70% or more at typical use |

## 11. Out of scope for v1

- Reading Gmail or Outlook inboxes (v2, after CASA).
- Texting the owner's customers or subs.
- Automatic submission to procurement portals.
- Call recording and meeting bots.
- Custom objects and a page-layout editor.
- Marketplace or app SDK.
- Native mobile apps.
- Dedicated databases per customer.
- Two-factor authentication beyond what Google and Microsoft login provide. Add Better Auth's 2FA plugin in v1.5 if pilots ask.

## 12. Risks and open questions

| Risk | Mitigation |
|---|---|
| Kontract outages or gaps in state and local coverage | `OpportunitySource` port with a direct SAM.gov adapter as fallback (M2). Show source health on the Bids screen. |
| Bid Reader misses a mandatory requirement | Golden-set evals in CI, citations on every row, "not found" over guessing, and the owner's final review. |
| AI cost per run higher than planned | Metering from day one, tiered models, shared reading of public documents, per-run caps. |
| Owners don't connect a phone | Email digest as fallback. The onboarding step explains why. |
| SMS deliverability and 10DLC approval delays | Register the Magpie brand and campaign during M0. Telegram and email cover the gap. |
| Pilots want inbox reading early | Tracked reply addresses cover quotes. Start CASA once paying customers exceed 50. |
| Solicitations that ban AI | Detection plus a no-AI mode (FR-BID-6). Never hide AI involvement. |

Open questions for the founder, with the default the build uses until answered:
1. Final plan prices and allowances. **Default:** the table in §8.
2. Default model provider order. **Default:** Anthropic first, OpenAI fallback, configurable (ARCHITECTURE §8).
3. Managed review staffing hours. **Default:** business hours US Eastern, with a 4-hour target.
4. Postmark's written OK for sending quote requests from Magpie's domain. **Default:** quote requests need a connected Gmail or Outlook mailbox until Postmark says yes.
