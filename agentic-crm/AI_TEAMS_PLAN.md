# AI teams for small businesses: plan

From Greg Isenberg's episode with Nick Vasilescu (Orgo), Nov 2 2026, mapped onto Magpie.

## 1. What the episode describes

A small business gets a **team of ready-made Bots for its industry**, not a general assistant it has to set up. Each Bot is a specialist: front desk, sales, outreach, one per platform such as LinkedIn or email. Each one:

- has a role, and does scheduled work on its own;
- can be reached like a person: its own email address, phone number (text and calls), and Slack;
- has its own computer to work on, logged in to the accounts it runs;
- comes with apps the business needs, such as a CRM, a refreshed website, or a lead-magnet calculator.

The owner doesn't configure anything. Someone who understands their industry installs it and makes it work.

**Two ways to sell it:**

| | Done for you (one to few) | Industry product (one to many) |
|---|---|---|
| Price | $25,000 up front (often half now, half at the end), then an optional $3,000 a month after a 30-day setup | A subscription priced well above general assistants, because it's built for one industry |
| Why owners buy | They own the system. One Bot replaces part of a $50k to $70k hire, and they get several | No setup, it fits how their industry works |
| Sweeteners | A free website redesign, lead magnets, and a money-back guarantee tied to a result (for example, faster replies) | Seat-based pricing that grows with the team |

**How to get the first customers:**

1. Call 50 people you know who run or help run a business. Don't pick a niche first.
2. Do the first build free. Shadow the owner while they share their screen on manual work (invoices, quotes, follow-ups); that shows which Bots to build.
3. Value the free build at around $50,000 a year, and ask for introductions to 3 peers in return. Every sale after that is warm.

**What the episode leaves open:** there's no proof yet that the $25k model works with non-technical owners. Viewers also asked about security and client confidentiality. Validate with one free build before relying on the numbers.

## 2. Where Magpie already is

| What the episode needs | Magpie today |
|---|---|
| A team of Bots, each with a role | Bots with standing roles, Team Bots, memory and skills. An edition's package (`agents.yaml`) can ship ready-made Bots |
| Knows the business | The company brief, read by every Bot on every run |
| Does work without being asked | The work plan (scheduled jobs you switch on), routines, triggers, check-ins |
| Shows its work | Last 7 days on Today, plus Inbox for approvals |
| Safe to let loose | Approval before any change or send, an audit log, roles, SSO and SCIM |
| Apps for the business | CRM, deals, proposals with public pages, meetings, email, dashboards, automations |
| Connectors | Composio (Gmail, Calendar and hundreds more), Notion, Drive, treg data, Firecrawl |
| Industry versions | Editions as packages (name, logo, Bots, skills). Kontract (government contracts) is the first, half built |
| Owner owns the system | Each company gets its own Railway project and database |
| Its own computer | One shared browser per workspace today. `COMPUTER_SUPERVISOR_URL` gives each Bot its own |
| Its own email address | Partly: inbound email triggers give each trigger an address (Amazon SES, `OPENBOT_INBOUND_EMAIL_DOMAIN`), not set up yet. Outbound mail goes from the person's or a shared mailbox |
| Its own phone number | Missing. Voice exists only in the app (talking to a Bot in the browser) |
| Slack and Teams | Missing: the OpenTag decision is still open |
| Website and lead magnets | Missing. Bots can make pages, and proposals already have public links |

Most of the hard parts are built. What's missing is the "reach it like a person" layer, the team split, and the industry packaging.

## 3. The plan

### Phase 0: pick the first niches by selling, not building (1 to 2 weeks, mostly you)

- Make your list of 50 and call them. Pitch: "a team of AI employees for your business, set up for you, that asks before it does anything."
- Pick 1 or 2 free builds. Two candidates already have real data:
  - **UGC Mediakits:** a creator and UGC agency, with the workspace and sample data loaded.
  - **Kontract:** small government contractors, with the engine live.
- Run each free build with the playbook in phase 5, and agree the 3-introduction trade before starting.

### Phase 1: a team, not one Bot (about 1 week)

- The planning Bot proposes 2 to 5 specialist Bots from the brief (for example Front desk, Sales, Marketing, Operations), each with a role and only the tools its jobs need.
- Each job in the work plan gets an owner Bot, and "Turn all on" creates any missing Bots.
- Today gets a **Team** card: each Bot, what it's on, what it did this week, and what's waiting.
- Editions ship a default team in `agents.yaml`, and a plan template the planning Bot starts from.

