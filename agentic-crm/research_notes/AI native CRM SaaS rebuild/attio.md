# Attio (attio.com): product, AI, pricing, engineering architecture and company (as of 2026-11-10)

Source legend: **[1P]** = first-party (attio.com, docs.attio.com, Attio engineering blog, Attio changelog, Attio help center, Google Cloud blog quoting Attio's CTO). **[3P]** = third-party (aggregators, job boards, competitors, reviews). Dates in parentheses are publish dates. Anything dated 2024 or early 2025 is flagged as older. Where a fetch tool only returned a search snippet rather than the full page, it is marked "(search snippet)".

## Product: data model, email/calendar sync, auto-creation, enrichment, workflows, reporting, sequences, call recording, API/webhooks, App SDK, MCP

### Takeaway
Attio is a flexible object/record/attribute/list CRM. Email and calendar sync create People and Company records automatically. Built-in enrichment comes from unnamed third-party providers and cannot be exported. It also has AI-first Workflows (rebuilt June 2026), Sequences, a call recorder (Pro and up), reports, a REST API with webhooks, a TypeScript/React App SDK running in Attio's sandbox, a hosted OAuth MCP server with 48 tools, and (Oct 2026, beta) read-only SQL plus a Postgres-wire "Data Connector".

### Cited Findings

**Data model**
- Objects ≈ tables, records ≈ rows, attributes ≈ columns. Attributes sit on objects *and* on lists. Lists hold "entries", each pointing to one record, and lists can carry their own list-specific attributes (e.g. pipeline stage for a deal in a "Sales" list). — [1P docs: Objects and lists](https://docs.attio.com/docs/objects-and-lists.md)
- Standard objects: People and Companies are on by default. Deals, Users and Workspaces are optional standard objects (the last two model a SaaS customer's product users and accounts). Custom objects can be created in the UI or the API. — [1P docs: Objects and lists](https://docs.attio.com/docs/objects-and-lists.md); [1P docs index](https://docs.attio.com/llms.txt)
- Attribute types (REST API): actor reference, checkbox, currency, date, domain, email address, interaction (calendar events/emails), location, personal name, number, phone number, rating (0–5), record reference ("relationships and one-way links between records"), select, status (select designed for lists), text, timestamp. — [1P docs index](https://docs.attio.com/llms.txt)
- Formula attributes shipped Jul 28, 2026. They recompute like a spreadsheet when dependencies change. — [1P changelog](https://attio.com/changelog); [1P eng blog: formula attributes (Jul 2026)](https://attio.com/engineering/blog/how-we-built-formula-attributes)
- Records keep "entire change histories of each attribute". Relationship attributes link records. — [1P eng blog: formula attributes](https://attio.com/engineering/blog/how-we-built-formula-attributes)
- "Interfaces" let several objects share attributes and be queried "as a single logical table" in SQL. — [1P eng blog: new architecture (Oct 2026)](https://attio.com/engineering/blog/A-new-type-of-user-requires-a-new-type-of-architecture)
- System objects can be renamed (Aug 25, 2026). Files can be attached to Deals and custom objects (Feb 25, 2026). Email tracking was extended to Deals and custom objects (Jan 14, 2026). — [1P changelog](https://attio.com/changelog)
- **Activities** (Oct 29, 2026, beta): first-class, structured interaction data (support conversations, social DMs, product events) with custom schemas. Creating a custom activity type over the API "requires a billing feature". — [1P blog: architecture for agentic revenue (Oct 2026)](https://attio.com/blog/introducing-the-architecture-for-agentic-revenue); [1P docs index](https://docs.attio.com/llms.txt)
- Plan limits on objects and records: Free 3 objects / 50k records. Plus 5 objects / 250k records. Pro 12 objects (then $500 monthly or $400 annual per extra object per month) / 1M records. Ultra unlimited objects / 3M records. Extra records on Pro/Ultra cost $300 (monthly) or $240 (annual) per 1M records per month. Custom objects are Pro and Ultra only. — [1P pricing](https://attio.com/pricing)

**Email and calendar sync; automatic contact/company creation**
- Supports Gmail, Google Calendar, Microsoft 365 Outlook and Outlook Calendar. With default settings Attio creates records for people you have emailed or met, and their companies by domain match. The default is "selective" creation: no record for people who email you if you never replied. An "All contacts" mode exists. Admins can turn off automatic company creation (changelog Feb 25, 2026). Email forwarding is an alternative to full sync. — [1P help: email & calendar sync (search snippet)](https://attio.com/help/reference/email-calendar/email-and-calendar-syncing); [1P changelog](https://attio.com/changelog)
- A person's Company is set from the domain of their first listed email. If all of a person's emails are on public domains (gmail.com etc.), no company is created. — [1P help: enriched data](https://attio.com/help/reference/managing-your-data/enriched-data)
- Connected accounts per user: Free 1, Plus 1, Pro 2, Ultra 3+. — [1P pricing](https://attio.com/pricing)
- Homepage claims "15M emails synced/day". — [1P homepage](https://attio.com/)

**Enrichment**
- Company fields enriched: Name, Logo, Description, Categories, Location (City/State/Country), Estimated ARR\*, Employee Range\*, Funding Raised\*, AngelList/Facebook/Twitter, Foundation date, Team, Twitter follower count. (\*Not on Free.) — [1P help: enriched data](https://attio.com/help/reference/managing-your-data/enriched-data)
- Person fields enriched: Name, Profile picture, Description, Location, Facebook/Twitter, Company, Job title, Twitter follower count. A person needs an email and a company needs a domain. — [1P help: enriched data](https://attio.com/help/reference/managing-your-data/enriched-data)
- Source: the page says only "third-party providers", with no names. Enriched values show a purple background and a sparkle icon. Manual values are never overwritten. **"It is not possible to export enriched data from Attio."** — [1P help: enriched data](https://attio.com/help/reference/managing-your-data/enriched-data)
- Third-party enrichment is available as App Store apps and workflow blocks (Apollo, Databar, Harmonic, Clay). "Attio in Clay" shipped Mar 30, 2026. — [1P Apollo app](https://attio.com/apps/apollo-enrichment); [3P Harmonic docs](https://support.harmonic.ai/en/articles/15465318-use-harmonic-enrichment-blocks-in-attio-workflows); [1P changelog](https://attio.com/changelog)
- Pricing page lists "People enrichment" and "Company enrichment", with "Automatic enrichment" on Free. — [1P pricing](https://attio.com/pricing)

**Workflows / automations**
- "The new Workflows" (Jun 9, 2026) were rebuilt around AI agents. You describe a workflow and Attio builds it ("Agents, triggers, actions and more"). The blocks include Web Agent and Custom Agents, and Notion, Linear and Fin can be connected as native blocks or via MCP. — [1P changelog: the new Workflows](https://attio.com/changelog/2026/the-new-workflows)
- Follow-ups: new blocks (Jul 28, Aug 25, Sep 23), workflow history and a per-agent log (Sep 23), and Resend/ClickUp apps (Sep 23), all 2026. — [1P changelog](https://attio.com/changelog)
- Block taxonomy, from billing: triggers, logic and data lookups. Actions are create/update/delete/list/task/sequence, HTTP request and integration blocks. Variable-cost blocks are Execute code, SQL query, Classify record, Classify text, Summarize record, Web agent and Custom agent. — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- Homepage nav groups the product as Platform (Universal Context, Data Model, Enrichment, Call Intelligence, Reporting & Forecasts), Orchestration (Ask Attio, Workflows, Custom Agents, Web Agent, Sequences) and Ecosystem (Apps, MCP, Developer Platform; "Attio for" Slack, ChatGPT, Claude). — [1P homepage](https://attio.com/)
- "Rules" allowance: Pro 8 per object, Ultra unlimited. — [1P pricing](https://attio.com/pricing)

**Reporting**
- Reports: Free 3, Plus 15, Pro 100, Ultra unlimited. Types: Insights (Free), plus Funnels and Segments (Plus), plus Targets and Trends (Pro/Ultra). Branded "Reporting & Forecasts". — [1P pricing](https://attio.com/pricing); [1P homepage](https://attio.com/)

**Sequences and email sending**
- Sequences are on Pro and Ultra. Emails sent per user per month: Free 200, Plus 1,000, Pro/Ultra unlimited. Bulk send: 10 at once on Free, 50 on others. — [1P pricing](https://attio.com/pricing)
- Emails sent directly by sequences are credit-free. Enrollment inside a workflow costs credits. — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- The API has a sequences unsubscribe-list endpoint. — [1P docs index](https://docs.attio.com/llms.txt)

**Call recording / meeting notes ("Call intelligence")**
- Call intelligence is on Pro and Ultra. — [1P pricing](https://attio.com/pricing)
- The recorder bot joins Zoom, Google Meet and Microsoft Teams. Auto-record can be limited to external meetings (decided by participant domains). "@Attio leave" removes it. Recordings are visible to all workspace members and shareable externally. — [1P help: call recording (search snippet)](https://attio.com/help/reference/productivity-collaborating/call-intelligence/set-up-and-manage-call-recording)
- Users can turn off their own call recording (Oct 29, 2026). Calls are on mobile (Jun 29, 2026). — [1P changelog](https://attio.com/changelog)
- The API exposes meetings and call recordings (create-recording limited to 1 req/s). A `call-recording.created` webhook fires when the transcript and summary are ready. App SDK text actions work on transcript, summary and insight text. — [1P docs index](https://docs.attio.com/llms.txt)
- A competitor claims Attio covers video calls only, not in-person meetings (Oct 2026); this is unverified. — [3P Claap](https://www.claap.io/blog/attio-call-recording)

**API and webhooks**
- REST API rate limits: 100 reads/s and 25 writes/s. List records and list entries also have score-based limits, per query and cumulative over a 10-second sliding window across all apps and tokens, returning 429 with Retry-After. — [1P docs: rate limiting](https://docs.attio.com/rest-api/guides/rate-limiting)
- Webhooks cover record (created/updated/merged/deleted), list-entry, note, comment, task, activity and call-recording events. — [1P docs index](https://docs.attio.com/llms.txt)
- "API and webhooks" are on all four plans. — [1P pricing](https://attio.com/pricing)
- Files API (Mar 24, 2026). — [1P changelog](https://attio.com/changelog)
- Homepage claims "2.6B API requests/month". In Nov 2025 Attio cited ">20,000 calls per minute to our API" from "over 50 popular apps". — [1P homepage](https://attio.com/); [1P eng blog (Nov 2025)](https://attio.com/engineering/blog/where-s-the-technical-challenge-in-crm-anyway-)

**App SDK / marketplace**
- The App SDK lets developers "embed Typescript React applications within the Attio interface and run server functions with access to our REST API." — [1P docs home](https://docs.attio.com/)
- Surfaces: record actions (record page and CMD+K), record widgets, app pages, record tabs, workflow blocks (custom triggers and steps), and a workspace settings page. Apps can subscribe to Attio events, manage webhooks, receive HTTP requests, use a KV store and environment variables, and use "Connections" for third-party OAuth on behalf of users. Server functions run in Attio's sandbox. — [1P docs: SDK overview](https://docs.attio.com/sdk/overview.md); [1P docs index](https://docs.attio.com/llms.txt)
- The App SDK was announced in beta with the Series B (Aug 2025). The Universal Context post (Feb 2026) calls it "a Typescript based code sandbox" in "a fully managed serverless environment". — [1P Series B blog](https://attio.com/blog/attio-raises-52m-series-b); [1P eng blog: Universal Context](https://attio.com/engineering/blog/introducing-universal-context)
- There was a separate developer changelog (Oct 29, 2026), plus "Developer platform updates" (Apr 29 and Aug 25, 2026). Attio is listed in the ChatGPT store (Apr 29, 2026), is in Raycast via MCP (Mar 2026), and offers Notion custom agents via MCP (Mar 24, 2026). — [1P changelog](https://attio.com/changelog)

**MCP server**
- Hosted at `https://mcp.attio.com/mcp`. OAuth with the user's own login, no API keys, so the user's permissions apply. Read tools are auto-approved and write tools ask for confirmation. It has **48 tools** in groups: Records & Objects (incl. `upsert-record`, `merge-records`), Activities, Lists, Comments, Notes (incl. `semantic-search-notes`), Tasks, Meetings & Calls (incl. `semantic-search-call-recordings`, `get-call-recording` with transcript), Emails (incl. `semantic-search-emails`), Workspace (`whoami`), Reporting (`run-basic-report`), and SQL (`query-particle-sql`, plan-gated). — [1P docs: MCP overview](https://docs.attio.com/mcp/overview.md)
- MCP rate limits per workspace: read 100/s, write 25/s, merge 5/s, search 300/min, semantic search 2/s, reporting 2/s, SQL 2/s. — [1P docs: MCP overview](https://docs.attio.com/mcp/overview.md)
- Launched Feb 19, 2026. The design uses OAuth with dynamic client registration (chosen over client ID metadata documents for broader client support), "fewer, richer tools" built for agents rather than API wrappers, tool descriptions written as prompts, and responses in **TOON** (Token-Oriented Object Notation) to save tokens. Agents tested the tools in fresh contexts, using Claude Code skills and a harness. — [1P changelog](https://attio.com/changelog); [1P eng blog: Building the Attio MCP server (Feb 2026)](https://attio.com/engineering/blog/building-the-attio-mcp-server)
- "MCP server" is on all plans. Homepage claims "30M MCP tool calls/month". — [1P pricing](https://attio.com/pricing); [1P homepage](https://attio.com/)

**SQL and Data Connectors (Oct 2026, beta)**
- The SQL API is read-only (SELECT only), with an `objects` schema (one table per object) and a `lists` schema (one table per list). It is reachable via REST (JSON), MCP (`query-particle-sql`) and Data Connectors (PostgreSQL wire protocol). Limits: 30 s timeout and 2 queries/s. The docs say "Enterprise plan only". — [1P docs: SQL overview](https://docs.attio.com/sql/overview.md)
- Data Connectors are a "hosted, global, PostgreSQL wire protocol compatible SQL endpoint" at `data.attio.com`, with per-workspace credentials and no connection pooling needed. BI tools (Hex, Omni, Looker, Metabase, dbt) can connect directly. Admins can disable or regenerate the read-only credentials. — [1P eng blog: new architecture (Oct 2026)](https://attio.com/engineering/blog/A-new-type-of-user-requires-a-new-type-of-architecture); [1P blog: architecture for agentic revenue](https://attio.com/blog/introducing-the-architecture-for-agentic-revenue)
- Availability: SQL-powered questions in Ask Attio are on all plans. SQL via REST, MCP and Workflows, and Data Connectors, are Enterprise (blog). The pricing page puts "Query in SQL with API or MCP" and "Data connector (1 included)" on Ultra. — [1P blog](https://attio.com/blog/introducing-the-architecture-for-agentic-revenue); [1P pricing](https://attio.com/pricing)

### Inferences
- Attio's model closely mirrors a metadata-driven CRM: objects, attributes, lists as typed many-to-many "views with their own columns", plus per-attribute history. "Lists with list-level attributes" is the main structural difference from a classic objects+fields CRM like Twenty or Salesforce. It lets the same company sit in several pipelines with different stage and owner fields.
- Because enriched data is non-exportable and the providers are unnamed, Attio likely licenses enrichment data under redistribution restrictions. It also pushes heavier enrichment to partner apps (Apollo, Clay, Harmonic, Databar) rather than owning a data asset.
- The MCP tool set is effectively Attio's "agent API". Semantic search exists only for unstructured content (notes, emails, call recordings), while structured data is reached via search, list, report or SQL.

### Gaps
- Exact enrichment provider(s) are not disclosed in any first-party page I found. Whether enrichment consumes credits is not stated in first-party docs; a [3P marketbetter article](https://marketbetter.ai/blog/attio-crm-pricing-breakdown-2026/) claims seat credits cover automatic enrichment, which the 1P credits page does not list.
- Two help pages disagree on whether record-creation settings apply retroactively (search snippet only). I did not read the full email sync page.
- No first-party description of sequence volume limits, call-recording minute limits, transcription provider, or webhook signing scheme.
- There is no first-party page on App SDK runtime limits (CPU/time/memory), App Store review or revenue share.

## AI: Ask Attio, AI attributes, agents, credits, models, metering

### Takeaway
Attio's AI layer has four parts: Ask Attio, a chat agent that can act (launched Feb 4, 2026); AI attributes (Summarize, Classify, Prompt completion, Web agent); agent blocks inside Workflows (Custom Agent, Web Agent); and MCP/SQL access for external agents. Everything is metered in "credits": a personal per-seat Ask Attio pool plus a shared per-workspace pool. Credits are sold in monthly add-on packs. Ask Attio is multi-provider (Anthropic, Vertex AI/Gemini, OpenAI), with Claude Sonnet 5 as the "Auto" default since Jul 28, 2026.

### Cited Findings

**Ask Attio**
- Ask Attio launched Feb 4, 2026 and was redesigned Feb 25. It reached Slack Mar 10, gained the ability to take actions Apr 29, got custom context May 28, dictation Aug 25, and suggested follow-up questions Sep 23 (all 2026). — [1P changelog](https://attio.com/changelog)
- Technical design (Mar 2026): it is built on an existing agent harness. "Each conversation turn builds its own capability registry at runtime" based on permissions, feature flags and context. Conversations are trees ("each message references its parent"); edits and regenerations fork. The UI registers an "interest" in what is on screen (a call, deal or company), and the backend hydrates it into structured context injected with the user message. — [1P eng blog: Ask Attio technical look](https://attio.com/engineering/blog/ask-attio-a-technical-look-at-our-new-agent)
- Generative UI: the model emits Markdown fenced blocks containing JSON that name a UI component (record cards, follow-ups, call snippets with an audio player, mailbox sync indicators). "Defining a new component requires only a single Zod schema", which validates output, drives incremental parsing and renders. A streaming-aware parser suppresses incomplete Markdown, and a streaming JSON parser runs alongside. — [1P eng blog: Ask Attio](https://attio.com/engineering/blog/ask-attio-a-technical-look-at-our-new-agent)
- Providers: "Ask Attio runs across multiple providers, including Anthropic, Vertex AI, and OpenAI", behind a shared abstraction with "automatic request-level failover and platform-level short-circuiting". — [1P eng blog: Ask Attio](https://attio.com/engineering/blog/ask-attio-a-technical-look-at-our-new-agent)
- Models: Claude Opus 4.7 became the default in Ask Attio on Apr 16, 2026. On Jul 28, 2026: "Claude Sonnet 5 is the new Auto default", with GPT 5.6 Terra, GPT 5.6 Sol, Gemini 3.6 Flash and Gemini 3.5 Flash Lite added. "Every model is now available in Ask Attio and the Workflow Custom Agent block." — [1P changelog](https://attio.com/changelog); [1P changelog: more models](https://attio.com/changelog/2026/more-models-in-ask-attio)
- Ask Attio uses read-only SQL tools, so SQL-powered questions work on all plans (Oct 2026). — [1P eng blog: new architecture](https://attio.com/engineering/blog/A-new-type-of-user-requires-a-new-type-of-architecture); [1P blog: agentic revenue](https://attio.com/blog/introducing-the-architecture-for-agentic-revenue)

**AI attributes**
- Summarize record (text, 1 credit/record; cannot read notes/emails). Web agent (text/number/currency, 10 credits/record; researches the web in real time, optional green/yellow/red confidence with reasoning and sources). Prompt completion (text/number/currency, 1 credit). Classify record (select/multi-select, 1 credit). Available on all plans. They **never run automatically**: you run them per cell, per selection or per view. Auto-runs go through workflow AI blocks writing to a normal attribute. Blank results are refunded, except Classify with no match or fallback. — [1P help: AI attributes](https://attio.com/help/reference/attio-ai/ai-attributes)
- The "Web research agent" AI attribute was upgraded on Mar 24, 2026. — [1P changelog](https://attio.com/changelog)

**Agents in Workflows**
- Custom Agents ("qualify leads, brief meetings, draft follow-ups") and the Web Agent are workflow blocks (Jun 2026). — [1P changelog: the new Workflows](https://attio.com/changelog/2026/the-new-workflows)
- Homepage claims "76k active customer agents". — [1P homepage](https://attio.com/)
- Older (Jun 2025): the internal "Thread Agent" framework. Agents are plain objects run via `createThread`, and the same feature code runs whether it takes "4 seconds or 48 hours". There is a `priority` setting to defer work, batch-API support, and executions "round-robin'd across workspaces". A jest-style eval framework (`defineAgentTestSuite`) uses exact-match to LLM-ranked scorers and tracks cost and latency per model variant. Every run is traced in admin tooling, and every LLM/tool call is "attributed to the workspace, the feature, and the request". The scale cited for one week was "~600k LLM completions", "~40k tools" and "over a billion tokens". Example variants then were GPT-4o and Vertex `gemini-1.5-flash-002` (dated Jun 2025). The first agent built was the Research Agent in Workflows. — [1P eng blog: You can't just prompt your way… (Jun 2025)](https://attio.com/engineering/blog/you-cant-just-prompt-your-way-to-great-ai-features)

**Credits and metering**
- Two pools. **Seat credits** are personal, cover Ask Attio only and are not shareable. **Workspace credits** are shared and cover workflows, AI attributes and Ask Attio overflow. Ask Attio uses seat credits first, then workspace credits unless an admin disables that. Admins can cap Ask Attio's share of workspace credits; the default is no cap. Members with nothing left are blocked until renewal. Credits reset monthly on the billing date. — [1P help: manage workspace and seat credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- Allotments per month: Free 250 workspace / 100 per seat. Plus 1,500 / 500. Pro 10,000 / 1,000. Ultra 20,000 / 2,500. Enterprise custom / 2,500. — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits); [1P pricing](https://attio.com/pricing)
- Approximate Ask Attio costs (Auto model): meeting prep or call summary 10–20 credits. Follow-up email or tasks 15–20. Daily briefing 30–50 (more with web search). Multi-customer search plus drafted emails 50–80. Cost varies with complexity, CRM context, model and web research. — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- New workflows: triggers, logic and lookups are free. Each action, HTTP or integration block costs 1 credit. AI blocks (Classify, Summarize, Web agent, Custom agent, Execute code, SQL) "bill by token usage". Failed blocks and blocks after a failure are not charged. Legacy workflows charged "Research record" at 10 credits per question per run. — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- Record summaries are free on paid plans. — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- Add-on workspace credit packs per month (annual/monthly price): 5,000 = $70/$85. 10,000 = $120/$150. 25,000 = $260/$330. 50,000 = $475/$595. Admins can see usage by workflow, member and feature. — [1P pricing](https://attio.com/pricing); [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits)
- AI policy: Attio commits "to not train our AI systems on your data". — [1P help: Security at Attio](https://attio.com/help/reference/workspace-settings-billing/security/security-at-attio)

### Inferences
- Implied price per credit: $0.014 (5k pack, annual) falling to $0.0095 (50k pack, annual). So a 10-credit web-agent lookup costs roughly $0.10–0.14 at list price, and a 50–80 credit Ask Attio task about $0.50–1.10.
- "Bill by token usage" for AI blocks plus a model picker means credits are a token-cost pass-through with a markup, not a flat per-action fee. Choosing a cheaper model (Gemini Flash Lite) likely burns fewer credits. This is not confirmed: the changelog does not state per-model credit rates.
- The capability-registry-per-turn and Zod-schema UI-component patterns are directly reusable designs for any agentic CRM chat.

### Gaps
- Per-model credit multipliers and the credit-to-token conversion rate are not published.
- Which models power AI attributes and the Web agent, and which search provider the Web agent uses, are not disclosed. The Jun 2025 post shows only generic `SearchTool`/`CurlTool`.
- Whether unused credits roll over is not stated (the help page is silent; the wording "renew" suggests no rollover).
- No first-party detail on agent evals or guardrails for Custom Agents beyond the Jun 2025 framework.

## Pricing and plans (late 2026)

### Takeaway
As of Nov 2026 the public plans are Free, Plus, Pro and Ultra. They are priced **per workspace with included users, plus per added user**, not purely per seat. Plus is $40/mo annual (1 user, +$35 per extra user). Pro is $100/mo annual (1 user, +$79 per user). Ultra is $1,000/mo annual (5 users, +$189 per user). Enterprise still appears in help and SQL docs but not on the pricing page. Prices rose in July 2026.

### Cited Findings
- Free: $0, up to 3 users. Plus: $50/mo (monthly billing) or $40/mo (annual) per workspace, including 1 user; add users at $44/$35. Pro ("Most popular"): $125 or $100/mo per workspace including 1 user; add users at $99/$79. Ultra: $1,000/mo, annual only, including 5 users; add users at $189. — [1P pricing](https://attio.com/pricing); [1P pricing/usd](https://attio.com/pricing/usd)
  - Note: the fetched page text renders both figures together (e.g. "$5040mo/workspace"). One fetch read the higher number as a struck-through price, another as the monthly-billing price. The page states annual is "about 20% less than monthly", which fits the monthly/annual reading.
- Ultra description: "For teams and orgs running multiple GTM motions at scale." It includes SSO, SCIM and audit logs, unlimited objects and reports, 3M records, a Data connector (1 included) and "Query in SQL with API or MCP". — [1P pricing/usd](https://attio.com/pricing/usd)
- Governance add-on for Pro (SSO, SCIM, audit logs): $30 per user per month, billed annually. — [1P pricing](https://attio.com/pricing)
- User caps: Free 3, Plus 10, Pro/Ultra no limit. Teams: Pro up to 10, Ultra unlimited. Private lists from Plus. File storage 50 GB on Free/Plus, unlimited on Pro/Ultra. — [1P pricing](https://attio.com/pricing)
- There is a 14-day Pro trial for every new workspace. Startups (≤10 users, applying within 90 days) get 80% off annual Pro in year 1 and 30% off in year 2. — [1P pricing](https://attio.com/pricing)
- Price history [3P]: before July 2026, Plus was $29 and Pro $69 per user per month (annual). On Jul 27, 2026 they rose to $35 and $79 (annual); monthly rates are $44 and $99. This source (data as of Sep 2026) describes pure per-seat pricing with no base fee or Ultra. — [3P marketbetter](https://marketbetter.ai/blog/attio-crm-pricing-breakdown-2026/)
- Enterprise is still referenced in first-party docs: the credits table lists "Enterprise: custom workspace credits / 2,500 seat credits", and the SQL docs say "Enterprise plan only". — [1P help: credits](https://attio.com/help/reference/workspace-settings-billing/manage-workspace-and-seat-credits); [1P docs: SQL](https://docs.attio.com/sql/overview.md)

### Inferences
- Attio appears to have moved (between Sep and Nov 2026) from per-seat pricing to a per-workspace platform fee with one included user plus per-seat add-ons. This lets them charge for workspace-level AI credit pools and records independently of seats. Effective annual cost for 5 users: Plus ≈ $40 + 4×$35 = $180/mo. Pro ≈ $100 + 4×$79 = $416/mo. Ultra = $1,000/mo.
- Ultra seems to sit where "Enterprise" did (SSO, SQL, Data Connectors) at a published price. Enterprise likely survives as a sales-led custom tier.
- Monetization levers to model: seats; workspace platform fee; record overage ($240–300 per 1M); object overage ($400–500 each); credit packs; governance add-on.

### Gaps
- I could not confirm when the per-workspace base-fee structure and Ultra launched; there is no changelog entry for pricing.
- No published Enterprise price.
- No published enrichment-credit allowance; enrichment does not appear as a metered line item.

## Engineering architecture: stack, flexible schema, multi-tenancy, sync ingestion, AI agent runtime, security

### Takeaway
Confirmed first-party facts: Attio runs on **Google Cloud**, with **Cloud Spanner as its primary database** (and Spanner Omni across environments, plus the new Spanner queues). It uses **Google Pub/Sub** for change events and multi-tenant work distribution, **Rust** for the write path of its "Particle" graph-relational data model and its query engine ("Centaur", a Postgres-wire-compatible, horizontally scalable SQL engine with separate compute and storage), and **TypeScript/Node.js "everywhere" else**. The frontend is React and React Native, and untrusted third-party code runs in **QuickJS compiled to WASM** on Node worker threads. Multi-tenancy is shared infrastructure keyed by workspace ID (Pub/Sub ordering keys per workspace, round-robin agent execution across workspaces). There is no public detail on physical schema layout or sharding.

### Cited Findings

**Cloud and databases**
- "Google Spanner … our primary database." Particle's write side "was rebuilt as a Rust service" that emits change events through **Google Pub/Sub** as data is written. Heavy formula functions (e.g. `hasBeenIn()`) can be "offloaded to Spanner" as SQL. — [1P eng blog: formula attributes (Jul 2026)](https://attio.com/engineering/blog/how-we-built-formula-attributes)
- "Attio … has built its platform on Spanner. Attio migrated its agentic application environment to a full-featured and containerized Spanner Omni + managed Spanner." CTO Alexander Christie: "we are building the world's most advanced agentic application environment on Spanner … allowing our agents to bring complex, mission-critical workflows such as the newly announced Spanner queues, to production." (Sep 30, 2026.) — [1P-quoted, Google Cloud blog](https://cloud.google.com/blog/products/databases/spanner-omni-deploy-anywhere-version-of-spanner-is-now-ga)
- Job posts list GCP, Kubernetes, Pulumi and Terraform (infra as code), TypeScript/Node.js, Rust, and Go/Python acceptable. Spanner or CockroachDB is a "bonus" or "very nice to have". — [3P Redpoint job board: Rust & TypeScript role](https://careers.redpoint.com/companies/attio/jobs/42550005-senior-product-engineer-rust-typescript); [3P outscal: Staff Engineer Security/Infra/Perf](https://outscal.com/job/staff-engineer-security-infrastructure-and-performance-at-attio-in-london-england-united-kingdom-1); [3P Pulumi archive](https://archive.pulumi.com/t/26764683/attio-is-a-startup-building-the-next-generation-crm-we-conti); [3P Senior Platform Engineer listing](https://huntukvisasponsors.com/job/senior-platform-engineer-60snzifkbzef); [3P Built In backend role](https://builtin.com/job/senior-product-engineer-backend/7774448)
- Vertex AI is used as a model provider. — [1P eng blog: Ask Attio](https://attio.com/engineering/blog/ask-attio-a-technical-look-at-our-new-agent)

**Languages and frameworks**
- "We use TypeScript everywhere" (Jun 2025). — [1P eng blog: Thread Agent](https://attio.com/engineering/blog/you-cant-just-prompt-your-way-to-great-ai-features)
- "Our Rust-based query engine" serves "thousands of queries per second" over a "petabyte-scale dataset" (Nov 2025, by VP Eng Phil Beevers). — [1P eng blog: Where's the technical challenge in CRM anyway?](https://attio.com/engineering/blog/where-s-the-technical-challenge-in-crm-anyway-)
- React and React Native (declarative virtualized lists, Sep 2025; OTA-update crash debugging in the RN mobile app, Mar 2026). Zod is used for AI UI component schemas. Lezer and CodeMirror power the formula language and editor. — [1P eng blog index](https://attio.com/engineering/blog); [1P eng blog: formula attributes](https://attio.com/engineering/blog/how-we-built-formula-attributes); [1P eng blog: Ask Attio](https://attio.com/engineering/blog/ask-attio-a-technical-look-at-our-new-agent)
- Protobuf encoding appears in the CSV importer (Jun 2025). — [1P eng blog index](https://attio.com/engineering/blog)
- Untrusted third-party code runtime (May 2025): QuickJS running inside WebAssembly on V8, executed on Node.js worker threads, with a fresh WASM module per execution for isolation. Disabling V8's Liftoff baseline compiler fixed multi-thread slowdowns. — [1P eng blog: V8 Liftoff / WASM (May 2025)](https://attio.com/engineering/blog/how-v8s-liftoff-compiler-broke-our-wasm-execution)

**Flexible schema: Particle, Universal Context, Centaur**
- Particle is a "flexible graph-relational format". Universal Context (Feb 2026, updated Jul 2026) builds on Particle and adds semantic embeddings and full-text search, kept in sync with transactional data. It claims **External Consistency**, "the highest possible level of transactional consistency", "the first system in any CRM to provide" it. It contrasts with legacy CRMs where "indexing pipelines … happen asynchronously from the initial write". Pinecone and Turbopuffer are cited only as examples of bolt-on vector DBs Attio avoids. — [1P eng blog: Introducing Universal Context](https://attio.com/engineering/blog/introducing-universal-context)
- "Project Centaur" (Oct 2026) is a "Postgres compatible, horizontally scalable SQL query engine" that "doesn't share a single line of code with Postgres". It translates Postgres-protocol queries into logical plans executed against Universal Context. Compute workers scale separately from storage using "the same techniques as a data warehouse like Snowflake or BigQuery". Storage is Particle, transactionally consistent. Objects, attributes, records and values map to a "virtual SQL schema" discoverable via `INFORMATION_SCHEMA` and `pg_catalog`. Historical data is exposed "in a more complex tabular form". Every query sees the "latest, transactionally consistent state", with no replication lag versus ETL. The cited data volume is "100's of millions of structured and unstructured data points". — [1P eng blog: A new type of user requires a new type of architecture](https://attio.com/engineering/blog/A-new-type-of-user-requires-a-new-type-of-architecture)
- The design goal is "the behaviors and semantics of a structured, strongly-typed, relational data model" plus large volumes of unstructured data, extensible with custom objects and attributes. — [1P eng blog (Nov 2025)](https://attio.com/engineering/blog/where-s-the-technical-challenge-in-crm-anyway-)

**Multi-tenancy**
- The formula recompute pipeline runs on Pub/Sub, a "message-driven, multi-tenant system". Each tenant gets an ordering key derived from its workspace ID, and "a single ordering key can be only consumed by a single consumer … at a time", so a tenant is served by a limited slice of the worker pool (fairness and noisy-neighbor control). Every batch reads at "a common transaction read timestamp". — [1P eng blog: formula attributes](https://attio.com/engineering/blog/how-we-built-formula-attributes)
- Agent executions are "round-robin'd across workspaces" (Jun 2025). — [1P eng blog: Thread Agent](https://attio.com/engineering/blog/you-cant-just-prompt-your-way-to-great-ai-features)
- API and MCP rate limits are enforced per workspace. Data Connector credentials are provisioned per workspace. — [1P docs: MCP](https://docs.attio.com/mcp/overview.md); [1P eng blog: new architecture](https://attio.com/engineering/blog/A-new-type-of-user-requires-a-new-type-of-architecture)

**Real-time sync, ingestion and scale**
- Client edits apply "without blocking on round trips to the server". The app has local storage, "offline syncing and real-time collaboration". — [1P eng blog (Nov 2025)](https://attio.com/engineering/blog/where-s-the-technical-challenge-in-crm-anyway-)
- Interaction data (email, meetings, other channels) is "streamed into the platform in real time", with peak ingestion "in excess of 250,000 events per minute" and "thousands of workflows being initiated every minute". Data is processed by "extracting and enriching them with semantic meaning". — [1P eng blog (Nov 2025)](https://attio.com/engineering/blog/where-s-the-technical-challenge-in-crm-anyway-)
- Current scale claims: "15M emails synced/day", "2.6B API requests/month", "30M MCP tool calls/month", "76k active customer agents". — [1P homepage](https://attio.com/)
- Engineering throughput: "14,420 pull requests merged in the past year" (sidebar stat on 2026 posts). — [1P eng blog: Universal Context](https://attio.com/engineering/blog/introducing-universal-context)

**AI agent runtime (durable execution and tool calls)**
- Thread Agent (Jun 2025) runs callbacks mapped to "standard async task processors". The same code handles seconds to 48-hour runs, with priority and deferral, batch APIs, per-workspace and per-feature cost attribution, and full traces of model, tool and sub-agent calls. — [1P eng blog: Thread Agent](https://attio.com/engineering/blog/you-cant-just-prompt-your-way-to-great-ai-features)
- Ask Attio (Mar 2026) uses a per-turn capability registry gated by permissions and feature flags; tools query data, render UI and take actions; it has multi-provider failover. — [1P eng blog: Ask Attio](https://attio.com/engineering/blog/ask-attio-a-technical-look-at-our-new-agent)
- Spanner queues are used to bring agent workflows to production (Sep 2026 quote). — [Google Cloud blog](https://cloud.google.com/blog/products/databases/spanner-omni-deploy-anywhere-version-of-spanner-is-now-ga)
- Workflow history and a per-agent log are exposed to users (Sep 23, 2026). — [1P changelog](https://attio.com/changelog)

**Security and compliance**
- The Trust Center at trust.attio.com is the public hub for "certifications, penetration test reports, and security questionnaires". The help page does not name the certifications. — [1P help: Security at Attio](https://attio.com/help/reference/workspace-settings-billing/security/security-at-attio); [1P Trust Center (JS-rendered, content not retrievable)](https://trust.attio.com/)
- SSO, SCIM and audit logs come via the Governance add-on on Pro or are included in Ultra. Granular permissions shipped Feb 18, 2026. — [1P pricing](https://attio.com/pricing); [1P changelog](https://attio.com/changelog)
- OAuth app security: rotating a client secret does not revoke tokens (use `POST https://app.attio.com/oauth/revoke`). Attio may lock apps and revoke their tokens. — [1P docs: security](https://docs.attio.com/share/security.md)
- A competitor (Coffee) claims Attio holds ISO 27001 and GDPR but not SOC 2 Type II, while another Coffee page says Attio "maintains SOC 2 compliance". These claims conflict, are competitor-authored and are unverified. — [3P Coffee](https://www.coffee.ai/articles/attio-crm-customer-data-security)

### Inferences
- **Schema-on-Spanner (inference):** a "graph-relational" Particle model with per-attribute history, plus a virtual SQL schema generated from metadata, strongly suggests an entity–attribute–value-style storage layout (records, attribute definitions and versioned value rows keyed by workspace/object/record/attribute) on Spanner. A Rust query engine then presents it as virtual per-object tables, rather than Twenty-style per-tenant physical schemas or DDL per custom field. Not confirmed; Attio never describes the physical layout.
- **Multi-tenancy (inference):** shared Spanner database(s) with workspace ID as the leading primary-key component (Spanner's interleaving and key-range splits give automatic horizontal sharding by tenant), plus per-workspace fairness in Pub/Sub and agent schedulers. This is the opposite of schema-per-tenant or database-per-tenant.
- **Search and embeddings (inference):** "External Consistency" is Spanner's TrueTime guarantee, and Spanner now has native full-text and vector search. Universal Context therefore likely stores embeddings and full-text indexes in Spanner itself, transactionally with writes, instead of an async Elasticsearch/Pinecone pipeline.
- **Durable agent execution (inference):** a custom TypeScript framework on async task processors, now likely backed by Spanner queues (transactional enqueue with data writes) rather than Temporal. There is no evidence of Temporal anywhere.
- **Email/calendar ingestion (inference):** streaming ingestion of mailbox events into Particle, with Pub/Sub fan-out to enrichment, auto-creation, formula and workflow consumers. Exact sync mechanics (Gmail push/history API vs polling, Microsoft Graph subscriptions) are not published.
- **Google CASA (inference):** Attio's Gmail sync must use Google restricted scopes, which normally requires an annual CASA assessment. No source confirms its tier.

### Gaps
- No first-party statement on SOC 2 Type I/II, ISO 27001, CASA tier, HIPAA, or data residency/regions; trust.attio.com could not be read (client-rendered).
- No public detail on the physical storage layout for attribute values, Spanner instance topology or regions, or how tenants map to databases.
- No conference talks or podcast transcripts surfaced; I found no YouTube or engineering talk with additional stack detail within the search budget.
- Search engine for "full-text search across records" (`search-records`) is not named.
- Observability stack, CI/CD and frontend state management are not found.

## Company: funding, headcount, customers/ARR, positioning

### Takeaway
Attio is a London-based company led by co-founders Nicolas Sharp (CEO) and Alexander Christie (CTO). It raised a $52M Series B led by GV in Aug 2025, for $116M total. A reported $80M Series C (Aug 2026) is unconfirmed. Headcount is roughly 165–176 (third-party estimates, 2026). Customer claims grew from 5,000 paying customers (Aug 2025) to "more than 7,000 teams" (Feb 2026) to "30,000+ customers" (homepage, Nov 2026); the definitions likely differ. Positioning is "The CRM for agentic revenue", against "legacy CRMs".

### Cited Findings
- Series B: $52M led by GV (Google Ventures), with Redpoint Ventures, Balderton Capital, Point Nine and 01A. $116M raised to date. "5,000 paying customers". "On track to 4x ARR growth this year". Named customers: Lovable, Granola, Modal, Replicate, Public. GV's Michael McBride joined the board. Announced Aug 2025. — [1P Series B blog](https://attio.com/blog/attio-raises-52m-series-b); [PR Newswire](https://www.prnewswire.com/news-releases/attio-raises-52m-series-b-to-scale-the-first-ai-native-crm-for-go-to-market-builders-302538357.html)
- Older: a $23.5M round in Mar 2023, led by Redpoint (per TechCrunch headline). — [TechCrunch (Mar 2023)](https://techcrunch.com/2023/03/02/attio-raises-23-5m-to-build-a-next-gen-crm-platform/)
- One aggregator lists a "Series C Aug 25, 2026, $80M led by Redpoint, total $196M". No other source, including Attio's blog, corroborates it. — [3P Fundbat](http://fundbat.com/company/attio/) (unverified)
- Valuation: not disclosed. Dealroom estimates $250–500M (2025). — [3P Dealroom](https://dealroom.co/companies/attio/)
- Headcount: ~166 (Revelio Labs, Mar 2026), 175 (TipRanks, Jun 2026), 176 (Dealroom). — [3P Revelio](https://www.reveliolabs.com/companies/attio/employees); [3P TipRanks](https://www.tipranks.com/private-companies/attio); [3P Dealroom](https://dealroom.co/companies/attio/)
- Customer counts: "more than 7,000 teams" (Feb 2026). "Trusted by 30,000+ customers" (homepage, Nov 2026). Customer stories: Granola, Modal, Railway, TaskRabbit. — [1P Universal Context post](https://attio.com/engineering/blog/introducing-universal-context); [1P homepage](https://attio.com/)
- Positioning: the homepage title is "Attio: The CRM for agentic revenue", "The only CRM with Universal Context™". Series B framing: "Legacy CRMs still assume a world of manual inputs, rigid workflows, and human-only operators." Salesforce and HubSpot are named only as "Import from" migration sources, not in comparison claims. — [1P homepage](https://attio.com/); [1P Series B blog](https://attio.com/blog/attio-raises-52m-series-b)
- Oct 2026 "architecture for agentic revenue" launch: three layers, Context (Universal Context), Orchestration (agents and workflows) and Ecosystem (apps, MCP, SQL). "Thousands of agents can work on customer data under the same permissions." — [1P blog](https://attio.com/blog/introducing-the-architecture-for-agentic-revenue)
- Engineering leaders named in posts: Alexander Christie (CTO and co-founder), Phil Beevers (VP Engineering), Jamie Davies (Engineering Lead, AI). — [1P eng blog index](https://attio.com/engineering/blog)

### Inferences
- The jump from 7,000 "teams" to 30,000+ "customers" in about nine months most likely reflects counting free workspaces, or a definitional change, rather than 4x paid growth. Treat 5,000 *paying* (Aug 2025) as the last clean paid figure.
- Positioning has shifted from "next-gen flexible CRM" (2023–2024) to "AI-native CRM" (2025) to "agentic revenue platform / CRM as a database for agents" (2026). The moat they argue is data infrastructure (transactionally consistent context, SQL and MCP), not UI.

### Gaps
- No public ARR figure, and no confirmed 2026 funding round.
- Founding year conflicts across aggregators (2017 vs 2019); not verified first-party.
- No founder podcast or interview transcripts were retrieved within budget (a GV interview with Nicolas Sharp exists at [gv.com](https://gv.com/news/interview-with-nicholas-sharp-founder-of-attio) but was not read).
