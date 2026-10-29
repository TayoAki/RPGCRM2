# Magpie CRM: cost of goods sold, pricing and limits

What it costs to serve a customer, what to charge, and which usage limits keep the margin safe. Prices are as of October 2026. Re-check the four inputs marked **verify** before publishing a price list.

## 1. Where the money goes

| Cost | Paid | Amount | Basis |
|---|---|---|---|
| **AI model** (OpenAI) | per assistant run | **~$0.10 a run** (range $0.05 to $0.20) | GPT-5.5 list price, $5 per million input tokens and $30 per million output. **Verify:** the built-in Bot runs `gpt-5.6-terra`, whose price isn't published |
| **Railway**: app + database | per workspace | **$5 idle, $8 to $12 in use** | Measured on UGCMediakits: app 0.37 GB memory and 0.02 vCPU, database 0.11 GB and 0.9 GB disk. Railway charges $10 per GB of memory, $20 per vCPU and $0.15 per GB of disk, per month |
| **Composio** | per person | **~$1** | ~1,600 calls a month (the brief, mail and calendar checks) at $0.0003, plus triggers at $0.003 each |
| **OpenTag** (Slack and Teams, planned) | per workspace | ~$1 to $2 | One small extra service |
| **Bot computer** (browser, not on customer workspaces yet) | per workspace | ~$3 to $6 with idle stop, $10 to $20 always on | 1 to 2 GB of memory while a browser runs |
| **Stripe** | per invoice | 2.9% + $0.30 | US cards |
| Customer mail (SMTP/IMAP) | | $0 | The customer's own mailbox |

An **assistant run** is one Bot turn: a chat reply, a task step, a routine firing or the morning brief. A run is usually 2 to 4 model calls, each sending ~15k to 25k tokens of instructions, tools and history (most of it cached) and getting ~1k tokens back.

### Fixed monthly costs, whatever the number of customers

| Item | Per month |
|---|---|
| Railway Pro plan (includes $20 of usage, which covers the sign-up service) | $20 |
| CopilotKit Intelligence (10,000 interactions a month across all customers) | $49 |
| Composio Pro (includes $29 of usage, ~96k calls) | $29 |
| Domain | ~$1 |
| **Total** | **~$99** |

## 2. One seat, one month

A typical seat: 8 runs a workday from chat and tasks, plus the daily morning brief, plus about one routine a day. That is **~230 runs a month**.

| Line | Light (80 runs) | Typical (230 runs) | Heavy (700 runs) |
|---|---|---|---|
| AI at $0.10 a run | $8.00 | $23.00 | $70.00 |
| Composio | $0.50 | $1.00 | $2.00 |
| Railway share (a $10 workspace over 5 seats) | $2.00 | $2.00 | $2.00 |
| OpenTag share | $0.30 | $0.30 | $0.30 |
| **COGS per seat** | **$10.80** | **$26.30** | **$74.30** |

AI is 85% of a typical seat's cost and is the only line that grows without bound. Hosting is small and flat. That decides the pricing shape: charge per seat, include a pool of runs, and sell more runs.

How much the run price moves a typical seat:

| Cost per run | Typical seat COGS |
|---|---|
| $0.05 | $14.80 |
| $0.10 | $26.30 |
| $0.20 | $49.30 |

## 3. What to charge

Targets: **about 70% gross margin at typical use**, and at least **45% on a seat that uses its whole allowance**. Margins below include Stripe's fee and the seat's share of hosting.

| Plan | Price | Seats | Runs included (pooled across the workspace) | Typical use | Typical margin | Margin at the cap |
|---|---|---|---|---|---|---|
| **Starter** | $49 a seat a month | 2 to 5 | 150 a seat | 100 runs | 69% | 58% |
| **Team** | $89 a seat a month | 3 to 25 | 350 a seat | 230 runs | 67% | 54% |
| **Business** | $149 a seat a month | 10 or more | 700 a seat | 350 runs | 71% | 48% |

- **More runs:** packs of 1,000 runs for $150 ($0.15 a run, a third above cost).
- **Annual:** two months free.
- **Trial:** 14 days, up to 3 seats, 100 runs in total. A trial costs about $13 (two weeks of hosting and its runs). Delete trial workspaces 7 days after they lapse.
- **Break-even:** at Team pricing each typical seat leaves ~$60 after COGS, so two paying seats cover the fixed costs.

For comparison, Attio Pro is $86 a seat monthly and HubSpot Sales Hub Professional about $100. Neither runs Bots on your mail, calendar and CRM.

If week-one metering shows runs nearer $0.05, Team can drop to $59 and still clear 70%. Don't lower it before you've measured.

## 4. Limits

None of these are enforced yet. Each exists because of a cost line above.

| Limit | Starter | Team | Business | Why |
|---|---|---|---|---|
| Assistant runs a month (pooled) | 150 a seat | 350 a seat | 700 a seat | AI is most of the cost |
| Steps in one run | 15 | 25 | 40 | Stops a looping Bot from burning a month's budget in one task |
| Routines per person | 3, at most daily | 10, at most hourly | 25, at most hourly | Each firing is a run, with nobody watching |
| Composio triggers a month | 500 | 5,000 | 25,000 | $0.003 each, and a busy inbox trigger fires constantly |
| Web research pages a month | 100 a seat | 500 a seat | 1,500 a seat | Paid per page by Firecrawl, Exa or Parallel |
| Bot computer | None | 1 browser, stops after 30 idle minutes | 3 browsers | 1 to 2 GB of memory each while running |
| Storage (records and files) | 5 GB | 25 GB | 100 GB | Disk and backups |
| Public API requests a day | 10,000 | 50,000 | 200,000 | CPU on a small instance |
| Single sign-on and SCIM | No | No | Yes | Support load, not cost |

**At the cap:**
- At 80%, tell the admin.
- At 100%, keep going and tell everyone.
- At 120%, pause the Bots' own work (routines and the brief) until a pack is bought or the month resets.

Chat stays on, so nobody is locked out mid-conversation.

## 5. Before you charge

1. **Get CopilotKit's price past 10,000 interactions. This is the biggest unknown.** If one interaction is one run, the allowance covers only ~40 typical seats in total. CopilotKit says to contact sales for SaaS use.
2. **Meter runs.** Count runs and tokens per workspace from the model calls, and show them in Admin. Run it for a week, then replace $0.10 with the measured number.
3. **Enforce limits**, in this order: runs per month, steps per run, how often routines can fire, then the rest.
4. **Billing:** Stripe subscriptions with a seat quantity and run packs. The sign-up service holds the subscription and pauses a workspace's Bots when payment fails.
5. **Verify** four inputs: `gpt-5.6-terra`'s price, the Railway plan fee, Composio's per-call rate on Pro, and your web research provider's per-page rate.
