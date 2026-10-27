# Twenty vs Atomic CRM: feature by feature

Both were checked in their source code on 2026-10-27:
- **Twenty:** upstream `f0ab542`
- **Atomic CRM:** `marmelab/atomic-crm` at `1d96561`, just after v1.6.0

"Enterprise" marks a Twenty feature locked behind its Commercial License; see [ENTERPRISE_FILES.md](ENTERPRISE_FILES.md).

## Is Atomic CRM open source?

**Yes, under the MIT license** (`LICENSE.md`, "Copyright (c) 2024-present, Francois Zaninotto, Marmelab"). CopilotKit's fork, which adds an AI assistant, is MIT too. There are no carve-outs. You can host it, sell it, rebrand it and keep your changes private.

Its backend is Supabase, which is also open source and can be self-hosted. Saving emails sent to the CRM uses Postmark, a paid email service, but that feature is optional.

## The basics

| | Twenty | Atomic CRM |
|---|---|---|
| License | AGPL-3.0, plus 576 Enterprise-licensed files | MIT, no carve-outs |
| Size (TypeScript, excluding tests) | about 1.28 million lines | about 43,000 lines |
| Maturity | Since 2022; 802 contributors; 17,485 commits | Since 2024; 29 contributors; 1,845 commits |
| Stack | NestJS, GraphQL, Postgres, Redis, React | React (shadcn, react-admin) on Supabase (Postgres, auth, REST, edge functions) |
| Built to be | A full product, customized through settings and apps | A toolkit you fork and change in code; ships AI coding-agent instructions (`AGENTS.md`) |

## Data model and customization

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Built-in records | Companies, people, opportunities, tasks, notes, attachments, workflows, dashboards and more | Companies, contacts, deals, notes, tasks, tags |
| Custom fields | Yes, from the settings screen. 25 field types including currency, address, phone, rating, multi-select, relations and files. | Yes, but only by a developer: add the database column, then edit the code |
| Custom objects | Yes, from the settings screen | No; you would add tables and screens in code |
| Relations between objects | Yes, including polymorphic ones | Fixed: contact to company, deal to company and contacts |
| Validation rules | Enterprise | No |

## Views and everyday use

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Table and list views | Yes, saved and shared views per object | Fixed list screens; the deals list can save filter combinations |
| Kanban | Any object, grouped by any select field | Deals pipeline only, with configurable stages |
| Calendar view | Yes | No |
| Filters, sorts, grouping | Yes, on any field | Filters and sorts on the built-in screens |
| Global search | Yes (command menu) | Yes |
| Merge duplicates | Yes, any object | Contacts only |
| Import and export | CSV import with column mapping; export | CSV import and export |
| Mobile | Responsive web app | Installable app (PWA) with mobile screens and pull-to-refresh |
| Languages | 33 | 2 (English, French) |

## Sales and activity

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Deals / opportunities pipeline | Yes | Yes |
| Notes | Rich text on any record | On contacts and deals |
| Tasks | On any record, with due dates and assignees | On contacts, with due dates |
| Attachments | Any record | Notes |
| Activity timeline | Per record | Activity log on the dashboard and per company |
| Tags | Through select and multi-select fields | Yes, including bulk tagging |

## Email and calendar

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Email sync | Gmail, Microsoft 365, and IMAP/SMTP, two-way per user | No mailbox sync. You forward or CC emails to the CRM (through Postmark), which saves them as notes and creates contacts. |
| Calendar sync | Google, Microsoft, CalDAV | No |
| Send email from the CRM | Yes, including from workflows | No |
| Email campaigns | Yes; some sending options are Enterprise | No |
| Call recordings | Desktop companion app records calls, with transcripts and summaries | No |

## Automation and AI

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Workflows | Yes. 4 triggers (record events, schedule, manual, webhook) and 22 actions, including create/update/find records, send or draft email, HTTP request, AI agent, if/else, loops, delay and forms. | No |
| Custom code | Serverless logic functions | Supabase edge functions, written by a developer |
| AI assistant in the app | Yes: chat, agents, and an AI step in workflows | Not in Marmelab's version; CopilotKit's fork adds one |
| MCP server (for Claude, ChatGPT and others) | Yes, built in | Yes, through a Supabase edge function with OAuth |
| Apps and marketplace | Yes, with an SDK and an app platform | No; you extend it by editing code |

## Reporting

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Dashboards | Build your own: bar, line, pie and aggregate charts, tables, iframes | One fixed dashboard: deals chart, pipeline, hot contacts, latest notes, tasks |

## Integration

| Feature | Twenty | Atomic CRM |
|---|---|---|
| API | REST and GraphQL for every object, including custom ones, with API keys and a playground | Supabase's auto-generated REST API over the tables |
| Webhooks | Yes, per event | No built-in outgoing webhooks |
| OAuth for third-party apps | Yes | Supabase's OAuth server (used by the MCP server) |

## Security and admin

| Feature | Twenty | Atomic CRM |
|---|---|---|
| Sign-in | Email/password, Google, Microsoft | Email/password, Google, Azure, Keycloak, Auth0 |
| SSO (SAML / OIDC) | Enterprise | SAML through Supabase's SSO |
| Two-factor authentication | Yes | No (it appears only in the demo data generator) |
| Roles | Custom roles with object- and field-level permissions | Two fixed roles, admin and user |
| Who sees what | Per role and object; row-level rules are Enterprise | Every signed-in user can read everything |
| Private and inherited records | Yes; private AI chats, inherited note visibility | No |
| Audit logs | Enterprise | No |
| Multiple workspaces per install | Yes | No; one company per install |

## What this means for an agentic CRM you resell

**Twenty**
- **Strengths:** it's the more complete product by a wide margin: custom objects from the settings screen, workflows, two-way email and calendar sync, real roles, dashboards, 33 languages and a mature API.
- **Weaknesses:** licensing. The Enterprise files must be settled with Twenty or removed, and the AGPL requires offering your source code. It's also far too large to rebuild.

**Atomic CRM**
- **Strengths:** a clean MIT license and a small codebase you can fully own. It's designed to be changed in code, including by AI coding agents, and CopilotKit has already paired it with its assistant.
- **Weaknesses:** it's a starter CRM.
  - No workflows, two-way email/calendar sync, custom objects, permissions beyond admin and user, or 2FA.
  - Every user sees all data. That's fine for one small team, but not for customers with separate departments or confidential deals.

**How the agent changes the picture.** In an agentic CRM, the agent can cover some of Atomic's gaps:
- reading mail through OpenDuet's Gmail connection instead of the CRM syncing it
- drafting follow-ups
- running scheduled routines instead of workflows

The gaps it can't cover are security and data features: permissions, 2FA, audit logs and custom objects. Those must be built into the CRM. Budget for them before selling to customers larger than a single small team.
