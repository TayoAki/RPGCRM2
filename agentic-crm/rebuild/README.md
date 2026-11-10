# Magpie rebuild spec

This folder is everything an AI coding agent needs to rebuild Magpie as a multi-tenant SaaS from an empty repository. The new product is a CRM whose Bots find public bids, do the paperwork, chase subcontractor quotes, draft proposals and text the owner to approve.

## The documents

| File | What it answers | Read |
|---|---|---|
| [PRD.md](PRD.md) | What to build, for whom, and how to tell it works (requirements with ids and acceptance criteria, plans, metrics) | 1st |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, tenancy, module map, background work, LLM gateway, events, deployment | 2nd |
| [DATA_MODEL.md](DATA_MODEL.md) | Every table, column, key and isolation rule | 3rd |
| [BUILD_PLAN.md](BUILD_PLAN.md) | Milestones M0 to M10 with tasks, tests, done-when and demo scripts | 4th |
| [API.md](API.md) | Routes, errors, events, webhooks, public API and MCP | as needed |
| [AGENT_RUNTIME.md](AGENT_RUNTIME.md) | Bots, tools, runs, approvals, citations, memory, evals | as needed |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Kontract, SAM.gov, Postmark, Gmail, Outlook, Twilio, Telegram, Stripe, R2 and the rest | as needed |
| [SECURITY.md](SECURITY.md) | Threats, roles, secrets, environment variables, compliance | as needed |
| [BILLING.md](BILLING.md) | Plans, entitlements, Stripe, metering, limits | as needed |
| [UX.md](UX.md) | Screens, routes, components, message templates, design system | as needed |
| [AGENTS.md](AGENTS.md) | Rules and conventions for the coding agent; copy to the new repo root | always |
| [modules/TALENT.md](modules/TALENT.md) | Add-on module: find, hire and pay UGC creators and freelancers (milestone M11) | after MVP |

Background research behind the decisions: [`../reports/AI native CRM SaaS rebuild.md`](../reports/AI%20native%20CRM%20SaaS%20rebuild.md) and [`../reports/Ideal customer profile.md`](../reports/Ideal%20customer%20profile.md).

## How to hand this off

1. Create a new repository named `magpie`.
2. Copy this folder to `docs/spec/` and copy `AGENTS.md` to the repository root (and to `CLAUDE.md` if your agent reads that name).
3. Do the founder actions in [BUILD_PLAN.md §0.1](BUILD_PLAN.md#01-founder-actions-with-lead-time-start-in-week-1) in parallel; several take weeks.
4. Start the coding agent with this prompt:

```
Read AGENTS.md, then docs/spec/PRD.md, ARCHITECTURE.md, DATA_MODEL.md and BUILD_PLAN.md.
Build milestone M0 exactly as BUILD_PLAN.md describes. Verify each third-party API against its
current docs before using it, and record decisions in docs/decisions/. Open one pull request per
coherent piece of work, list the FR ids covered, and keep CI green including the isolation suites.
When M0's "done when" and demo pass on staging, stop and report, then continue with M1.
```

5. Review at each milestone's demo. Read every ADR. Answer the open questions in PRD §12 when they come up.

## What carries over from the current product

The current Magpie (in `../openduet/` and `../atomic-crm/`) is a reference, not a base. These parts are worth reading before rebuilding them:

| Area | Where | Why |
|---|---|---|
| Records layer with role and field permissions | `../openduet/openbot/server/src/crm/records.ts`, `access.ts` | Proven rules for one enforcement point |
| Approvals around tool calls | `../openduet/openbot/toolkit/src/native-approval.ts` | Edge cases with streamed runs |
| Telegram transport | `../openduet/openbot/server/src/delivery/telegram.ts` | Webhook secret, deep links, inline buttons |
| Kontract client and bid tools | `../openduet/openbot/server/src/crm/` (grep `kontract`) | Field mappings for the market API |
| Prospecting and outreach | `../openduet/openbot/server/src/crm/prospecting/` | Verification, tiers, CAN-SPAM footer |
| Cost model | `../COGS.md` | Starting numbers for metering and plans |

Do not copy code from the Twenty fork elsewhere in this repository. It is AGPL and partly Enterprise-licensed.