### Phase 2: reach each Bot like a person (about 2 weeks)

Decided Nov 2:
- AgentPhone is skipped, so phone and text are out of version 1.
- AgentMail stays an option for Bot inboxes.
- Bots keep using our own computer, not Orgo. Ours costs almost nothing at today's use. Look at Orgo again if each Bot needs its own computer running all day: its Small size runs about $17 a month always on, against $16 to $25 for the same container on Railway.


1. **Email:**
   - Each Bot gets an address on the company's domain (for example `frontdesk@`), built on the inbound email triggers that already exist.
   - Mail to it starts a run.
   - Replies go out from that address after approval, unless the owner allows a type of reply without asking.
   - Pick the provider: Amazon SES as the code already uses, or AgentMail as in the episode (check its pricing and terms first).
2. **Phone and text:**
   - Each Bot that faces customers gets a number.
   - Texts become a conversation with the Bot.
   - Calls are answered with the voice Magpie already uses in the app.
   - Calls and texts that need a decision go to Inbox.
   - Before building:
     - choose a provider (Twilio or a voice-agent service; the episode names "Agent Phone", which needs checking);
     - US business texting needs A2P 10DLC registration, which takes days to weeks;
     - check the call-recording consent rules in each state.
3. **Slack and Teams:** decide OpenTag (fork it, or ask CopilotKit), then give each Bot its handle.
4. **Its own computer:** turn on `COMPUTER_SUPERVISOR_URL` for editions that need browser work, with idle stop to keep the cost down (COGS.md: $3 to $6 a month each).

### Phase 3: industry editions (about 1 week each, after a free build)

An edition is:

- a name and logo;
- its Bots;
- its skills;
- a work plan template;
- CRM fields;
- sample data;
- a landing page.

Build them in order of what the calls turn up:

1. **Kontract (government contracts):** finish milestone 2 (quote links, the Bids screens, Word export).
2. **Creator and UGC agencies:** lead lists and outreach already exist. Add creator rosters and campaign tracking.
3. **Next, from the calls:** the episode's examples were dental clinics, insurance agencies and promotional products. Don't build any of these before someone has asked for it.

### Phase 4: the extras that close deals (about 1 week)

- **A website Bot:** it builds a one-page site or redesign as a public Magpie page, and updates it on request.
- **Lead magnets:** small public calculators or quizzes (such as a quote estimator). Each answer becomes a contact in the CRM.
- **Proof for the guarantee:** the weekly report grows a "promise" line, such as the median reply time to new leads, or leads and meetings booked. You and the owner can both see whether the guarantee was met.

### Phase 5: the offer and the playbook (alongside, mostly you)

**Implementation in 30 days:**

| Week | What happens |
|---|---|
| 1 | Discovery call; shadow 2 or 3 manual processes on screen share; write the brief |
| 2 | Connect apps; set up the team and the plan; run each job once with the owner watching |
| 3 | Turn the jobs on; check every approval together; tune the instructions |
| 4 | Review against the promise; get the case study; ask for the 3 introductions |

**Pricing to decide:**

- **Done for you:** a setup fee and a monthly fee. The episode used $25k and $3k. A lower entry point, such as $5k to $10k setup and $1k to $2k a month, may be easier for a first deal. Serving a company costs roughly $30 to $100 a month (COGS.md), so any of these leaves a wide margin.
- **Industry product:** an edition priced above Team and Business, for example $299 to $499 a seat, with the same run allowances in COGS.md.

**Answering the security question:**

- Each company gets its own isolated project and database.
- Bots ask before they act, and every action is logged.
- Connected accounts stay the owner's.
- Nothing is shared between companies.

## 4. Decisions for you

1. **Offer:** done for you, an industry product, or both, and the first price you'll quote.
2. **First niche:** UGC agencies, government contractors, or whatever the 50 calls turn up.
3. **Phone in the first version:** phone is the most expensive and slowest part (provider, registration, consent rules). Email and Slack can come first.

## 5. Order of work

1. Phase 1 (the team), because it's useful at once and every edition needs it.
2. Phase 2 email, then Slack, then phone.
3. Kontract milestone 2, in parallel or right after.
4. Phase 4 extras, once the first free build shows which ones matter.
