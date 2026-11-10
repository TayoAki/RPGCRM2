# Magpie: UX and screens

**Status:** ready to build. **Owner:** founder. **Last updated:** 2026-11-10.

This file says what every screen, text message and email in Magpie looks like and says. Read [PRD.md](PRD.md) for what the product does, [ARCHITECTURE.md](ARCHITECTURE.md) for the stack and [DATA_MODEL.md](DATA_MODEL.md) for every table first. Table, column and enum names, requirement ids (`FR-BID-3`) and Bot names come from those files and are used here unchanged. Where a screen needs something those files don't define, it is marked **(requested)** and listed precisely in [§27](#27-schema-additions-requested).

Contents:
1. Principles
2. Voice and words
3. Information architecture and navigation
4. How to read a screen spec
5. Getting in
6. Onboarding
7. Today
8. Matches
9. Bids and the bid workspace
10. Pipeline and deals
11. Contacts and companies
12. Tasks
13. Bots, memory and runs
14. Approvals
15. Chat
16. Notifications
17. Settings
18. Reports and automations (v1)
19. Ops console and reviewer queue (v1)
20. Text messages: SMS and Telegram
21. Email templates
22. Design system
23. Data access
24. Accessibility
25. Responsive layout, PWA and web push
26. Internationalization
27. Schema additions requested

## 1. Principles

These settle UI disagreements during the build. PRD §4 settles product ones.

| # | Principle | What it means on screen |
|---|---|---|
| 1 | **Text first** | The owner's main surface is SMS or Telegram. Every digest item, approval and alert has a short text form ([§20](#20-text-messages-sms-and-telegram)). Anything the owner must decide can be decided from the phone. The web app is needed only to read documents and to edit drafts, price sheets and settings. |
| 2 | **The web app is the back office** | Built for a person at a laptop working through a bid. Dense tables, keyboard paths, split views, filters and exports. Pages show the work, not a dashboard about the work. |
| 3 | **Citations are clickable everywhere** | Every fact a Bot extracted shows a citation chip ([§22.11](#2211-citation-chip)). One click opens the document at the page with the sentence highlighted. A fact without a source shows "Not found in the documents." and nothing else. |
| 4 | **Nothing external without approval** | An action that reaches someone outside the business always appears as an approval card with the full preview: the email as it will be sent, the text as it will read. No button anywhere sends directly. External approvals can't be bulk approved, can't be approved from a push notification button, and are blocked during support sessions. |
| 5 | **Calm and plain** | One primary button per region. No celebrations, illustrations, streaks or confetti. Red only for problems. The only counter badge in navigation is Approvals. Motion only shows where something went (150 to 250 ms). Words follow [§2](#2-voice-and-words). |
| 6 | **Show the Bot's work** | Everything a Bot made names the Bot and links to its run. AI-written text is labeled. Learning mode says what would have happened. A Bot that couldn't do something says so. |
| 7 | **One payload, every surface** | An approval, match, deadline or alert renders from the same server payload on web, SMS, Telegram, email and push (FR-APR-1). This file gives the copy for each surface. |

## 2. Voice and words

### 2.1 Glossary

PRD §9 is the base and wins on conflict. These rows add the UI's other nouns and verbs.

| Say | Means | Not |
|---|---|---|
| **Bot**, **Bots** (capitalized) | A member of the Bot team (`bots`). Refer to one Bot as "it". | agent, AI, assistant (generic), coworker |
| **the Assistant** | The Bot with `key='assistant'`, by its default name. A person can rename it; the UI then uses `bots.name`. | the AI, chatbot |
| **bid** | A deal with `kind='bid'` | opportunity, deal (on bid pages) |
| **deal** | A deal with `kind='sale'`, and Pipeline pages that mix both kinds | opportunity |
| **notice** | A public posting (`market_opportunities`) | opportunity, listing, RFP (as a noun for all notices) |
| **match** | A notice that fits a saved search (`opportunity_matches`) | lead, hit, alert |
| **saved search** | `opportunity_searches` | alert, feed |
| **pursue**, **save for later**, **dismiss** | Match actions (FR-DIS-5) | accept, reject, ignore |
| **approve**, **skip**, **edit** | Approval decisions. Status `rejected` shows as "Skipped". Field suggestions also use approve and skip. | accept, reject, deny, decline, allow |
| **brief** | The bid brief (FR-BID-2) | summary, report |
| **requirement** | A `bid_requirements` row. "Compliance matrix" appears only as an export name. | item, criterion, rule |
| **price sheet** | `price_sheets` | estimate, quote |
| **quote request**, **quote** | `quote_requests`, `quotes`. A quote is a sub's price. | RFQ (allowed only inside exported documents) |
| **draft** | `drafts` | doc, document (for drafts) |
| **document** | A `bid_documents` row or a notice's attachment | file (except for uploads in progress) |
| **run** | One Bot turn (`agent_runs`) | execution, task, job |
| **job** | A scheduled or event-driven Bot job (`bot_jobs`) | routine, cron, automation |
| **task** | A to-do (`tasks`). Never used for Bot work. | to-do, action item |
| **workspace** | A tenant | tenant, organization, account, company (for the workspace) |
| **owner**, **admin**, **member**, **viewer** | Roles | administrator, user (as a role) |
| **connect**, **disconnect**, **reconnect** | Channels and connections | link, integrate, pair |
| **outside your business** | `effect='external'` | external, third party |
| **inside Magpie** | `effect='internal'` | internal |
| **ask first**, **do without asking**, **off** | Tool policies `needs_approval`, `always_allow`, `off` | requires approval, auto, autonomous |
| **learning mode** | `is_learning_mode` runs | dry run, shadow mode |
| **support session** | Staff impersonation, as customers see it | impersonation |
| **Magpie reviewer** | Staff reviewer on the Managed plan | operator, moderator, human in the loop |
| **text**, **texts** | SMS messages, in UI copy | SMS (except in Settings headings: "Text messages (SMS)") |

### 2.2 Style rules

1. Say what happened, then what to do.
2. One idea per sentence. Sentences under 20 words. Descriptions are one or two sentences.
3. Second person: "your bids". A Bot is "it".
4. Sentence case for headings, buttons, tabs, menu items and table headers.
5. Buttons are verbs that name the result: Pursue, Approve, Send code, Mark submitted. Never "OK", "Submit" or "Click here".
6. No em dashes or en dashes anywhere, including UI copy and templates. Ranges use "to": "$100K to $250K", "9 PM to 7 AM".
7. No emojis, no exclamation marks, no marketing words (powerful, seamless, effortless, magic, supercharge, unlock, AI-powered).
8. No "please", "rather than", "which is why", "simply", "just".
9. No internals outside admin screens (Settings pages that only owners and admins open, and Ops): never token, OAuth, webhook, RLS, workflow, tenant, LLM, model, prompt. "API key" is allowed on Connections and API keys. Ops may use any term.
10. Errors: what failed in the person's terms, then one next step. No status codes, no stack traces, no blame.
11. Empty states: what will show here and how it gets here. At most one button.
12. Numbers are digits ("3 bids"). Money: "$18,400", "$1.2M" in summaries, cents only on price lines. Dates: "Nov 12" in the current year, "Nov 12, 2027" otherwise. Times: "2:00 PM ET". Relative time only within 7 days: "in 3 days", "2 hours ago".
13. Web copy may use typographic quotes and "…" for in-progress labels ("Saving…"). SMS and Telegram use straight quotes and "..." ([§20.1](#201-rules-for-every-text)).

### 2.3 Shared copy

**Generic states.** Screen specs name `{thing}`; the rest is fixed.

| State | Copy | Control |
|---|---|---|
| Loading (screen reader only) | "Loading {thing}" | none |
| Region failed to load | "Couldn't load {thing}. Check your connection and try again." | Try again |
| Save failed (toast) | "Couldn't save {thing}. Try again." | Try again |
| Offline (header) | "You're offline. Magpie will catch up when you're back." | none |
| 403 page | "You don't have access to this. Ask an owner or admin of {workspace}." | Go to Today |
| 404 page | "This page doesn't exist or was removed." | Go to Today |
| Unexpected error page | "Something went wrong on our side. Try again in a minute. If it keeps happening, contact support." | Try again, Contact support |
| Session expired (sign-in notice) | "You were signed out. Sign in to continue." | none |
| Workspace switched in another tab | "You switched to {workspace} in another tab." | Reload |
| Read-only role (tooltip on disabled controls) | "You have view access. Ask an owner or admin to make changes." | none |
| Owner or admin only (tooltip) | "Only owners and admins can do this." | none |
| Owner only (tooltip) | "Only the workspace owner can do this." | none |

**Problem codes.** The API returns RFC 9457 problem+json with a `code` (ARCHITECTURE §5.4). The web app shows this copy for each code, from its own catalog, and uses the server's `detail` only for codes it doesn't know. The list is **(requested)** for API.md.

| `code` | Copy |
|---|---|
| `unauthenticated` | Redirect to sign-in with "You were signed out. Sign in to continue." |
| `forbidden` | "You don't have access to this. Ask an owner or admin." |
| `not_found` | "This {thing} doesn't exist or was removed." |
| `validation_failed` | Field errors inline. Form summary: "Check the highlighted fields." |
| `conflict` | "Someone changed this while you were editing. Reload to see the latest." |
| `rate_limited` | "Too many requests. Wait a minute and try again." |
| `limit_reached` | Owner or admin: "Your workspace used this month's {limit name}. Add a run pack or change plan." Others: "Your workspace used this month's {limit name}. Ask an owner to add a run pack." |
| `ai_drafting_not_allowed` | "This solicitation doesn't allow AI drafting. Write this section yourself." |
| `model_unavailable` | "Bots can't do this because the AI providers it needs are turned off for this workspace. An admin can change this in Settings." |
| `workspace_read_only` | "Your workspace is read-only because a payment failed." Owner or admin adds: "Update your card in Billing." |
| `workspace_suspended` | "This workspace is suspended. Contact support." |
| `support_session_blocked` | "Outside actions are blocked during a support session." |
| `suppressed_recipient` | "{address} unsubscribed or bounced. Magpie won't email it." |
| `postal_address_missing` | "Add your postal address in Settings before sending outreach." |
| `quote_not_confirmed` | "Check this quote's numbers before using it in a price sheet." |
| `submission_required` | "Add how and when you submitted before marking this bid submitted." |
| `approval_already_decided` | "{name} already {approved or skipped} this {via channel} at {time}." |
| `approval_expired` | "This expired on {date}. The Bot went on without it." |
| `invalid_code` | "That code didn't match. You have {n} tries left." |
| `code_expired` | "That code expired. Send a new one." |
| `too_many_attempts` | "Too many tries. Send a new code." |
| `file_infected` | "{filename} failed the security scan and was removed." |
| `file_too_large` | "{filename} is over 100 MB. Split it or compress it, then upload again." |
| `unsupported_file` | "Magpie reads PDF, Word, Excel and image files." |
| `seat_limit` | "Your plan includes {n} people. Change plan to invite more." |
| `saved_search_limit` | "Your plan includes {n} saved searches. Turn one off or change plan." |
| `invite_expired` | "This invite expired on {date}. Ask {inviter} to send a new one." |

## 3. Information architecture and navigation

### 3.1 Desktop frame (64rem / 1024 px and wider)

```
+-------------+-------------------------------------------------+--------------+
| Rail 15rem  | Header 3.5rem: title, Search (Ctrl K), New,     | Assistant    |
|             | bell, Assistant toggle                          | panel 25rem  |
| [Workspace] +-------------------------------------------------+ (toggle,     |
|             | Banners (max 2)                                 |  resizable   |
| Today       +-------------------------------------------------+  20 to 35rem)|
| Matches     |                                                 |              |
| Bids        |  Page                                           |              |
| Pipeline    |                                                 |              |
| Contacts    |                                                 |              |
| Companies   |                                                 |              |
| Tasks       |                                                 |              |
| Bots        |                                                 |              |
| Approvals 3 |                                                 |              |
| Reports     |  (v1)                                           |              |
| ----------- |                                                 |              |
| Settings    |                                                 |              |
| [You]       |                                                 |              |
+-------------+-------------------------------------------------+--------------+
```

**Rail.** `<nav aria-label="Main">`, 15rem wide, collapsible to 4rem icons (button "Collapse sidebar" at the bottom; state in `localStorage` key `magpie.rail`).

| Item | Icon (lucide) | Route | Notes |
|---|---|---|---|
| Workspace switcher | workspace logo or initials | menu | Lists memberships from `my_memberships`: logo, `tenants.name`, role. Check mark on the active one. Then "Create a workspace" and, for owners and admins, "Workspace settings". |
| Today | `Sunrise` | `/today` | |
| Matches | `Radar` | `/matches` | |
| Bids | `FileStack` | `/bids` | |
| Pipeline | `Columns3` | `/pipeline` | |
| Contacts | `Users` | `/contacts` | |
| Companies | `Building2` | `/companies` | |
| Tasks | `SquareCheck` | `/tasks` | |
| Bots | `Bot` | `/bots` | |
| Approvals | `Stamp` | `/approvals` | Count badge: pending approvals with `requested_for_user_id` = me and `review_stage='owner'`. Hidden at 0. Shows "99+" above 99. |
| Reports | `ChartColumn` | `/reports` | v1. Hidden in MVP builds by feature flag `reports`. |
| Settings | `Settings` | `/settings` | Below a divider. |
| You | avatar | menu | Your account, Channels and alerts, Theme (System, Light, Dark), Keyboard shortcuts, Help, Sign out. |

Lucide icon names change between versions; check the pinned version and keep this mapping in `apps/web/src/lib/nav.ts`.

**Header.** Page title (`h1`), or breadcrumbs above the title on record pages. Right side: Search field "Search" with "Ctrl K" hint (Cmd K on Mac), opening the command palette; New menu (Bid, Deal, Company, Contact, Task); notifications bell with an unread dot (no number); Assistant toggle button "Assistant" (Ctrl J).

**Assistant panel.** `<aside aria-label="Assistant">`, docked right, resizable 20 to 35rem. Opens with the header button or Ctrl J. Open state in `localStorage` key `magpie.assistant`. Default open at 96rem (1536 px) and wider on first visit, closed below. Content in [§15.1](#151-assistant-panel). On a record page, opening it attaches that record as context.

**Banners.** Below the header, above the page. At most two visible, highest priority first ([§3.5](#35-banners)).

### 3.2 Tablet (48rem to 63.99rem, 768 to 1023 px)

- Rail collapsed to 4rem icons with tooltips. Expanding it overlays the page.
- The Assistant panel opens as a right sheet over the page and is never docked.
- Tables hide P3 columns ([§22.9](#229-tables)).
- Bid workspace right rail moves into the Brief tab.

### 3.3 Phone (under 48rem, 768 px)

- **Top bar** 3.5rem: page title, Search icon, bell icon. Detail pages show a back chevron and the parent name. Lists show their own New button at the right ("New task").
- **Bottom tabs** 4rem plus the safe-area inset, `<nav aria-label="Main">`:

| Tab | Icon | Route |
|---|---|---|
| Today | `Sunrise` | `/today` |
| Bids | `FileStack` | `/bids` |
| Approvals | `Stamp` | `/approvals` (count badge as on desktop) |
| Chat | `MessageSquare` | `/chat` |
| More | `Menu` | opens the More sheet |

- **More sheet** (full height): Matches, Pipeline, Contacts, Companies, Tasks, Bots, Reports (v1), Notifications, Settings, then the workspace switcher row, Help and Sign out.
- Tables become card lists. Side sheets become bottom sheets (vaul `Drawer`). Dialogs with more than 4 fields become full-screen pages.
- No floating action button.

### 3.4 Global elements

| Element | Behavior |
|---|---|
| Command palette (Ctrl K) | FR-CRM-6. One input. Groups: Bids and deals, Companies, Contacts, Matches (5 results each, fuzzy), then Go to (pages) and Actions ("New task", "Ask the Assistant", "Switch workspace"). Debounce 150 ms. Empty input shows the last 10 opened records (`localStorage` key `magpie.recent.{tenantId}`). No results: "Nothing matches "{q}". Try fewer words." Results under 300 ms p95. |
| Notifications popover | [§16](#16-notifications) |
| Toasts | [§22.15](#2215-toasts) |
| Banners | [§3.5](#35-banners) |
| Support session banner | [§19.3](#193-support-session-banner), above everything, on every page |
| Realtime status | When the event stream is down for more than 10 seconds, the header shows "Reconnecting…" (`role="status"`). Nothing when connected. |
| Skip link | "Skip to content", first focusable element, visible on focus |

### 3.5 Banners

Workspace-wide states. Rows 1 to 6 can't be dismissed. Rows 7 to 10 can be dismissed for 24 hours (`localStorage`). Buttons in brackets show only to people whose permission flag allows them; others see the alternate copy.

| Priority | Condition | Copy | Button |
|---|---|---|---|
| 1 | Workspace suspended (`tenants.status='suspended'`) | "This workspace is suspended. Contact support to turn it back on." | Contact support |
| 2 | Read-only after failed payment (BILLING.md state, day 14 and later) | "Your workspace is read-only because a payment failed. Your data is kept until {date}." Owner or admin adds "Update your card to turn everything back on." Others add "Ask an owner to update the card." | [Update card] |
| 3 | Past due, Bot jobs paused (day 7 to 14) | "Bot jobs are paused because a payment failed. Update your card by {date} to keep editing." | [Update card] |
| 4 | Past due (day 0 to 7) | "Your last payment didn't go through. Update your card by {date} to keep your Bots working." | [Update card] |
| 5 | Deletion scheduled (`tenant_deletions.scheduled_for` set, not completed) | "This workspace will be deleted on {date}." | [Cancel deletion] (owner) |
| 6 | Usage at 120% of `ai_runs` | "Scheduled Bot jobs are paused. Your workspace used {used} of {limit} Bot runs this month. Chat and approvals still work." | [Add a run pack] |
| 7 | Usage at 100% of any metered entitlement | "Your workspace used all {limit} {unit} this month. Bots keep working. Jobs pause at {pauseAt}." | [Add a run pack] |
| 8 | Trial ends within 3 days | "Your trial ends {in 3 days, tomorrow, today}. Choose a plan to keep your Bots working." | [Choose a plan] |
| 9 | Trial ended without a plan | "Your trial ended. Choose a plan to turn your Bots back on." | [Choose a plan] |
| 10 | Email not verified | "Confirm your email address. We sent a link to {email}." | Send again |

The 80% alert is a notification, not a banner (FR-BIL-4). The SAM warning (FR-PRO-6) shows on Today, not as a banner.

### 3.6 Routes

TanStack Router, file-based, in `apps/web/src/routes/`. Search params are validated with zod in `validateSearch`. Layout routes:

| Layout route | Guard (`beforeLoad`) |
|---|---|
| `__root.tsx` | Providers, event stream, toaster, theme |
| `_public.tsx` | Centered auth card layout. Redirects signed-in people to `/today`, except `/invite/*` and `/u/*`. |
| `_authed.tsx` | `ensureQueryData(meQueryOptions())`. No session: redirect to `/sign-in?redirect={href}`. |
| `_authed/_workspace.tsx` | Active workspace required, else `/workspaces`. Owner with unfinished onboarding (`tenant_settings.settings.onboarding.finishedAt` null and not skipped): redirect to `/onboarding`. Invited person with `memberships.onboarded_at` null **(requested)**: redirect to `/onboarding/phone?member=1`. |
| `_authed/_workspace/_shell.tsx` | App frame: rail, header, banners, Assistant panel, bottom tabs |
| `_authed/_workspace/onboarding.tsx` | Onboarding frame without the rail |
| `_authed/ops.tsx` | `me.user.isStaff` required, else 404 |

Every screen:

| Path | Route file | Screen | Release | Spec |
|---|---|---|---|---|
| `/sign-up` | `_public/sign-up.tsx` | Sign up | MVP | §5.1 |
| `/sign-up/business` | `_authed/sign-up.business.tsx` | Business name after Google or Microsoft sign-up | MVP | §5.1 |
| `/sign-in` | `_public/sign-in.tsx` | Sign in | MVP | §5.2 |
| `/sign-in/link-sent` | `_public/sign-in.link-sent.tsx` | Check your email | MVP | §5.3 |
| `/forgot-password` | `_public/forgot-password.tsx` | Forgot password | MVP | §5.4 |
| `/reset-password` | `_public/reset-password.tsx` | Set or reset password (`?token=&mode=set\|reset`) | MVP | §5.5 |
| `/verify-email` | `_public/verify-email.tsx` | Confirm email (`?token=`) | MVP | §5.6 |
| `/invite/$invitationId` | `_public/invite.$invitationId.tsx` | Accept invite | MVP | §5.7 |
| `/u/$token` | `_public/u.$token.tsx` | Unsubscribe page for outreach recipients | MVP | §5.10 |
| `/s/$code` | `s.$code.tsx` | Short link resolver (texts and Telegram) | MVP | §20.1 |
| `/offline` | `offline.tsx` | Offline fallback | MVP | §25.2 |
| `/workspaces` | `_authed/workspaces.index.tsx` | Choose a workspace | MVP | §5.8 |
| `/workspaces/new` | `_authed/workspaces.new.tsx` | Create a workspace | MVP | §5.9 |
| `/onboarding` | `_authed/_workspace/onboarding.index.tsx` | Redirects to the current step | MVP | §6 |
| `/onboarding/business` | `.../onboarding.business.tsx` | Step 1: Find your business | MVP | §6.2 |
| `/onboarding/work` | `.../onboarding.work.tsx` | Step 2: What you do | MVP | §6.3 |
| `/onboarding/area` | `.../onboarding.area.tsx` | Step 3: Where you work | MVP | §6.4 |
| `/onboarding/limits` | `.../onboarding.limits.tsx` | Step 4: Certifications and limits | MVP | §6.5 |
| `/onboarding/phone` | `.../onboarding.phone.tsx` | Step 5: Phone (`?member=1` for invited people) | MVP | §6.6 |
| `/onboarding/done` | `.../onboarding.done.tsx` | Your first searches | MVP | §6.7 |
| `/` | `_authed/_workspace/_shell/index.tsx` | Redirects to `/today` | MVP | |
| `/today` | `.../_shell/today.tsx` | Today | MVP | §7 |
| `/matches` | `.../_shell/matches.index.tsx` | Matches list | MVP | §8.1 |
| `/matches/search` | `.../_shell/matches.search.tsx` | Search all bids | MVP | §8.5 |
| `/matches/searches` | `.../_shell/matches.searches.tsx` | Saved searches | MVP | §8.7 |
| `/matches/$matchId` | `.../_shell/matches.$matchId.index.tsx` | Match detail | MVP | §8.2 |
| `/matches/$matchId/documents/$documentRef` | `.../_shell/matches.$matchId.documents.$documentRef.tsx` | Notice document reader (`?page=`) | MVP | §8.4 |
| `/notices/$opportunityId` | `.../_shell/notices.$opportunityId.index.tsx` | Notice detail (not matched) | MVP | §8.3 |
| `/notices/$opportunityId/documents/$documentRef` | `.../_shell/notices.$opportunityId.documents.$documentRef.tsx` | Notice document reader | MVP | §8.4 |
| `/bids` | `.../_shell/bids.index.tsx` | Bids list | MVP | §9.1 |
| `/bids/$dealId` | `.../_shell/bids.$dealId.tsx` | Bid workspace frame; index redirects to `brief` | MVP | §9.2 |
| `/bids/$dealId/brief` | `.../bids.$dealId.brief.tsx` | Brief tab | MVP | §9.3 |
| `/bids/$dealId/requirements` | `.../bids.$dealId.requirements.tsx` | Requirements tab (`?category=&status=&gaps=1&req=`) | MVP | §9.4 |
| `/bids/$dealId/documents` | `.../bids.$dealId.documents.index.tsx` | Documents tab | MVP | §9.5 |
| `/bids/$dealId/documents/$documentId` | `.../bids.$dealId.documents.$documentId.tsx` | Document viewer (`?page=&hl=`) | MVP | §9.5 |
| `/bids/$dealId/pricing` | `.../bids.$dealId.pricing.tsx` | Pricing tab (`?version=`) | MVP | §9.6 |
| `/bids/$dealId/quotes` | `.../bids.$dealId.quotes.tsx` | Subs and quotes tab (`?request=`) | MVP | §9.7 |
| `/bids/$dealId/drafts` | `.../bids.$dealId.drafts.index.tsx` | Drafts tab | MVP | §9.8 |
| `/bids/$dealId/drafts/$draftId` | `.../bids.$dealId.drafts.$draftId.tsx` | Draft editor (`?compare=&approval=`) | MVP | §9.9 |
| `/bids/$dealId/timeline` | `.../bids.$dealId.timeline.tsx` | Timeline tab (`?type=`) | MVP | §9.10 |
| `/pipeline` | `.../_shell/pipeline.tsx` | Pipeline (`?pipeline=&view=&layout=board\|table\|calendar`) | MVP | §10.1 |
| `/deals/$dealId` | `.../_shell/deals.$dealId.tsx` | Deal record (sale). Bids redirect to `/bids/$dealId/brief`. | MVP | §10.2 |
| `/contacts` | `.../_shell/contacts.index.tsx` | Contacts list (`?view=`) | MVP | §11.1 |
| `/contacts/import` | `.../_shell/contacts.import.tsx` | Import contacts | MVP | §11.2 |
| `/contacts/$contactId` | `.../_shell/contacts.$contactId.tsx` | Contact record (`?tab=`) | MVP | §11.3 |
| `/companies` | `.../_shell/companies.index.tsx` | Companies list (`?view=&kind=`) | MVP | §11.1 |
| `/companies/import` | `.../_shell/companies.import.tsx` | Import companies | MVP | §11.2 |
| `/companies/$companyId` | `.../_shell/companies.$companyId.tsx` | Company record (`?tab=`) | MVP | §11.3 |
| `/tasks` | `.../_shell/tasks.tsx` | Tasks (`?view=&assignee=&status=&task=`) | MVP | §12 |
| `/bots` | `.../_shell/bots.index.tsx` | Bots: Team tab | MVP | §13.1 |
| `/bots/runs` | `.../_shell/bots.runs.tsx` | Bots: Runs tab | MVP | §13.1 |
| `/bots/memory` | `.../_shell/bots.memory.tsx` | Bots: Memory tab | MVP | §13.2 |
| `/bots/$botId` | `.../_shell/bots.$botId.tsx` | Bot page frame; index redirects to `jobs` | MVP | §13.3 |
| `/bots/$botId/jobs` | `.../bots.$botId.jobs.tsx` | Bot jobs | MVP | §13.3 |
| `/bots/$botId/tools` | `.../bots.$botId.tools.tsx` | Bot tools | MVP | §13.3 |
| `/bots/$botId/runs` | `.../bots.$botId.runs.tsx` | Bot runs | MVP | §13.3 |
| `/bots/$botId/settings` | `.../bots.$botId.settings.tsx` | Bot settings | MVP | §13.3 |
| `/runs/$runId` | `.../_shell/runs.$runId.tsx` | Run detail | MVP | §13.4 |
| `/approvals` | `.../_shell/approvals.tsx` | Approvals inbox (`?tab=waiting\|decided&effect=&bot=&for=me\|everyone`) | MVP | §14.1 |
| `/approvals/$approvalId` | `.../_shell/approvals.$approvalId.tsx` | Approval detail (split view on desktop) | MVP | §14.2 |
| `/chat` | `.../_shell/chat.index.tsx` | Full-page chat, thread list | MVP | §15.2 |
| `/chat/$threadId` | `.../_shell/chat.$threadId.tsx` | Full-page chat thread | MVP | §15.2 |
| `/notifications` | `.../_shell/notifications.tsx` | Notifications (`?filter=unread`) | MVP | §16 |
| `/reports` | `.../_shell/reports.index.tsx` | Reports list | v1 | §18.1 |
| `/reports/bids` | `.../_shell/reports.bids.tsx` | Bid results (fixed) | v1 | §18.2 |
| `/reports/$reportId` | `.../_shell/reports.$reportId.tsx` | Custom report | v1 | §18.3 |
| `/settings` | `.../_shell/settings.tsx` | Settings frame; index redirects to `account` (phone: list page) | MVP | §17 |
| `/settings/account` | `.../settings.account.tsx` | Your account | MVP | §17.1 |
| `/settings/channels` | `.../settings.channels.tsx` | Channels and alerts | MVP | §17.2 |
| `/settings/company` | `.../settings.company.tsx` | Company profile | MVP | §17.3 |
| `/settings/past-performance` | `.../settings.past-performance.tsx` | Past performance | MVP | §17.4 |
| `/settings/library` | `.../settings.library.tsx` | Library (`?kind=`) | MVP | §17.5 |
| `/settings/workspace` | `.../settings.workspace.tsx` | Workspace general | MVP | §17.6 |
| `/settings/people` | `.../settings.people.tsx` | People and roles | MVP | §17.7 |
| `/settings/pipelines` | `.../settings.pipelines.tsx` | Pipelines and stages | MVP | §17.8 |
| `/settings/fields` | `.../settings.fields.tsx` | Fields and tags (`?object=company\|contact\|deal\|tags`) | MVP | §17.9 |
| `/settings/connections` | `.../settings.connections.tsx` | Connections | MVP | §17.10 |
| `/settings/billing` | `.../settings.billing.index.tsx` | Billing | MVP | §17.11 |
| `/settings/billing/cancel` | `.../settings.billing.cancel.tsx` | Cancel plan | MVP | §17.11 |
| `/settings/usage` | `.../settings.usage.tsx` | Usage (`?period=`) | MVP | §17.12 |
| `/settings/api-keys` | `.../settings.api-keys.tsx` | API keys and MCP | v1 | §17.13 |
| `/settings/webhooks` | `.../settings.webhooks.tsx` | Webhooks | v1 | §17.14 |
| `/settings/automations` | `.../settings.automations.index.tsx` | Automations list | v1 | §18.4 |
| `/settings/automations/$automationId` | `.../settings.automations.$automationId.tsx` | Automation editor (`new` for a new one) | v1 | §18.4 |
| `/settings/audit` | `.../settings.audit.tsx` | Audit log | MVP | §17.15 |
| `/settings/data` | `.../settings.data.tsx` | Data export, ownership and deletion | MVP | §17.16 |
| `/ops` | `_authed/ops.index.tsx` | Redirects by staff role: reviewers to `/ops/review`, others to `/ops/tenants` | v1 | §19 |
| `/ops/tenants` | `_authed/ops.tenants.index.tsx` | Tenants | v1 | §19.1 |
| `/ops/tenants/$tenantId` | `_authed/ops.tenants.$tenantId.tsx` | Tenant detail (`?tab=`) | v1 | §19.2 |
| `/ops/costs` | `_authed/ops.costs.tsx` | Costs | v1 | §19.4 |
| `/ops/flags` | `_authed/ops.flags.tsx` | Feature flags | v1 | §19.5 |
| `/ops/review` | `_authed/ops.review.index.tsx` | Reviewer queue | v1 | §19.6 |
| `/ops/review/$approvalId` | `_authed/ops.review.$approvalId.tsx` | Review an approval | v1 | §19.6 |

Path segments use the table's id names (`$dealId`, `$matchId`) so links are unambiguous. A bid uses `/bids/$dealId` and a sale deal uses `/deals/$dealId`; each redirects to the other when `deals.kind` doesn't match.

### 3.7 Permissions in the UI

`GET /api/app/me` returns the person, their memberships, the active workspace, their role and a `permissions` object of booleans **(requested shape)**. The UI renders from these flags only and never compares role names. SECURITY.md owns the matrix; this table must match it.

| Flag | Owner | Admin | Member | Viewer | Gates |
|---|---|---|---|---|---|
| `recordsWrite` | yes | yes | yes | no | Create, edit, archive records, notes, tasks, requirements, drafts, price sheets, quotes, files; match actions; stage changes |
| `approvalsDecideOwn` | yes | yes | yes | no | Approve, edit, skip approvals requested for me |
| `approvalsDecideAny` | yes | yes | no | no | "Everyone" filter and deciding others' approvals |
| `botsManage` | yes | yes | no | no | Rename Bots, instructions, on and off, jobs, tool policies, learning mode, model tier (FR-ACC-4, FR-BOT-3) |
| `memoriesManage` | yes | yes | own only | no | Edit and delete memories (members: rows with `user_id` = me) |
| `profileManage` | yes | yes | no | no | Company profile |
| `settingsManage` | yes | yes | no | no | Workspace settings, pipelines, fields, tags, workspace connections |
| `membersManage` | yes | yes | no | no | Invites and roles. Admins can't change the owner's role or other admins' roles. |
| `billingManage` | yes | yes | no | no | Plan, card, run packs, usage page (FR-BIL-3) |
| `billingCancel` | yes | no | no | no | Cancel plan |
| `costsView` | yes | yes | no | no | Cost columns and cost per Bot (FR-BOT-7, FR-BIL-3) |
| `auditView` | yes | no | no | no | Audit log (FR-SET-4) |
| `dataExport` | yes | no | no | no | Export all data (FR-ACC-5) |
| `workspaceTransfer` | yes | no | no | no | Transfer ownership |
| `workspaceDelete` | yes | no | no | no | Schedule and cancel deletion |
| `apiKeysCreate` | yes | yes | yes | read scope only | Own API keys (v1) |
| `apiKeysManageAll` | yes | yes | no | no | See and revoke everyone's keys (v1) |
| `automationsManage` | yes | yes | no | no | Automations and webhooks (v1) |
| `reportsCreate` | yes | yes | yes | no | Create reports (v1). Viewers see shared reports. |
| `viewsShare` | yes | yes | yes | no | Save shared views |

Rules:
- A page someone can never use is hidden from navigation and returns the 403 page if opened directly.
- A control someone can see but not use is disabled with the tooltip from [§2.3](#23-shared-copy). Inline-editable fields render as plain text for viewers.
- During a support session ([§19.3](#193-support-session-banner)), every control that causes an external action is disabled with "Outside actions are blocked during a support session."
- In a read-only workspace, every write control is disabled with "Your workspace is read-only because a payment failed."

## 4. How to read a screen spec

Each screen lists:

| Part | Meaning |
|---|---|
| **Route, release, requirements** | Path from [§3.6](#36-routes), MVP or v1, and the PRD ids it satisfies |
| **Purpose** | One sentence |
| **Layout** | Regions, top to bottom and left to right, at desktop width. Phone differences follow. |
| **Data** | Fields shown, by DATA_MODEL name. `a.b` means column `b` of table `a`; `x.y.z` inside jsonb is a key. |
| **Actions** | Primary (one) and secondary |
| **States** | `{thing}` for the generic loading and error copy, then exact empty copy and special states |
| **Permissions** | Differences by flag ([§3.7](#37-permissions-in-the-ui)) |

Rules for every screen, so specs don't repeat them:

1. **Order of branches.** Pending, then error, then empty, then data. Never render the empty copy while a query is pending.
2. **Loading.** Render nothing for the first 300 ms. After that, a skeleton in the shape of the region (rows for tables, blocks for cards). No spinners and no loading text for page data. The region has `aria-busy="true"` and a visually hidden live text "Loading {thing}". Background refetches show nothing.
3. **Mutations.** The button that started a write shows its in-progress label ("Saving…", "Pursuing…") and is disabled until the write settles. Other controls stay usable.
4. **Errors.** A region that fails shows the generic copy with Try again, `role="alert"`, inside the region. A route loader that fails shows the same copy at page level. Write failures show a toast ([§22.15](#2215-toasts)) unless the spec says inline.
5. **Empty.** One or two sentences in the `Empty` component, at most one button. Filtered lists that come back empty always show "Nothing fits these filters." with Clear filters.
6. **Live updates.** Every screen listens for the events in [§23.3](#233-realtime-events-and-invalidation) through query invalidation. New rows appear in place; nothing jumps under the pointer (new rows above the viewport don't shift the scroll position).
7. **Titles.** `document.title` is "{page} | {workspace} | Magpie". Record pages use the record name as {page}.

## 5. Getting in

All screens in this section use the `_public` layout: Magpie logo, a centered card 25rem wide, the form, and links under the card. No marketing panel.

### 5.1 Sign up

**Route** `/sign-up`, then `/sign-up/business` for Google or Microsoft sign-ups. **Release** MVP. **Requirements** FR-ACC-1.

**Purpose.** Create a person and a workspace in under 60 seconds.

**Layout.** `h1` "Create your workspace". Buttons "Continue with Google" and "Continue with Microsoft". Divider "or". Form. Under the card: "Already use Magpie? Sign in".

**Fields.**

| Label | Writes | Rules | Autocomplete |
|---|---|---|---|
| Your name | `users.name` | Required, 1 to 80 characters | `name` |
| Work email | `users.email` | Required, valid email | `email` |
| Business name | `tenants.name` | Required, 2 to 80 characters. Helper: "You can change this later." | `organization` |
| Password | Better Auth credential | Required, at least 10 characters. Show and hide toggle. Paste allowed. No composition rules. | `new-password` |

Link under the password field: "Email me a sign-up link instead" hides the password field and changes the button to "Send link".

**Actions.** Primary "Create workspace" ("Creating workspace…"). Creates the user, then the workspace through `tenants.createTenant()` (DATA_MODEL §17), sets it active and goes to `/onboarding/business`. If creation takes over 5 seconds, a line under the button reads "Setting up your workspace…".

Google and Microsoft: after the provider returns, a new person with no workspace lands on `/sign-up/business` with one field, "Business name", and the button "Create workspace".

Legal line under the button: "By creating a workspace you agree to the Terms and the Privacy Policy." Both are links.

**States.**

| Case | Copy |
|---|---|
| Email already has an account | "There's already an account for {email}. Sign in instead." with link Sign in |
| Password too short | "Use at least 10 characters." |
| Provider canceled | "Google sign-in was canceled. Try again or use email." (Microsoft likewise) |
| Network or server failure | "Couldn't create your workspace. Try again." |

### 5.2 Sign in

**Route** `/sign-in` (`?redirect=&reason=&error=`). **Release** MVP. **Requirements** FR-ACC-1, FR-ACC-6.

**Layout.** `h1` "Sign in to Magpie". Google and Microsoft buttons, divider, Email (`email`), Password (`current-password`) with "Forgot password?" link beside the label. Primary "Sign in" ("Signing in…"). Link "Email me a sign-in link". Under the card: "New to Magpie? Create a workspace".

**After sign-in.** One membership: make it active, go to `redirect` or `/today`. Several and no remembered active workspace: `/workspaces`. None: `/workspaces/new`.

**Notices above the form** (from `reason` or `error`):

| Param | Copy |
|---|---|
| `reason=expired` | "You were signed out. Sign in to continue." |
| `reason=signed_out_everywhere` | "You signed out of all devices." |
| `error=link_expired` | "That link expired or was already used. Send a new one." |
| `error=provider` | "Couldn't sign you in with {provider}. Try again or use email." |

**Errors.** Wrong email or password: "That email and password don't match. Try again or reset your password." Too many attempts: "Too many tries. Wait 10 minutes or reset your password."

### 5.3 Check your email (magic link sent)

**Route** `/sign-in/link-sent?email=`. **Release** MVP. **Requirements** FR-ACC-1.

`h1` "Check your email". Body: "We sent a sign-in link to {email}. It works for {minutes} minutes." (`{minutes}` from the auth config, default 15.) Button "Send again", disabled for 60 seconds with the label "Send again in {s} s". Link "Use a different email".

### 5.4 Forgot password

**Route** `/forgot-password`. Field Email. Primary "Send reset link". After submit, always (no account enumeration): "If there's an account for {email}, we sent a link to reset the password. It works for 1 hour."

### 5.5 Set or reset password

**Route** `/reset-password?token=&mode=set|reset`. `h1` "Set your password" (`mode=set`) or "Choose a new password" (`mode=reset`). Field New password (`new-password`, at least 10 characters). Checkbox, `mode=reset` only, checked by default: "Sign out of my other devices". Primary "Save password". Success signs the person in and goes to `/today`. Bad or used token: "This link expired or was already used. Send a new one." with button "Send a new link" (goes to `/forgot-password`).

### 5.6 Confirm email

**Route** `/verify-email?token=`. Success: "Your email is confirmed." with button "Continue" to `/today`. Failure: "This link expired or was already used." with button "Send a new link" (signed in) or "Sign in" (signed out).

### 5.7 Accept an invite

**Route** `/invite/$invitationId`. **Release** MVP. **Requirements** FR-ACC-2.

**Layout.** Workspace logo, `h1` "Join {tenants.name}". Line: "{inviter name} invited you as {role}." Role line from [§17.7](#177-people-and-roles).

| Situation | What shows |
|---|---|
| Signed in as the invited email | Primary "Join {workspace}" |
| Signed in as another email | "You're signed in as {email}. This invite is for {invitations.email}." Button "Sign out and continue" |
| Signed out, account exists | Sign-in form with the email filled and locked |
| Signed out, no account | Name, Password, Google and Microsoft buttons. Email filled and locked. Primary "Join {workspace}" |
| `status='expired'` or past `expires_at` | "This invite expired on {date}. Ask {inviter} to send a new one." |
| `status='canceled'` | "This invite was canceled. Ask {inviter} if you still need access." |
| `status='accepted'` | "You already joined {workspace}." Button "Open {workspace}" |
| Seat limit at accept | "{workspace} has no free seats on its plan. Ask {inviter} to change plan." |

After joining: the workspace becomes active, then `/onboarding/phone?member=1`, then `/today`.

### 5.8 Choose a workspace

**Route** `/workspaces`. **Requirements** FR-ACC-3. `h1` "Choose a workspace". One row per membership: logo, `tenants.name`, role, "Last opened {date}" (`localStorage`). Click sets the active workspace and goes to `/today`. Button "Create a workspace". Empty: "You're not in a workspace yet. Create one, or ask a teammate to invite you."

### 5.9 Create a workspace

**Route** `/workspaces/new`. **Requirements** FR-ACC-1, FR-ACC-3. One field, "Business name". Primary "Create workspace". Goes to `/onboarding/business` in the new workspace.

### 5.10 Unsubscribe page (outreach recipients)

**Route** `/u/$token`. **Release** MVP. **Requirements** FR-SUB-6.

Public page for a subcontractor who clicked the unsubscribe link in an outreach email. The token is signed by the server (HMAC over tenant id and address) and needs no table. Visiting the page does nothing until the person presses the button, so link scanners can't unsubscribe anyone. Shows the sending business by `company_profiles.legal_name` (or `tenants.name`), never Magpie branding beyond a small "Sent with Magpie" footer.

| State | Copy | Button |
|---|---|---|
| Ready | `h1` "Stop emails from {business}". "{business} won't email {address} through Magpie again." | Unsubscribe |
| Done | "You're unsubscribed. {business} won't email {address} through Magpie again." | none |
| Bad token | "This unsubscribe link doesn't work. Reply to the email and ask to be removed." | none |

Unsubscribing writes `suppressions` with `reason='unsubscribe'`.

### 5.11 Sign out

User menu "Sign out" signs out this browser, clears the query cache and local drafts for this person ([§22.18](#2218-autosave-for-the-draft-editor)), and goes to `/sign-in`. "Sign out of all devices" is on Your account ([§17.1](#171-your-account)).

## 6. Onboarding

### 6.1 Frame

**Release** MVP. **Requirements** FR-PRO-1, FR-PRO-2, FR-PRO-3, FR-PRO-5, FR-CH-1, FR-CH-2, FR-CH-3.

- No rail. Header: logo, "Step {n} of 5", a progress bar, and the link "Skip setup" (goes to `/today`, which then shows the setup checklist).
- Each step: `h1` as a question or task, one description sentence, the form, then a footer with Back, "Skip this step" and the primary "Continue" ("Saving…").
- Continue saves the step's fields (PATCH `company_profiles`) and records progress in `tenant_settings.settings.onboarding` **(requested shape)**: `{ currentStep, completed: [], skipped: [], finishedAt, dismissedAt }`. `/onboarding` redirects to `currentStep`. Leaving and returning resumes there.
- Shown to the person who created the workspace. People who join by invite see only step 5 in its member form, tracked by `memberships.onboarded_at` **(requested)**.
- Target: under 5 minutes with a UEI (FR-PRO-1).

### 6.2 Step 1: Find your business

**Route** `/onboarding/business`. **Requirements** FR-PRO-2.

`h1` "Find your business". Description: "Enter your UEI or business name. We'll fill in what SAM.gov has on file."

- Field "UEI or business name" with the button "Look up" ("Looking up…").
- Results, up to 5 rows: legal name, UEI, city and state, SAM status ("Active until Mar 3, 2027" or "Expired on Jan 9"). Selecting a row shows a confirmation panel.
- Confirmation panel lists what will be saved, each with a "From SAM.gov" tag: legal name (`legal_name`), DBA (`dba`), UEI (`uei`), CAGE (`cage`), address (`base_address`), NAICS codes (`naics_codes`, primary first), certifications (`certifications`), SAM status and expiry (`sam_status`, `sam_expires_on`). Buttons: primary "This is us", secondary "Not us, search again".
- "This is us" writes the fields and one `field_provenance` row per field with `source='sam'` (FR-PRO-2).
- Link under the field: "We don't have a UEI yet" opens Legal name and Address fields.

| State | Copy | Buttons |
|---|---|---|
| No results | "No registered business matches "{q}". Check the UEI, or enter your details yourself." | Enter details |
| Lookup failed | "Couldn't reach SAM.gov right now. Enter your details yourself, or try again in a few minutes." | Try again, Enter details |

### 6.3 Step 2: What you do

**Route** `/onboarding/work`. **Requirements** FR-PRO-3.

`h1` "What work do you do?" Description: "Bid Scout uses this to find bids that fit."

| Field | Writes | Control |
|---|---|---|
| Trades you do yourself | `self_perform_trades` | Toggle chips: Janitorial, Landscaping and grounds, HVAC, Plumbing, Electrical, Painting, Roofing, Moving, Pest control, Snow removal, Other (adds a text field) |
| NAICS codes | `naics_codes` | Combobox searching code and title. Prefilled. First code tagged "Primary"; row menu "Make primary". When trades are picked and the list is empty, suggestions appear as chips (for example Janitorial suggests 561720). Invalid: "{code} isn't a NAICS code. Search by words instead." |
| PSC codes (optional) | `psc_codes` | Collapsed under "Add PSC codes (optional)" |
| Describe your work in a sentence or two | `capabilities` | Textarea. Placeholder: "Commercial cleaning for offices and clinics, day and night crews." |

### 6.4 Step 3: Where you work

**Route** `/onboarding/area`. **Requirements** FR-PRO-3.

`h1` "Where do you work?" Description: "Bid Scout scores bids by distance from your base."

| Field | Writes | Control |
|---|---|---|
| Base address | `base_address` | Address fields, prefilled |
| States | `service_area.states` | Multi-select of US states. Helper link "Add neighboring states" |
| Counties (optional) | `service_area.counties` | Multi-select filtered by the chosen states |
| How far will you travel? | `service_area.radiusMiles` | Segmented: 25, 50, 100, 250 miles, Any distance (null) |

Summary line under the form, computed: "Within 100 miles of Richmond, VA, in VA, MD and DC." No map.

### 6.5 Step 4: Certifications and limits

**Route** `/onboarding/limits`. **Requirements** FR-PRO-3, FR-DIS-3.

`h1` "Certifications and contract size". Description: "Set-asides you qualify for score higher. Bids you can't take are hidden."

| Field | Writes | Control |
|---|---|---|
| Certifications | `certifications` | Checkboxes with one-line descriptions: 8(a), WOSB, EDWOSB, HUBZone, SDVOSB, VOSB, SDB, DBE, MBE, WBE. SAM-prefilled ones carry "From SAM.gov". |
| Smallest job you'd take | `min_contract_cents` | Money input |
| Largest job you'd take | `max_contract_cents` | Money input. Must be at least the smallest: "The largest job can't be smaller than the smallest." |
| Employees | `employee_count` | Number |
| Bonding (optional) | `bonding.singleCents`, `bonding.aggregateCents`, `bonding.surety` | Collapsed |
| Insurance (optional) | `insurance.*` | Collapsed |

### 6.6 Step 5: Phone

**Route** `/onboarding/phone` (`?member=1`). **Requirements** FR-CH-1, FR-CH-2, FR-CH-3, FR-PRO-1.

`h1` "Get your morning digest by text". Description: "Each morning Magpie texts you new matches, deadlines and anything waiting for your yes. Reply to approve." Member form: `h1` "Get updates by text", description "Magpie texts you when a Bot needs your yes. Reply to approve."

Segmented control: Text message (default), Telegram, Email only.

**Text message.**
1. Field "Mobile number" (`tel`, US format as typed, stored E.164). Consent text under it (10DLC): "By sending a code you agree to get texts from Magpie about your workspace. Message frequency varies. Msg & data rates may apply. Reply STOP to stop, HELP for help." Button "Send code" ("Sending…").
2. "Enter the 6-digit code we sent to {formatted number}." Six-box code input (`one-time-code`, WebOTP autofill, paste fills all boxes). Button "Verify" ("Checking…"). Links "Send a new code" (60-second cooldown) and "Change number".
3. Success: "Your number is connected." Magpie then sends the link confirmation text ([§20.3](#203-templates)).

| Error | Copy |
|---|---|
| `invalid_code` | "That code didn't match. You have {n} tries left." |
| `code_expired` | "That code expired. Send a new one." |
| `too_many_attempts` | "Too many tries. Send a new code." |
| Landline or invalid | "That number can't get texts. Use a mobile number." |
| Already connected to another person here | "That number is already connected to someone else in this workspace." |

**Telegram.** Button "Open Telegram" (deep link `https://t.me/{bot}?start={link_codes.code}`). On desktop, a QR code of the same link with "Scan with your phone to open Telegram." While waiting: "Waiting for Telegram. Press Start in the chat." The step advances on the `channel.updated` event: "Telegram is connected." Expired code: "This link expired. Get a new one." with button "New link". Line under: "This link works for 15 minutes."

**Email only.** "We'll email your digest to {email}. You can add a phone later in Settings."

**Digest time** (all options): "Send my digest at" hour select, default 7:00 AM, with "{timezone name}" and a "Change" link that opens a timezone select (`users.timezone`). Writes the person's `notification_preferences.digest_hour` **(requested)**.

### 6.7 Your first searches

**Route** `/onboarding/done`. **Requirements** FR-PRO-5, FR-DIS-2.

`h1` "Your first searches". Description: "We built these from your profile. Turn one on and Bid Scout starts looking now."

Two or three cards. Each: name ("Janitorial in VA, MD and DC"), a one-line filter summary ("NAICS 561720. Small business and WOSB set-asides. Due in 7 or more days."), "{n} open bids match today", and the top 3 sample notice titles with due dates. Buttons: primary "Turn on" (creates `opportunity_searches`, `is_active=true`; state becomes "On. Bid Scout is scanning now."), secondary "Edit first" (opens the search editor, [§8.7](#87-saved-searches)). The first scan runs within 2 minutes (FR-PRO-5).

Footer: primary "Go to Today". If nothing was turned on, a line above it: "You can add searches later from Matches."

| State | Copy |
|---|---|
| Plan limit visible | "Your trial includes {n} saved searches." |
| Profile too thin | "Add your trades or NAICS codes and we'll suggest searches." Button "Back to What you do" |
| Suggestions failed | "Couldn't build suggestions right now. You can create a search from Matches." Button "Go to Today" |

The member form of step 5 skips this screen and goes to `/today`.

## 7. Today

**Route** `/today`. **Release** MVP. **Requirements** FR-PRO-4, FR-PRO-6, FR-BID-4, FR-BID-5, FR-DIS-5, FR-APR-3, FR-SUB-3, FR-CH-3 (same content as the digest).

**Purpose.** What needs you now and what's coming, in the order you'd act on it.

**Layout.** `h1` "Today" with the date under it ("Tuesday, November 10"). At 80rem and wider, two columns: main (two thirds) and side (one third). Below 80rem and on phones, one column in this order:

| Order | Section (`h2`) | Column | Shown when |
|---|---|---|---|
| 1 | Setup | main | Setup not finished and not hidden |
| 2 | SAM registration callout | main | `company_profiles.sam_status='expired'`, or `sam_expires_on` within 60 days (FR-PRO-6) |
| 3 | Waiting for you | main | always |
| 4 | Due soon | main | always |
| 5 | New matches | main | always |
| 6 | Your bids | side | always |
| 7 | Bot news | side | always |
| 8 | Expiring documents | side | items exist |

**Sections.**

1. **Setup.** Rows with a check when done, else a button: "Finish your business profile" (Finish), "Connect your phone" (Connect), "Turn on a saved search" (Create a search), "Pursue your first match" (See matches), "Invite a teammate" (Invite, optional). Link "Hide setup" sets `onboarding.dismissedAt`.
2. **SAM callout** (needs tone): "Your SAM registration expires on {date}. Renew it at SAM.gov to stay eligible for federal awards." or "Your SAM registration expired on {date}. Renew it at SAM.gov to bid on federal work." Button "Open SAM.gov" (external link, opens a new tab).
3. **Waiting for you.** Up to 5 rows, oldest first, of three kinds:
   - Approvals requested for me: compact approval card ([§22.12](#2212-approval-card)). Internal ones show Approve and Skip inline. External ones show "Review".
   - Quotes to check (`quotes.is_confirmed=false`): "{company} quoted {amount} for {bid}. Check the numbers." Button "Check".
   - Bid decisions (`deals.bid_decision.decision='undecided'` with a ready brief): "Bid Reader recommends {Bid or No bid} for {bid}. Score {score}." Button "Decide".
   Footer link "All approvals ({n})". Empty: "Nothing is waiting for you."
4. **Due soon.** Next 7 days. `bid_deadlines` rows: time (in the deadline's timezone, plus the viewer's local time when different), kind label ([§9.13](#913-deadlines)), bid link, countdown pill (needs tone under 72 hours, problem tone under 24 hours). Then tasks assigned to me that are overdue or due today: checkbox, title, record link, due. Empty: "No deadlines in the next 7 days."
5. **New matches.** Top 5 by score with `status` in (`new`, `shown`): score badge, title, agency, place, due, value range. Buttons Pursue, Save, Dismiss (below 64rem: Pursue plus a menu). Footer link "See all matches". Empty with active searches: "No new matches since your last visit. Bid Scout checks again {relative time of next scan}." Empty with none: "Turn on a saved search and Bid Scout will bring matches here." Button "Create a search".
6. **Your bids.** Open-category bids by `due_at`, up to 6: name, stage pill, due, one progress line ("Brief ready. 31 of 42 requirements met. 2 of 3 quotes in."). Empty: "No active bids. Pursue a match to start one."
7. **Bot news.** Runs finished in the last 24 hours, newest first, up to 6: Bot name, `agent_runs.output_summary`, time, link to the run or record. Empty: "Your Bots haven't finished anything today."
8. **Expiring documents.** `library_items` with `expires_on` within 30 days (FR-PRO-4): title, kind, "Expires {date}" (needs tone) or "Expired {date}" (problem tone). Link to the library item.

**Data.** One call, `GET /api/app/today` **(requested)**, key `["today"]`.

**States.** `{thing}` = "today". If the whole call fails, every section shows nothing and the page shows the region error once.

**Permissions.** Viewers see everything with no action buttons.

## 8. Matches

The Matches area has three sub-tabs under the page title: **Matches**, **Search all bids**, **Saved searches**. The header right side holds the source health indicator ([§8.6](#86-source-health)) and "New search".

### 8.1 Matches list

**Route** `/matches` (`?status=new|saved|pursuing|dismissed|all&search=&minScore=&due=&setAside=&state=&source=&ineligible=1&q=&sort=score|due|newest`). **Release** MVP. **Requirements** FR-DIS-2, FR-DIS-3, FR-DIS-5.

**Purpose.** Review what Bid Scout found and decide quickly.

**Layout.** Status tabs with counts in plain text ("New 12", "Saved 3", "Pursuing 4", "Dismissed", "All"). New covers `status` in (`new`, `shown`). Filter bar: Saved search (select), Minimum score (Any, 40 and up, 60 and up, 80 and up), Due within (7, 14, 30 days, Any), Set-aside, State, Source (Federal, State and local), switch "Show bids you can't take" (off by default; score 0 rows are hidden, FR-DIS-3), and a text filter "Filter by title or agency". Sort: Score (default), Due date, Newest. Then the table.

**Data, table columns.**

| Column | Source | Priority |
|---|---|---|
| Score | `opportunity_matches.score` (score badge) | P1 |
| Title | `market_opportunities.title`; second line `agency` | P1 |
| Place | `place_of_performance.city`, `.state` | P2 |
| Set-aside | `set_aside` label | P2 |
| Due | `response_due_at`: date and relative | P1 |
| Value | `estimated_value_low_cents` to `estimated_value_high_cents` ("$100K to $250K", "Up to $250K", "Not listed") | P2 |
| Source | `source`: "SAM.gov" or "State and local" | P3 |
| First seen | `first_seen_at` | P3 |
| Actions | Pursue, Save for later, Dismiss | P1 |

Row click opens the match. Opening a match with `status='new'` sets `shown` on the server.

**Phone.** Cards: score badge, title (two lines), agency, due, value. Footer buttons Pursue, Save and a menu with Dismiss. No swipe gestures.

**Actions.**
- **Pursue** ("Pursuing…"): creates the bid (FR-DIS-5). Toast "Pursuing {title}. Bid Reader is reading the documents." with action "Open bid". The row moves to Pursuing. If the server says it's already a bid, go to that bid.
- **Save for later**: `status='saved'`. Toast "Saved for later." with Undo.
- **Dismiss**: opens the dismiss dialog.
- **Bulk** (row checkboxes): Save for later, Dismiss (one reason for all). Pursue is one at a time.

**Dismiss dialog.** Title "Dismiss match". Radio list (stored as `opportunity_matches.dismiss_reason` keys **(requested)**): Not our kind of work (`not_our_work`), Too far away (`too_far`), Too big for us (`too_big`), Too small (`too_small`), We're not eligible (`not_eligible`), Not enough time (`due_too_soon`), Strong incumbent (`strong_incumbent`), Other (`other`, shows a note field stored in `dismiss_note` **(requested)**). Helper: "Bid Scout will score similar bids from this agency lower for 90 days." Buttons "Dismiss" and "Cancel". Toast: "Dismissed. Similar bids from {agency} will score lower." with Undo (restores `shown`).

**States.** `{thing}` = "matches".

| Tab | Empty copy | Button |
|---|---|---|
| New, with active searches | "No new matches. Bid Scout checks your searches again {relative next scan}." | none |
| New, no searches | "No saved searches yet. Create one and Bid Scout will look for bids every few hours." | Create a search |
| Saved | "Nothing saved. Use Save for later on a match to keep it here." | none |
| Pursuing | "You're not pursuing any matches. Pursue one to start a bid." | none |
| Dismissed | "No dismissed matches." | none |

**Permissions.** Viewers see no actions or checkboxes.

### 8.2 Match detail

**Route** `/matches/$matchId`. **Release** MVP. **Requirements** FR-DIS-3, FR-DIS-4, FR-DIS-5. Opens in under 2 seconds (FR-DIS-4): the route loader prefetches on row hover.

**Layout.**
- Back link "Matches".
- Header: title (`h1`), then agency, office, solicitation number (with copy button), notice type pill, source pill. Right: large score badge with band label.
- Action bar: primary "Pursue", secondary "Save for later", "Dismiss". Menu: "Open on {source site}" (`url`, new tab), "Copy link".
- If `status='pursuing'`: callout "You're pursuing this." with "Open bid" (`deal_id`), and no action bar.
- If `status='dismissed'`: callout "You dismissed this on {date}: {reason label}." with "Restore".
- Main column:
  - **Why it matches** (`h2`): one row per `reasons[]` item: factor label (NAICS fit, Set-aside, Distance, Contract size, Time to respond, Past performance, Incumbent), the `note`, and "Raises the score" or "Lowers the score" in text (not color alone). At least three rows (FR-DIS-3).
  - **Summary** (`h2`): `market_opportunities.summary`.
  - **Documents** (`h2`): one row per `market_opportunity_texts.document_ref`: `document_title`, page count (max `page_to`). Opens the reader ([§8.4](#84-notice-document-reader)). If no text is stored yet: "These documents aren't read yet. Pursue this bid and Bid Reader will read them." followed by links to the source attachments from `raw`.
- Side column, **Key facts** as a definition list: Posted (`posted_at`), Responses due (`response_due_at`), Place of performance, Set-aside, NAICS codes, PSC (`psc_code`), Estimated value, Notice type, Source with link.

**States.** `{thing}` = "match". Not found: "This match doesn't exist or was removed." with "Go to Matches".

### 8.3 Notice detail

**Route** `/notices/$opportunityId`. **Release** MVP. **Requirements** FR-DIS-1, FR-DIS-4, FR-DIS-5.

Same layout as match detail for a notice from Search that isn't in your matches. No score or reasons. Header note: "Not in your matches." Actions: "Pursue" (creates an `opportunity_matches` row with `search_id` null, scored, `status='pursuing'`, plus the bid) and "Save for later" (creates the match with `status='saved'`). If a match exists for this notice, the route redirects to it.

### 8.4 Notice document reader

**Route** `/matches/$matchId/documents/$documentRef` and `/notices/$opportunityId/documents/$documentRef` (`?page=`). **Requirements** FR-DIS-4.

Text view of the shared bid text (`market_opportunity_texts` for that `document_ref`, ordered by `chunk_no`, grouped by `page_from`). Toolbar: document title, page number input "Page {n} of {total}", previous and next, "Find in document" (Ctrl F within the reader), "Open original" (source link). Empty: "This document has no readable text. Open the original." `{thing}` = "document".

### 8.5 Search all bids

**Route** `/matches/search` (filters in search params). **Release** MVP. **Requirements** FR-DIS-1, FR-DIS-2.

**Layout.** Filter panel on the left (18rem; a bottom sheet on phones, opened by "Filters ({n})"), results on the right.

**Filters** (map to `opportunity_searches.filters` keys): Keywords (`keywords`, chips), Exclude words (`excludeKeywords`), NAICS (`naics`, with switch "Use my NAICS codes"), PSC (`psc`), Set-aside (`setAsides`), State (`states`), Agency (`agencies`), Value from and to (`valueMinCents`, `valueMaxCents`), Due within (`dueWithinDays`: 7, 14, 30, 60 or a number), Notice type (`noticeTypes`: Solicitation, Combined synopsis and solicitation, Sources sought, Presolicitation, Award), Source (`sources`: Federal, State and local).

Results update 400 ms after the last change. Button "Save this search" opens a dialog with Name (prefilled from keywords and states) and "Save search". Plan limit error: `saved_search_limit` copy.

**Results table.** Title and agency, Place, Set-aside, Due, Value, Source, and a score badge when the notice is already one of your matches. Count above: "About {n} bids". 25 per page with Previous and Next. p95 under 3 seconds (FR-DIS-1). Row opens the match if one exists, else the notice.

**States.** `{thing}` = "results".

| Case | Copy |
|---|---|
| Before the first search | "Set filters to search open bids from SAM.gov and state and local portals." |
| No results | "No open bids fit these filters. Try fewer keywords or a wider area." |
| One source failed | Callout above results: "State and local results are missing right now. Federal results are complete." (or the reverse) |
| Search failed | "Couldn't search bids right now. Try again in a minute." |

**Permissions.** Viewers can search but not save or pursue.

### 8.6 Source health

Shown on the Matches header and the Bids list header (PRD §12). Reads `GET /api/app/market/sources` **(requested)**, key `["market","sources"]`, refreshed every 5 minutes.

| State | Label | Tone |
|---|---|---|
| All sources ok | "Sources: all working" | done |
| One degraded | "{source}: delayed" | needs |
| One down | "{source}: not updating" | problem |

Popover per source: name ("SAM.gov", "State and local"), "Updated {relative time}", and for degraded or down: "New notices from {source} may be late. Bid Scout catches up when it's back."

### 8.7 Saved searches

**Route** `/matches/searches`. **Release** MVP. **Requirements** FR-DIS-2.

**Layout.** Plan line: "{n} of {limit} saved searches on your plan." Rows (`opportunity_searches`): name, one-line filter summary, switch `is_active`, "Last checked {relative}" (`last_scanned_at`), "{n} matches", created by. Switch description: on "Bid Scout checks this {schedule summary of the scan job}." off "Paused."

**Actions.** Primary "New search". Row click opens the editor dialog (the filter form from [§8.5](#85-search-all-bids) plus Name, with a live line "{n} open bids match right now"). Row menu: Edit, Scan now (toast "Bid Scout is scanning {name}."), Duplicate, Delete.

Delete dialog: title "Delete saved search", body "Matches it already found stay in Matches.", button "Delete search".

**States.** `{thing}` = "saved searches". Empty: "No saved searches. Create one and Bid Scout will check it every 4 hours on business days." Button "New search". (The interval comes from the `scan_opportunities` job.)

**Permissions.** `recordsWrite` creates and edits. Viewers read.
## 9. Bids and the bid workspace

### 9.1 Bids list

**Route** `/bids` (`?tab=active|submitted|closed|all&owner=me|all&due=&stage=&tag=&sort=due|newest|score`). **Release** MVP. **Requirements** FR-BID-4, FR-BID-5, FR-CRM-1.

**Purpose.** Every bid you're working on, by what's due next.

**Layout.** `h1` "Bids". Header right: source health, primary "New bid". Tabs: Active (stage category `open`), Submitted (`submitted`), Closed (`won`, `lost`, `no_bid`), All. Filters: Owner (Mine, Everyone), Due within, Stage, Tag. Sort: Due date (default, soonest first), Newest, Score.

**Table columns.**

| Column | Source | Priority |
|---|---|---|
| Bid | `deals.name`; second line `solicitation_number` | P1 |
| Agency | `companies.name` via `deals.company_id` | P2 |
| Stage | `pipeline_stages.name` pill | P1 |
| Due | `due_at` with relative time; problem tone under 24 hours, needs under 72 | P1 |
| Decision | `bid_decision.decision`: Bid, No bid, Not decided | P2 |
| Progress | Short facts: "Brief ready" or "Reading", "Requirements {met}/{total}", "Quotes {in}/{asked}", "Price v{n} {approved or draft}", "Drafts {approved}/{total}" | P2 |
| Waiting | Pending approvals on this bid | P3 |
| Owner | avatar of `owner_user_id` | P3 |

Phone cards: name, agency, stage pill, due, one progress line.

**New bid dialog** (bids found outside Magpie). Fields: Bid name (`deals.name`, required), Agency or buyer (company combobox with "Create {name}"), Solicitation number, Proposal due (date, time and timezone; timezone defaults to the workspace's), Documents (dropzone, optional). Primary "Create bid". Creates a deal with `kind='bid'`, `source='manual'`, in the default bid pipeline at Found. Uploaded files become `bid_documents` with `kind='solicitation'` and Bid Reader starts.

**States.** `{thing}` = "bids".

| Tab | Empty copy | Buttons |
|---|---|---|
| Active | "No active bids. Pursue a match to start one, or add a bid you found yourself." | See matches, New bid |
| Submitted | "No bids waiting on an award." | none |
| Closed | "No closed bids yet." | none |

**Permissions.** Viewers: no New bid.

### 9.2 Bid workspace frame

**Route** `/bids/$dealId/*`. **Release** MVP. **Requirements** FR-BID-1 to FR-BID-9, FR-DIS-7, FR-CH-7.

**Purpose.** One place to read, price, write and submit a bid.

**Layout.**

1. Back link "Bids".
2. **Header row 1:** bid name (`h1`, inline editable), stage pill (opens the stage menu), due countdown: "Due in 3 days, Thu Nov 12 at 2:00 PM ET".
3. **Header row 2:** agency link, solicitation number with copy button, owner (avatar, opens a person select), notice link ("Notice on SAM.gov"), tags.
4. **Header actions:** primary "Mark submitted" (open stages only), secondary "Export package", "Ask a Bot" (opens the Assistant panel with this bid as context, FR-CH-7). Menu: Move to No bid, Add deadline, Download calendar file (.ics of this bid's deadlines), Open match, Copy link, Archive bid.
5. **Bid banners** (below the header, priority order):

| Condition | Copy | Buttons |
|---|---|---|
| `deals.is_ai_drafting_allowed=false` | "This solicitation doesn't allow AI drafting. Bots won't write proposal text for this bid. They still read documents, track deadlines and chase quotes." Followed by a citation chip to the clause. | "This is wrong" (`botsManage`; dialog "Turn AI drafting back on for this bid?", body "Only do this if the solicitation allows AI. Magpie keeps a record of this change.", button "Turn on AI drafting") |
| A requirement with `category='ai_use'` asks for disclosure | "This solicitation asks you to disclose AI use. Magpie keeps a record of what AI wrote and drafts a disclosure statement." | See disclosure (Drafts tab, Disclosure panel) |
| New amendment, Bid Reader running (FR-DIS-7) | "Amendment {title} was posted on {date}. Bid Reader is checking what changed." | none |
| Amendment processed | "Amendment {title} changed {n} requirements and {list of changed deadlines}." Dismissible. | See changes (Timeline filtered to the amendment) |
| Award notice, winner unclear (FR-DIS-7) | "An award notice was posted. Magpie couldn't tell who won." | Mark won, Mark lost |
| Archived | "This bid is archived." | Restore |

6. **Tabs** (child routes, `role="tablist"` styling on links): Brief, Requirements ({total}), Documents ({count}), Pricing, Subs and quotes, Drafts, Timeline. On phones the tab bar scrolls sideways.
7. **Right rail** (80rem and wider, 20rem). Below 80rem these cards sit at the top of the Brief tab, collapsed.
   - **Deadlines**: `bid_deadlines` rows ([§9.13](#913-deadlines)). Button "Add deadline".
   - **Waiting for you**: compact approval cards for approvals with this deal as `record_id`.
   - **Tasks**: open tasks linked to this deal. Quick add "Add a task".
   - **People**: `deal_contacts` with role labels (Contracting officer, Contract specialist, Buyer, Prime PM, Subcontractor, Reference, Other). Button "Add person".

**Stage menu.** Lists the pipeline's stages in order. Choosing Submitted opens Mark submitted ([§9.11](#911-mark-submitted)). Lost asks for `lost_reason` ("Why did you lose?", optional). No bid asks for `no_bid_reason` (required). Each change writes `record_history` and an activity (FR-CRM-2).

**Data.** `["bids","detail",dealId]` returns the deal, stage, company, counts and flags; `["bids","deadlines",dealId]`.

**States.** `{thing}` = "bid". Not found: "This bid doesn't exist or was removed." with "Go to Bids". A deal with `kind='sale'` redirects to `/deals/$dealId`.

**Permissions.** Viewers: read only; no Mark submitted, stage menu or edits. Export package is allowed for everyone.

### 9.3 Brief tab

**Route** `/bids/$dealId/brief`. **Requirements** FR-BID-2, FR-BID-5, FR-BID-6, FR-PRO-6.

The brief is stored in `bid_briefs` **(requested)**: one row per version with `status` and `sections`.

**Layout, top to bottom.**

1. **Reading status** while `bid_briefs.status` is `pending` or `reading`: card "Bid Reader is reading {n} documents. The brief usually takes under 10 minutes." One line per document: title, pages, status from `bid_documents.text_status` ("Waiting to read", "Reading", "Read", "Couldn't read"). When it finishes, the card is replaced by the brief and the person gets the run-finished notification.
2. **Bid or no bid** card (FR-BID-5) from `deals.bid_decision`:
   - Undecided: "Bid Reader recommends: {Bid or No bid}". Score badge. Reasons, one line each, by factor (Eligibility, Fit, Capacity, Distance, Competition, Price range, Time left), each with citation chips where the reason comes from a document. Buttons: primary "Bid", secondary "No bid", "Decide later".
   - Choosing against the recommendation shows "Why? (optional). Bid Reader learns from this." before saving.
   - No bid requires a reason (`no_bid_reason`) and moves the deal to the No bid stage.
   - Decided: "You decided to bid on {date}." or "{name} decided not to bid on {date}: {reason}." Link "Change".
3. **Red flags** (shown first when present, needs tone): each flag one line with citation chips.
4. **Brief sections**, each a card with an `h2` and fact rows. Each fact is text plus one or more citation chips. A fact with `isUnknown=true` reads "Not found in the documents." in muted text.

| `sections[].key` | Heading |
|---|---|
| `scope` | What the work is |
| `place` | Where |
| `dates` | Key dates (each date links to its deadline) |
| `contract` | Contract type and length |
| `evaluation` | How they'll pick a winner |
| `bonding_insurance` | Bonding and insurance |
| `wage` | Wage rules |
| `site_visit` | Site visit |
| `submission` | How to submit |
| `ai_use` | AI rules |

5. **Footer:** "Brief by Bid Reader, {date}, from {n} documents." Version select when there's more than one ("Version 2, after amendment 0001"). Buttons "Read again" (re-runs Bid Reader; confirm "Read the documents again? Bid Reader writes a new version of the brief." with "Read again") and "Ask Bid Reader" (Assistant panel with Bid Reader and this bid as context).

Fact row menu: Copy with source, Ask about this (opens chat with the fact and its citation as context).

**States.** `{thing}` = "brief".

| Case | Copy | Button |
|---|---|---|
| No documents | "No documents yet. Upload the solicitation and Bid Reader will write the brief." | Upload documents |
| `status='failed'` | "Bid Reader couldn't finish the brief. {mapped error}." | Read again |
| A document couldn't be read | Line in the brief footer: "{title} couldn't be read. It may be a scanned image. Upload a searchable copy." | Upload |

### 9.4 Requirements tab

**Route** `/bids/$dealId/requirements` (`?category=&required=1&status=&owner=&gaps=1&q=&req=`). **Requirements** FR-BID-3, FR-DRF-1.

**Layout.**
- Summary: "{met} of {total} met. {gaps} required items aren't answered in any draft." Progress bar of met over total, with the numbers as text.
- Filters: Category (multi), Required only, Status, Owner, switch "Gaps only" (`is_mandatory` and no link in `draft_requirement_links` **(requested)**), text filter "Filter requirements".
- Table:

| Column | Source | Priority |
|---|---|---|
| # | `position` | P2 |
| Requirement | `text`, clamped to 3 lines, expands on click | P1 |
| Category | `category` label | P2 |
| Required | `is_mandatory`: "Required" or "Optional" | P1 |
| Status | `status` select: Open, Met, Not met, Doesn't apply | P1 |
| Owner | `owner_user_id` select | P3 |
| Answered in | Draft links, or a "Gap" pill when required and unanswered | P2 |
| Source | citation chip from `citation` | P1 |

Category labels: Submission, Technical, Pricing, Eligibility, Certification, Insurance, Bonding, Site visit, Evaluation, AI use, Wage, Staffing, Other.

- Row click (or `?req=`) opens a side sheet: full text, citation preview with the quoted sentence and "Open page {n}", Status, Owner, Response note (`response_note`, saves on blur), Answered in (draft list), "Found by Bid Reader" with a run link or "Added by {name}".

**Actions.**
- Primary "Add requirement": dialog with Requirement (text), Category, Required (checkbox, checked), and Source: Document (select of `bid_documents`), Page (number), Exact sentence (paste). Helper: "Every requirement needs its source. Paste the sentence from the document." All three source fields are required (`citation` is not null). Also reachable from the document viewer's selection menu with the source prefilled.
- Bulk (checkboxes): Set status, Assign owner, Delete. Delete dialog: "Delete {n} requirements? They're removed from the checklist and from draft coverage." Button "Delete requirements".
- Export menu: "Compliance matrix (Excel)", "CSV".

Status changes are optimistic ([§23.4](#234-optimistic-updates)).

**States.** `{thing}` = "requirements".

| Case | Copy | Button |
|---|---|---|
| Bid Reader still reading | "Bid Reader is still reading. Requirements show here as it finds them." | none |
| No documents | "No requirements yet. Upload the solicitation and Bid Reader will list them." | Upload documents |

**Permissions.** Viewers read only; no checkboxes.

### 9.5 Documents tab and viewer

**Route** `/bids/$dealId/documents` and `/bids/$dealId/documents/$documentId` (`?page=&hl=`). **Requirements** FR-BID-1, FR-BID-2, FR-BID-3, FR-DIS-7.

**Layout.** Desktop: list on the left (19rem), viewer on the right, resizable. Phone: the list, then the viewer as its own page.

**List.** Grouped by `bid_documents.kind`: Solicitation, Amendments, Statement of work, Pricing schedule, Wage determinations, Questions and answers, Attachments, Your uploads. Each row: title, "{page_count} pages", status, added date, origin ("From the notice" when `market_document_ref` is set, else "Uploaded by {name}"). New amendments carry a "New" pill until opened.

Row status: from `files.scan_status` first ("Checking file" while pending, "Removed: failed the security scan" when infected), then `text_status` (Waiting to read, Read, Couldn't read, Can't read this type).

**Upload.** Button "Upload" and drag and drop onto the list. Accepts .pdf, .docx, .xlsx, .png, .jpg, .jpeg, .tif. Max 100 MB per file. Each file shows "Uploading {n}%", then "Checking file", then "Reading". A kind select appears on each new row (default Your upload). Errors: `file_too_large`, `unsupported_file`, `file_infected` copy.

**Viewer.**
- Toolbar: title, "Page {n} of {total}" with a number input, previous and next, zoom (Fit width, 100%, 125%, 150%), "Find in document" (Ctrl F inside the viewer), "Open original" (`source_url`, or a presigned link to `file_id`), Download.
- PDFs render with pdf.js (`pdfjs-dist`) with a text layer. Other types render as text by page from `bid_document_chunks` or `market_opportunity_texts`.
- **Highlight.** `hl` is the cited sentence (URL-encoded, first 200 characters). After the page renders, the viewer finds it in the page's text after normalizing whitespace, line-break hyphens and quote styles, wraps the match in `<mark>` with the highlight token, and scrolls it to the center. Live region: "Highlighted on page {n}." If not found on that page, it searches one page before and after. If still not found, a callout at the top of the page: "Couldn't find the exact sentence on page {n}. It reads: "{quote}"".
- **Selection menu** (writers): select text, then a floating menu: "Add as requirement", "Add as deadline", "Ask about this" (chat with the quote and its citation), "Copy with source".

**States.** `{thing}` = "documents" for the list, "document" for the viewer.

| Case | Copy | Button |
|---|---|---|
| No documents | "No documents yet. Documents from the notice show here automatically. You can upload your own too." | Upload |
| Viewer failed | "Couldn't open this document. Try again, or open the original." | Try again, Open original |
| `text_status='failed'` | "Bid Reader couldn't read this document. It may be a scanned image. Upload a searchable PDF, or read it here yourself." | Upload |

### 9.6 Pricing tab

**Route** `/bids/$dealId/pricing` (`?version=`). **Requirements** FR-PRC-1 to FR-PRC-5, FR-SUB-5.

**Layout.**

1. **Header:** version select ("Version 3, draft", "Version 2, approved by Dana on Nov 9", "Version 1, replaced"), status pill. Buttons: primary "Approve version" (drafts only), secondary "New version" (copies the shown version), "Ask Estimator" (re-prices; runs Estimator with this bid as context), Export menu (Excel, PDF).
2. **Summary row**, four tiles:
   - Total: `price_sheets.total_cents`.
   - Margin: `margin_bps` as a percent.
   - Past awards: a range bar from the lowest to the highest `award_comparables.award.amountCents` with the median marked and a marker for this total. Text under it: "Inside the range", "{n}% above the range" or "{n}% below the range".
   - Subcontracted: share of subcontract lines in the total against the FAR 52.219-14 cap for `deals.work_category` **(requested)**: "38% of a 50% cap". Shown only for set-aside bids (FR-PRC-5).
3. **Warnings** (needs tone callouts, FR-PRC-4, FR-PRC-5):
   - "Your price is {n}% above similar past awards ({low} to {high})." or "below".
   - "Margin is {n}%. Your floor is {floor}%." (`tenant_settings.margin_floor_bps` **(requested)**)
   - "Subcontracted share is {n}%. This set-aside caps {services, general construction, special trades} at {cap}% (FAR 52.219-14)." With a citation chip when the clause is in the documents.
   - "No wage determination found yet. Estimator asked you about it in chat."
4. **Wage determination** card (FR-PRC-1): WD number, revision, act ("Service Contract Act" or "Davis-Bacon"), place, citation chip, link "Open on SAM.gov". Rates table from the labor lines' `wage_ref`: occupation code, title, hourly rate, fringe. Not found: "Estimator didn't find a wage determination in the documents." Button "Add WD number" (field, then Estimator looks it up).
5. **Lines** (`price_lines`), grouped by `kind` with subtotals: Labor, Materials, Equipment, Subcontract, Travel, Overhead, Profit, Other. Columns: Description, Qty, Unit, Unit cost, Total, Source. Source is a chip: wage reference ("WD 2015-4281 rev 23, Janitor"), quote ("Green Lawn quote"), profile ("Your labor rate"), a document citation, or "Entered by {name}". Every line shows its source (FR-PRC-3).
   - Draft versions are editable by writers: Description, Qty, Unit, Unit cost inline; "Add line" per group; row menu Delete, Move up, Move down. Drag handles also reorder.
   - Totals: the browser previews totals with `computePriceSheet()` from `packages/shared` while the save is in flight, then shows the server's numbers. The Total tile shows "Updating…" until the server answers. The model never computes totals (FR-PRC-3).
6. **Assumptions:** `assumptions` textarea, saves on blur.
7. **Past awards** table (FR-PRC-2): Recipient, Agency, Amount, Awarded, NAICS, Why it's comparable (`relevance_note`), link to the award record (`award.url`).

**Approve version** dialog: title "Approve version {n}", body "It becomes the price in your bid package. The approved version before it is marked replaced.", button "Approve version". After approval the lines are read-only and the header reads "Approved by {name} on {date}".

**States.** `{thing}` = "price sheet".

| Case | Copy | Buttons |
|---|---|---|
| No sheet | "No price sheet yet. Estimator drafts one after the brief is ready." | Ask Estimator, Start from blank |
| No comparables | "Estimator found no comparable awards for this agency, NAICS and place." | none |
| Estimator running | "Estimator is pricing this bid." | none |

**Permissions.** Writers edit drafts and approve. Viewers read.

### 9.7 Subs and quotes tab

**Route** `/bids/$dealId/quotes` (`?request=`). **Requirements** FR-SUB-1 to FR-SUB-6.

**Layout.** Three sections.

**1. Quote requests** (`h2`). Header button: primary "Request quotes".

| Column | Source |
|---|---|
| Company | `quote_requests.company_id` link |
| Contact | `contact_id` name and primary email |
| Scope | `scope`, one line |
| Due | `due_at` |
| Status | pill ([§22.14](#2214-status-pills)) |
| Follow-ups | "{followups_sent} of {max} sent. Next {next_followup_at}" |
| Last activity | latest message time |

Row opens a side sheet: scope, attachments, and the thread (`messages` with this `quote_request_id`, outbound and inbound, newest last). Note: "Replies come to this bid and to your inbox." Buttons: "Send follow-up now" (creates an approval), "Mark declined", "Cancel request".

**Request quotes dialog.** Pick companies (multi-select from Suggested subcontractors and companies with kind `subcontractor`). Suppressed or do-not-contact contacts are disabled with "Unsubscribed. Magpie won't email this address." Scope (prefilled by Sub Finder from the brief), Site details, Quote due (date), Attachments (choose from bid documents). Primary "Draft requests". Sub Finder drafts one email per company, each becomes an approval, and the toast reads: "Sub Finder drafted {n} quote requests. Approve them to send." with "Review". Nothing is sent from this dialog (FR-SUB-2).

**2. Quotes received** (`h2`).

| Column | Source |
|---|---|
| Company | `quotes.company_id` |
| Amount | `amount_cents` |
| Valid until | `valid_until` |
| Scope notes | `scope_notes` |
| Exclusions | `exclusions` |
| Numbers | "Checked" (`is_confirmed`) or button "Check numbers" |
| File | open `file_id` |
| In price | "In price v{n}" or button "Use in price sheet" |

With two or more quotes, a switch "Compare side by side" (FR-SUB-5) shows one column per company and one row per field. The lowest amount carries the text "Lowest".

**Check numbers dialog** (FR-SUB-3). Wide dialog. Left: the reply email and attachment, with the parsed values highlighted. Right: Amount, Valid until, Scope notes, Exclusions, prefilled from `quotes.parsed` with citation chips. Text: "Sub Finder read these from the reply. Check them before they go in a price sheet." Buttons: primary "Confirm numbers" (sets `is_confirmed`), secondary "Save without confirming".

**Use in price sheet.** Requires `is_confirmed`, else the `quote_not_confirmed` copy. Adds a `subcontract` line with `quote_id` and its citation to the current draft version. If the newest version is approved: dialog "Version {n} is approved. Add this quote to a new version {n+1}?" with "Create version {n+1}". Toast: "Added {company}'s quote to price version {n}."

**3. Suggested subcontractors** (`h2`, from `sub_suggestions` **(requested)**). Header button "Find more" (runs Sub Finder). Rows: name, trade, distance ("12 miles from the site"), source ("In your companies", "SAM.gov", "Kontract", "Their website"), contact path ("Email on file", "Phone only", "Website form"). Buttons: "Request a quote" (opens Request quotes with this company), "Add to companies", "Dismiss".

**States.** `{thing}` = "quotes".

| Section | Empty copy |
|---|---|
| Quote requests | "No quote requests yet. Pick subcontractors below and Sub Finder drafts the requests for your approval." |
| Quotes received | "No quotes yet. Replies to your requests show here within a minute." |
| Suggestions, running | "Sub Finder is looking for subcontractors near {place}." |
| Suggestions, none | "Sub Finder found no subcontractors near {place} for {trade}. Add one you know." Button "Add company" |

**Permissions.** Viewers read only.

### 9.8 Drafts tab

**Route** `/bids/$dealId/drafts`. **Requirements** FR-DRF-1, FR-DRF-2, FR-BID-6.

**Layout.**
- Coverage line: "{n} required items aren't answered in any draft." Link "See gaps" (Requirements tab with `?gaps=1`).
- Table: Title, Kind (Proposal, Technical approach, Past performance volume, Capability statement, Cover letter, Quote letter, Email, Text message, Other), Status pill, Version, Answers ("{n} requirements"), Written by (Bot or person; "AI-written" label when `is_ai_generated`), Updated.
- Primary "New draft" menu:
  - "Ask Proposal Writer": dialog with checkboxes for the sections the solicitation asks for (prefilled from the brief's submission facts), and "Draft sections". Each section becomes a draft.
  - "Blank draft": choose a kind and a title.
  - "From the library": choose a boilerplate `library_items` row.
- When AI drafting is off for this bid, "Ask Proposal Writer" is disabled with "AI drafting is off for this bid because the solicitation doesn't allow it."

**States.** `{thing}` = "drafts". Empty: "No drafts yet. Ask Proposal Writer to draft the sections this solicitation asks for, or start one yourself." Buttons "Ask Proposal Writer", "Blank draft".

### 9.9 Draft editor

**Route** `/bids/$dealId/drafts/$draftId` (`?compare={version}&approval={approvalId}`). **Requirements** FR-DRF-1 to FR-DRF-4, FR-BID-6, FR-BID-9, FR-APR-1.

**Layout.**
- Bid header and tabs stay. Below: a sticky toolbar, the page, and a right panel (22.5rem, collapsible).
- **Toolbar:** paragraph style (Normal, Heading 1, Heading 2, Heading 3), Bold, Italic, Underline, Bulleted list, Numbered list, Table, Link, Undo, Redo. Right side: save status ([§22.18](#2218-autosave-for-the-draft-editor)), "Comment", status menu (Draft, In review, Approved), "Export" (Word, PDF), menu (Rename, Save version, Duplicate, Archive).
- **Page:** TipTap editor, max width 51rem, white page on the background color in light mode. Bot-written claims carry inline citation chips (a TipTap `citation` mark rendering [§22.11](#2211-citation-chip)).
- **Line above the page** when `is_ai_generated`: "Written by {Bot}. Check every claim before you submit." (muted).
- **Right panel tabs:**
  - **Requirements:** requirements this draft answers (from `draft_requirement_links`), each a link that scrolls to its anchor; then "Not answered anywhere": required requirements with no link. Button per gap "Ask Proposal Writer to answer" (hidden when AI drafting is off).
  - **Versions:** from `draft_versions` **(requested)**: "Version {n}, {author}, {date time}". Actions per row: Compare with current, Restore. Restore dialog: "Restore version {n}? Magpie saves the current text as a new version first." Button "Restore".
  - **Comments:** threads anchored to selected text (`draft_comments` **(requested)**): author, time, text, replies, "Resolve". Empty: "No comments. Select text and choose Comment."
  - **Rules** (FR-DRF-3): page limit, fonts, file naming, from the brief's submission facts with citation chips. Live checks: "About {n} pages. The limit is {limit}." (needs tone when over), "Font: {font}. The solicitation asks for {font}."
  - **Disclosure** (only when disclosure is required): what `drafts.ai_disclosure` records (models, runs, sections) in plain words, and "Insert disclosure statement".
- **Read-only cases** (banner above the page):

| Case | Copy | Button |
|---|---|---|
| `status` approved or sent | "Approved by {name} on {date}. Make changes in a new version." | Edit as new version |
| A Bot is writing (run running on this draft) | "{Bot} is writing this draft. You can edit when it finishes." | Stop (`run` cancel) |
| Viewer | "You have view access." | none |
| Opened from an approval (`?approval=`) | "You're editing for approval {code}." | Back to approval |

- **Compare** (`?compare=`): inline diff of the chosen version against the current text. Additions underlined in the brand color, removals struck through in the problem color, each with a text label in the gutter ("Added", "Removed"). Buttons "Restore version {n}" and "Exit compare".

**States.** `{thing}` = "draft". Not found: "This draft doesn't exist or was removed."

### 9.10 Timeline tab

**Route** `/bids/$dealId/timeline` (`?type=`). **Requirements** FR-BID-8, FR-CRM-3.

Filter chips: All, Documents, Bot actions, Approvals, Messages, Quotes, Stage changes, Notes, Submissions. Composer at the top: "Add a note" (small TipTap). Items, newest first, from `activities` through `activity_links`: icon by `type`, `summary`, actor (person, Bot linking to the run, contact, system), time. Expanding a row shows details from `payload`: an email's subject and first lines, an approval card link, a stage change as "{from} to {to}", a run link. 25 per page with infinite scroll and a "Load older" button for keyboard users.

`{thing}` = "timeline". Empty: "Nothing here yet. Documents, Bot work, messages and stage changes show up here as they happen."

### 9.11 Mark submitted

Dialog. **Requirements** FR-BID-7.

Title "Mark as submitted". Fields:
- How you submitted (`submissions.method`): Email, Portal, Mail, Hand delivery, Other.
- When (`submitted_at`): date and time, default now, in the bid's timezone.
- Confirmation (`confirmation`): "Confirmation number or email subject" (optional).
- Files: attach the confirmation or the package as sent (`file_links.purpose='submission'`).

Warning line when required requirements are still open: "{n} required items are still open." (does not block). Primary "Mark submitted". Creates the `submissions` row, moves the deal to Submitted, starts the award watch. Toast: "Marked submitted. Magpie will watch for the award notice."

### 9.12 Export package

Dialog. **Requirements** FR-BID-9, FR-DRF-3.

Title "Export bid package". Checklist:
- Approved drafts, one checkbox each. Unapproved drafts are listed disabled with "Approve this draft first."
- Price sheet: the approved version. If none: "Approve a price sheet version first."
- Compliance checklist (requirements with status).
- Attachments: library items picked for this bid (W-9, insurance certificate) and any file the person adds.

Format: "Word and PDF" and "ZIP of everything" (checked). Rule warnings (FR-DRF-3) above the button: "{title} is about {n} pages. The limit is {limit}." File naming line when the solicitation sets one: "Files are named {rule}." Primary "Export". The export runs in the background (`data_exports` with `kind='bid_package'` **(requested)**); the dialog shows "Building your package…" and the person can close it. When ready (`export.updated`), a toast "Your bid package is ready." with "Download", and the download also shows in the dialog.

### 9.13 Deadlines

Shown in the bid's right rail, on Today, in the digest, and in the calendar feed (FR-BID-4).

| `kind` | Label | SMS phrase ([§20](#20-text-messages-sms-and-telegram)) |
|---|---|---|
| `proposal_due` | Proposal due | "proposal is due" |
| `questions_due` | Questions due | "questions are due" |
| `site_visit` | Site visit | "site visit is" |
| `amendment_ack` | Amendment acknowledgment due | "amendment acknowledgment is due" |
| `award_expected` | Award expected | (no reminder) |
| `other` | `label` | "{label} is due" |

Row: label, date and time in the deadline's timezone (`bid_deadlines.timezone` **(requested)**) with its abbreviation, the viewer's local time in parentheses when different, a countdown pill, the citation chip, and "Reminded {72h, 24h, 2h}" from `reminders_sent`.

Add or edit dialog: Kind, Date and time, Timezone (defaults to the bid's), Label (for Other). Note: "Magpie reminds you 72, 24 and 2 hours before." Person-added deadlines have no citation (`citation` is nullable).

## 10. Pipeline and deals

### 10.1 Pipeline

**Route** `/pipeline` (`?pipeline=&view=&layout=board|table|calendar`). **Release** MVP. **Requirements** FR-CRM-2, FR-CRM-5, FR-CRM-7, FR-CRM-8.

**Purpose.** Every deal by stage, in the view you saved.

**Layout.** `h1` "Pipeline". Under it: pipeline select (Bids, Sales, any others), saved view tabs (`saved_views` with `object='deal'`: personal views first, then shared, then "+" to add), layout toggle Board, Table, Calendar, then Filter, Sort, Columns (table only) and the menu with "Export CSV". Primary "New bid" in a bid pipeline, "New deal" in a sale pipeline.

**Board** ([§22.10](#2210-kanban)).
- Columns are `pipeline_stages` by `position`. Header: stage name, count, total of `amount_cents`.
- Columns with category `won`, `lost` or `no_bid` start collapsed to 3rem showing name and count; click expands.
- Card: name (two lines), company, amount, due (with tone), owner avatar, decision chip for bids, "{n} waiting" when approvals are pending, up to two tags.
- Drag a card to another column to change stage (FR-CRM-2). Keyboard and menu paths in [§22.10](#2210-kanban). Moving to a Submitted stage opens Mark submitted; Lost and No bid open their reason dialogs; canceling returns the card. Optimistic move; on failure the card returns and the toast reads "Couldn't move {deal}. It's back in {stage}."

**Table.** Columns: Name, Company, Stage, Amount, Due, Close date, Owner, Decision (bids), Source, Created, Updated, Tags, custom fields. Inline edit for writers. Selecting rows shows the bulk bar (FR-CRM-7): Change stage, Assign owner, Add tag, Archive, Export selected.

**Calendar.** Month grid by `due_at` (bids) or `close_date` (sales), from the view's `date_field`. Click a day to see its deals.

**Saved views** (FR-CRM-5). Changing filters, sort, columns or layout on a saved view shows "Unsaved changes" with "Save view" and "Reset". "Save as new view" asks for a name and the checkbox "Share with the team" (`owner_user_id` null; needs `viewsShare`). Views load in under 1 second for 10,000 records.

**States.** `{thing}` = "pipeline". Empty bid pipeline: "No bids in {pipeline} yet. Pursue a match or add a bid." Empty sale pipeline: "No deals in {pipeline} yet. Add one to start tracking sales."

**Permissions.** Viewers: no drag, no bulk, no inline edit.

### 10.2 Deal record

**Route** `/deals/$dealId`. **Requirements** FR-CRM-1, FR-CRM-3, FR-CRM-4, FR-CRM-10, FR-CH-7.

Record page pattern ([§11.3](#113-record-pages)). Details: name, pipeline, stage, company, primary contact, owner, amount, close date, source, custom fields, tags. Tabs: Timeline, Notes, Tasks, People (`deal_contacts`), Files, History. A deal with `kind='bid'` redirects to `/bids/$dealId/brief`.

## 11. Contacts and companies

### 11.1 Lists

**Routes** `/contacts`, `/companies` (`?view=&kind=&q=`). **Release** MVP. **Requirements** FR-CRM-1, FR-CRM-5, FR-CRM-6, FR-CRM-7, FR-CRM-8, FR-CRM-9.

**Layout.** `h1` "Contacts" or "Companies". Saved view tabs. Primary "New contact" or "New company"; secondary "Import"; menu: Export CSV, Show archived. Text filter, filter builder (field, operator, value), sort, Columns. Companies add kind chips: All, Agencies, Subcontractors, Primes, Customers, Suppliers, Partners, Competitors. Count above the table: "{n} contacts".

**Contacts columns.** Name (`first_name` `last_name`, P1), Company (P1), Title (P2), Email (primary from `emails`, with its status as text: Valid, Risky, Invalid, Not checked; P1), Phone (primary from `phones`, P2), Owner (P3), Tags (P3), Do not contact (pill when `is_do_not_contact`, P2), Last activity (P2), Created (P3).

**Companies columns.** Name (P1), Kinds (pills, P1), UEI (P2), Domain (P2), Phone (P3), City and state (from `address`, P2), Contacts count (P3), Open deals count (P2), Owner (P3), Tags (P3), Created (P3).

**Bulk bar:** Add tag, Assign owner, Archive, Merge (exactly two selected), Export selected. Bulk actions on 1,000 rows finish in under 10 seconds (FR-CRM-7); the bar shows "Updating {n} contacts…" then a toast.

**New contact dialog.** First name, Last name, Company (combobox, can create), Title, Emails (repeatable, primary radio), Phones (repeatable), Owner, Tags. On email blur, a duplicate check: "{name} already has this email." with "Open {name}".

**New company dialog.** Name, Kinds (multi), Website, Phone, UEI (12 letters and digits; "A UEI has 12 letters and numbers."), Address. Duplicate check on UEI and domain: "{name} already has this UEI." with "Open {name}".

**Phone.** Card list: name, second line company or kinds, primary email or phone as a tap-to-call or tap-to-email link.

**States.** `{thing}` = "contacts" or "companies".

| List | Empty copy | Buttons |
|---|---|---|
| Contacts | "No contacts yet. Add one, or import a CSV." | New contact, Import CSV |
| Companies | "No companies yet. Add one, or import a CSV. Agencies from your bids are added for you." | New company, Import CSV |

### 11.2 Import

**Routes** `/contacts/import`, `/companies/import`. **Requirements** FR-CRM-8. Tracked in `imports` **(requested)**.

One page with a four-step indicator.
1. **Upload.** Dropzone for a CSV up to 10 MB or 50,000 rows. Link "Download a sample CSV".
2. **Match columns.** One row per CSV header: header, a field select (standard fields, custom fields, "Don't import"), and the first three values. Auto-matched by name. Required: a name column (contacts: first or last name or email; companies: name).
3. **Duplicates.** Contacts: "Match existing contacts by email." Companies: "Match existing companies by UEI, then domain." Choice: Update existing, Skip, Create new anyway.
4. **Review.** "{new} new, {updates} updates, {errors} rows with errors." Primary "Import".

Progress (from `import.updated`): "Importing {done} of {total} rows." Done: "Imported {n} contacts. {errors} rows had errors." Buttons "Download error report" (CSV of row number and message, for example "Row 14: the email isn't valid.") and "Open contacts". A 10,000-row import finishes in under 2 minutes.

### 11.3 Record pages

**Routes** `/contacts/$contactId`, `/companies/$companyId`, `/deals/$dealId` (`?tab=`). **Requirements** FR-CRM-1, FR-CRM-3, FR-CRM-4, FR-CRM-9, FR-CRM-10, FR-CH-7.

**Layout.**
- Back link to the list.
- **Header:** avatar (initials) or logo, name (`h1`, inline editable), subtitle (contact: "{title} at {company}"; company: kind pills and city). Actions: primary "Ask a Bot" (FR-CH-7), secondary "Add note", "Add task". Menu: Merge with…, Copy link, Archive. Contacts add "Mark do not contact".
- **Two columns** at 64rem and wider: Details (22.5rem) on the left, tabs on the right. Phone: one column with tabs Details, Timeline, Notes, Tasks, More.
- **Details panel:** standard fields, then custom fields (`field_definitions` by `position`), then tags. Each value is inline-editable: click or Enter to edit, Enter or blur to save, Esc to cancel, "Saved" shows for 2 seconds.
  - **Provenance:** a small source icon after values that have `field_provenance`. Hover or focus: "From SAM.gov, Nov 2", "Filled by Sub Finder from {site}, Nov 4", "Imported Nov 1". Links to `source_ref` like a citation chip.
  - **Suggestions** (FR-CRM-4): a pending `field_suggestions` row shows under the field: "{Bot} suggests {value}", the rationale, citation chips, and buttons "Approve" and "Skip".
  - Contacts: emails with label, primary and status; phones; company; owner; switch "Do not contact" (also adds a `suppressions` row with `reason='do_not_contact'`).
  - Companies: kinds, domain, website, phone, address, UEI, CAGE, NAICS codes, owner. Link "Find on SAM.gov" when UEI is set.
- **Tabs:** Timeline (default), Notes, Tasks, Deals (contacts and companies) or People (companies; deals use `deal_contacts`), Files, History.
  - **History** (FR-CRM-10): `record_history` table: When, Who (person; Bot with run link; Import; Automation; API key), Field, From, To.

**Archive** dialog: title "Archive {name}", body "It's hidden from lists. You can restore it from Show archived.", button "Archive". Toast with Undo.

**Merge** dialog (FR-CRM-9): two columns, one per record, with a radio "Keep this one" on top. One row per field that differs, with a radio for which value to keep. Summary: "Notes, tasks, activities and deals from {other} move to {kept}." Primary "Merge". Toast: "Merged into {kept}."

**States.** `{thing}` = "contact", "company" or "deal". Archived banner: "This {contact} is archived." with Restore.

| Tab | Empty copy |
|---|---|
| Notes | "No notes yet. Add one above." |
| Tasks | "No tasks on this {contact}." |
| Deals | "No deals with {name}." |
| People | "No people at {name} yet." Button "Add contact" |
| Files | "No files yet. Drop files here to add them." |
| History | "No changes yet." |

**Permissions.** Viewers read only. Merge and Archive need `recordsWrite`.

## 12. Tasks

**Route** `/tasks` (`?view=&assignee=me|everyone|bots|{userId}&status=open|done|canceled&task=`). **Release** MVP. **Requirements** FR-CRM-1, FR-CRM-5.

**Purpose.** Your to-dos and your team's, by when they're due. Bot work is on Bots and Approvals, not here.

**Layout.** `h1` "Tasks". Saved view tabs (`saved_views` with `object='task'`). Filters: Assignee (Mine by default, Everyone, Bots, a person), Status (Open by default), Priority, Related to (Bids, Deals, Contacts, Companies), Due. Primary "New task".

Quick add row at the top: "Add a task" text input, a due date button, Enter to save.

List grouped by due: Overdue, Today, Tomorrow, This week, Later, No due date. Row: checkbox (done), title, related record chip, due (needs tone today, problem tone overdue), priority ("High" pill; Normal shows nothing; "Low" muted), assignee (person avatar, or Bot icon and name), source ("From {Bot}" when `source='bot'`).

Row click (or `?task=`) opens a side sheet: Title, Notes, Due, Priority, Assignee (people and Bots), Related record, Status. Saves on change.

Checking done is optimistic; toast "Task done." with Undo.

**States.** `{thing}` = "tasks".

| Filter | Empty copy |
|---|---|
| Mine, open | "You have no open tasks." |
| Everyone, open | "No open tasks." |
| Done | "No finished tasks yet." |

**Permissions.** Viewers read only.
## 13. Bots, memory and runs

Bot icons (lucide), used wherever a Bot is named: Assistant `MessageSquare`, Bid Scout `Radar`, Bid Reader `BookOpenText`, Estimator `Calculator`, Sub Finder `HardHat`, Proposal Writer `PenLine`, Deadline Keeper `CalendarClock`, Follow-up `Repeat`. The icon sits in a rounded tile with the muted fill. Bots have no faces or avatars.

### 13.1 Bots: Team and Runs

**Routes** `/bots` (Team) and `/bots/runs` (Runs). **Release** MVP. **Requirements** FR-BOT-1, FR-BOT-7.

**Layout.** `h1` "Bots". Description: "Your Bot team. Each one does part of the bid work and asks before anything leaves your business." Tabs: Team, Runs, Memory.

**Team.** One row per `bots` row, in seed order:

| Part | Content |
|---|---|
| Media | Bot icon |
| Title | `name` |
| Description | `role_description` (one line) |
| Facts | "Last run {relative}, {status}" · "{n} runs this month" · "Cost this month {money}" (`costsView` only) · "{n} waiting for you" when approvals are pending |
| Control | Switch `is_enabled` (`botsManage`) |

Row click opens the Bot page. Turning a Bot off asks: title "Turn off {name}", body "Its jobs stop until you turn it back on. Nothing else changes.", button "Turn off" (FR-BOT-1). Turning on needs no confirmation.

**Runs.** All runs, newest first: the runs table from [§13.3](#133-bot-page) with an extra Bot column. Filters: Bot, Status, Trigger, Date.

**States.** `{thing}` = "Bots" or "runs". Runs empty: "No runs yet. Bots run on their jobs, or when you ask them something."

**Permissions.** Switches disabled without `botsManage`. Cost hidden without `costsView`.

### 13.2 Memory

**Route** `/bots/memory`. **Release** MVP. **Requirements** FR-BOT-8.

**Layout.** Description: "All Bots read these before they work. Delete anything that's wrong." Filters: About (The business, You), Kind (Fact, Preference, Instruction), Needs review. Text filter. Primary "Add memory".

Rows (`memories`): `text`, kind pill, scope ("About the business" when `user_id` is null, else "About you"), source ("From a chat on {date}" linking to `source_run_id`, or "Added by {name}"), and menu Edit, Delete. Unconfirmed rows (`is_confirmed=false`) show "A Bot learned this. Keep it?" with "Keep" and "Delete".

Add and edit dialog: Memory (text), Kind, About (The business, Only me). Button "Save memory".

Delete dialog: title "Delete this memory", body "Bots stop using it on their next run.", button "Delete memory".

**States.** `{thing}` = "memory". Empty: "Nothing remembered yet. Tell any Bot something like "we don't work in DC" and it shows up here."

**Permissions.** `memoriesManage`: owners and admins edit everything; members add and edit their own and business memories they added; viewers read.

### 13.3 Bot page

**Route** `/bots/$botId/{jobs|tools|runs|settings}`. **Release** MVP. **Requirements** FR-BOT-1 to FR-BOT-9.

**Header.** Bot icon, `name` (`h1`), `role_description`, switch On or Off, primary "Chat with {name}" (opens the Assistant panel on this Bot). Tabs: Jobs, Tools, Runs, Settings. A link "Memory" goes to `/bots/memory`.

**Jobs** (FR-BOT-5, FR-BOT-6). One row per `bot_jobs` row:

| Part | Content |
|---|---|
| Title | `name` |
| Description | Schedule in words, from `schedule_cron` in the workspace timezone: "Every 4 hours, Monday to Friday", "Every day at 7:00 AM", "When a deadline is 72, 24 and 2 hours away" (event-driven). Then "Next: {next_run_at}" and "Last: {last_run_at}, {status}" linking to the run. |
| Pills | "Learning mode" when `is_learning_mode` **(requested)** |
| Control | Switch `is_enabled` |

Row click opens "Edit job": Schedule (Every {n} hours, Every day at {time}, Every week on {days} at {time}; days as checkboxes), switch "Learning mode" with "The Bot runs and tells you what it would have done. It doesn't change anything.", and kind-specific settings (scan: which saved searches; quote follow-ups: number of follow-ups, default 2, and days between them). Button "Save job". The digest job reads "Uses each person's digest time." with a link to Channels and alerts, and has no time field. Row menu: Run now (toast "{Bot} is running {job}."), Turn off.

Empty: "No jobs. This Bot works when you ask it in chat or from a record."

**Tools** (FR-BOT-3, FR-BOT-4). Two sections from the tool catalog (`GET /api/app/tools`, labels and effects from AGENT_RUNTIME.md) and `tool_policies`:

1. **Reaches people outside your business** (`effect='external'`). Rows: tool label, one-line description, a lock icon and "Always asks". Section description: "Magpie never sends anything outside your business without your yes." Counter line: "Approved {approved_unchanged + approved_edited} times, {approved_unchanged} unchanged." Not editable by anyone.
2. **Inside Magpie** (`effect='internal'`). Rows: tool label, description, select with "Do without asking" (`always_allow`), "Ask first" (`needs_approval`), "Off" (`off`). Counter line: "{n} approved in a row without changes." A row without a Bot-specific policy shows "Workspace default" next to the select.

**Earned autonomy** (FR-BOT-4). When `promotion_suggested_at` is set and the policy is still `needs_approval`, the row shows a callout: "You approved {Bot}'s last 10 {tool label} without changes. Let it do this without asking?" Buttons "Do without asking" and "Keep asking". Shown once per tool per Bot; "Keep asking" hides it for good. Changing any policy to "Do without asking" confirms: title "{Bot} will {tool label} without asking", body "You can change this anytime. Every change is logged.", button "Allow". Each change writes `audit_log`.

**Runs** (FR-BOT-7, FR-BOT-9). Cost summary at the top for `costsView`: "This month: {n} runs, {money}." Table:

| Column | Source |
|---|---|
| Started | `started_at` |
| Trigger | Chat, Job: {name}, Event, Automation, API, After approval |
| Summary | `output_summary` |
| Status | pill |
| Steps | `steps` |
| Waiting | approvals in `pending` for this run |
| Cost | `cost_micros` as money (`costsView`) |
| Duration | `finished_at` minus `started_at` |

Row opens the run. Empty: "No runs yet. This Bot runs on its jobs, or when you ask it something."

**Settings.** Name (`name`), Instructions (`instructions`, textarea; placeholder "Example: Always add 12% overhead to labor."), AI level (`model_tier`: Fast, Standard, Deep, with "Deep costs more per run."; owners and admins only), switch "On". Button "Save".

**States.** `{thing}` = "Bot", "jobs", "tools" or "runs".

**Permissions.** Without `botsManage`, every control is read-only with the owner-or-admin tooltip, and the Tools tab shows "Only owners and admins can change what Bots may do."

### 13.4 Run detail

**Route** `/runs/$runId`. **Release** MVP. **Requirements** FR-BOT-5, FR-BOT-7, FR-BOT-9.

**Layout.**
- **Header:** Bot icon and name, "Run started {date time}", status pill. Trigger line: "Started by the job {name}", "From your chat" (thread link), "After you approved {code}", "From an automation", "From the API". Button "Stop run" while `status` is `queued`, `running` or `waiting_approval`: dialog "Stop this run?", body "The Bot stops after its current step. Approvals it's waiting on are canceled.", button "Stop run".
- **Learning mode** banner when `is_learning_mode`: "Learning mode. The Bot reported what it would have done and changed nothing."
- **Summary:** `output_summary`, or the mapped error:

| `status` or `error.code` | Copy |
|---|---|
| `limit_reached`, step cap | "Stopped at the limit of {n} steps for one run. Ask again to continue." |
| `limit_reached`, cost cap | "Stopped at the cost limit for one run. Ask again to continue." |
| `limit_reached`, monthly allowance | "Stopped because your workspace used this month's Bot runs." |
| `model_unavailable` | "Stopped because the AI providers this needs are turned off for this workspace." |
| `ai_drafting_not_allowed` | "Stopped because this solicitation doesn't allow AI drafting." |
| `failed`, other | "This run failed. {plain message}." |
| `canceled` | "Stopped by {name} at {time}." |

- **Facts:** Steps, AI calls (`model_calls`), Duration, Cost (`costsView`). Switch "Show details" (owners and admins) reveals tokens in, cached and out.
- **Steps** (`agent_steps` by `seq`), one line each in plain words:
  - `tool_call`: tool label and a short argument summary ("Searched bids: janitorial, VA"). In learning mode: "Would have: {tool label}".
  - `tool_result`: a short result ("Found 6 notices").
  - `approval_wait`: compact approval card link with its status.
  - `model_call`: hidden unless "Show details"; then "Thought about the next step" with provider, model, tokens, cost and latency.
  - `note`: the note text.
  - A step with `error` shows in the problem tone.
  - With "Show details", each step expands to `args` and `result` as formatted JSON with a Copy button.
- **Related:** approvals created, records touched (links), thread link.
- While running, new steps append live (`run.updated`) and a status line reads "Working…".

**States.** `{thing}` = "run". Not found: "This run doesn't exist or was removed."

**Permissions.** Everyone with access sees steps in plain words. Model, tokens, cost and raw arguments need `costsView`.

## 14. Approvals

### 14.1 Inbox

**Route** `/approvals` (`?tab=waiting|decided&effect=external|internal&bot=&for=me|everyone&record=`). **Release** MVP. **Requirements** FR-APR-1 to FR-APR-5, FR-OPS-5.

**Purpose.** Decide what Bots want to do, oldest first.

**Layout.** Desktop: list (26rem) on the left, the selected approval on the right; selecting updates the URL to `/approvals/$approvalId`. Phone: the list, then the approval as its own page.

- `h1` "Approvals". Tabs: Waiting ({n}), Decided.
- Filters: Effect (All, Outside your business, Inside Magpie), Bot, For (Me, Everyone; Everyone needs `approvalsDecideAny`), Bid or record.
- Managed plan line (plan feature `managedReview`): "{n} more are with your Magpie reviewer." These are approvals with `review_stage='staff'` for me (FR-OPS-5).

**List item.** Short code pill ("A7"), `title`, Bot name, effect pill, related record name, "Waiting {age}", expiry ("Expires in {relative}"; needs tone under 24 hours; "Expires at the deadline, {date time}" for deadline-bound ones). Oldest first (FR-APR-3).

**Bulk** (FR-APR-3). Checkboxes appear only on internal items. Selecting shows a bar: "{n} selected", "Approve {n}", "Skip {n}". Select all selects internal items only and the bar adds: "Approvals that reach people outside your business are approved one at a time."

**Keyboard** (only while the list has focus, [§24](#24-accessibility)): Up and Down or J and K move, Enter opens, A approves an internal item (for an external item it moves focus to the card's Approve button), S skips, E edits.

**Decided tab.** Rows with status pill, "{name} {via}" ("Dana, by text", "on the web", "in Telegram", "through the API"; `decided_via`), and `decided_at`. Filter by status.

**States.** `{thing}` = "approvals".

| Tab | Empty copy |
|---|---|
| Waiting | "Nothing is waiting for you. When a Bot needs your yes, it shows up here and on your phone." |
| Decided | "No decisions yet." |

When the list empties after a decision, the detail pane shows the Waiting empty copy.

**Permissions.** Viewers see the inbox read-only, with "You can view this but can't approve." in each card.

### 14.2 Approval detail

**Route** `/approvals/$approvalId`. Renders the full approval card ([§22.12](#2212-approval-card)) with the preview for its kind ([§14.3](#143-preview-kinds)). After a decision on desktop, the next waiting item opens.

**Toasts after a decision:**

| Decision | Copy |
|---|---|
| Approve, external | "Approved {code}. {Bot} is sending it now." |
| Approve, internal | "Approved {code}." |
| Approve with edits | "Approved {code} with your changes." |
| Skip, external | "Skipped {code}. Nothing was sent." |
| Skip, internal | "Skipped {code}." |
| Bulk | "Approved {n}." or "Skipped {n}." |

No Undo: the run resumes within 5 seconds (FR-APR-2).

**Earned autonomy.** When the decision response carries `promotionSuggested` and the person has `botsManage`, the decided card shows the suggestion callout from [§13.3](#133-bot-page).

**Decided card footer** (FR-APR-5): "Approved by {name} {via} on {date} at {time}." "Approved with changes by {name}…" (with "See changes": a before and after of `args` and `edited_args`). "Skipped by {name}…". "Expired on {date}. The Bot went on without it." (link to the run, FR-APR-4). "Canceled because {reason}."

### 14.3 Preview kinds

`approvals.preview` is validated by the zod schema `ApprovalPreview` in `packages/shared` **(requested shape)**. Every kind shares `why: string` (shown as "Why: {why}") and `sources: Citation[]` (shown as citation chips under "Sources"). Edits produce `edited_args`.

**email**

| Field | Shape |
|---|---|
| `from` | `{ name, address, via: 'gmail' \| 'graph' \| 'postmark' }` |
| `to`, `cc` | `[{ name, address, isSuppressed }]` |
| `subject` | string |
| `bodyHtml`, `bodyText` | sanitized HTML and plain text |
| `attachments` | `[{ fileId, filename, sizeBytes }]` |
| `footer` | `{ postalAddress, hasUnsubscribe }` |
| `followUp` | `{ number, of }` or null |
| `quoteRequestId`, `dealId` | uuid or null |

Render: "From: {name} <{address}>" with "(your Gmail)", "(your Outlook)" or "(sent by Magpie with your name)". To, Cc, Subject. Body in a bordered letter area with "Show all" past 24rem. Attachment chips (open on click). Footer in muted text: "Added to every outreach email: {postalAddress}. Unsubscribe link." Note: "Replies come back to this bid and to your inbox." Follow-ups show "Follow-up {number} of {of}".

Blocks (Approve disabled):
- A recipient with `isSuppressed`: "{address} unsubscribed or bounced. Remove them to send."
- Missing postal address: "Add your postal address in Settings before sending outreach." Button "Open settings".

Edit form: To and Cc (chips; adding a suppressed address shows the block inline), Subject, Body (TipTap, simple marks only), Attachments (remove, or add from bid documents).

**sms**

| Field | Shape |
|---|---|
| `to` | `{ userId, name, e164 }` (only people in this workspace, PRD §7) |
| `body` | string |
| `segments` | number |

Render: a phone-style bubble, "To {name}, {formatted number}", and "{chars} characters, {segments} texts". Edit: textarea with a live counter; when a character forces UCS-2: "Curly quotes and some symbols make this text longer."

**record_change**

| Field | Shape |
|---|---|
| `operation` | `'create' \| 'update' \| 'archive'` |
| `recordType`, `recordId` | as DATA_MODEL polymorphic links; `recordId` null on create |
| `recordLabel` | string |
| `changes` | `[{ field, label, before, after, fieldType }]` |

Render: heading "Create {record type label}", "Update {recordLabel}" or "Archive {recordLabel}", linking to the record. Table Field, Now, After (create: Field, Value). Changed cells carry the text "Changed" for screen readers and a brand-soft background. Edit: each After cell becomes the editor for its `fieldType`.

**stage_change**

| Field | Shape |
|---|---|
| `dealId`, `dealName`, `pipelineName` | |
| `from`, `to` | `{ stageId, name, category }` |
| `reason` | string or null |
| `effects` | string[] |

Render: deal name, "{from} pill, arrow icon, {to} pill" (the arrow has the accessible name "to"), reason, and effects as bullets ("This starts the award watch."). Edit: To stage select and Reason.

**document**

| Field | Shape |
|---|---|
| `draftId`, `title`, `draftKind`, `version` | |
| `pageEstimate` | number |
| `excerpt` | first 600 characters of `content_text` |
| `isAiGenerated`, `disclosureRequired` | boolean |
| `files` | `[{ fileId, filename }]` for packages |

Render: title, kind, "Version {n}", "About {n} pages", the excerpt, "AI-written" label when true, and "Open full document" (opens the draft editor with `?approval=`). Edit: "Edit in editor" goes to the draft editor; approving afterwards uses the newest version, recorded in `edited_args.version`.

## 15. Chat

### 15.1 Assistant panel

**Where** Docked right on desktop, a right sheet on tablet. **Release** MVP. **Requirements** FR-CH-6, FR-CH-7.

**Layout.**
- **Header:** Bot picker (enabled Bots; default the Assistant), thread title (from `threads.title`, set from the first message), icon buttons "History", "New chat", "Open full page", "Close".
- **Context chip** under the header when the thread has `record_type` and `record_id`: "About: {record name}". Before the first message it has a remove button.
- **Messages** (`thread_messages`):
  - `user`: right-aligned bubble with the muted fill.
  - `assistant`: left-aligned plain text, no bubble. Markdown: paragraphs, lists, tables, links. Citation chips inline.
  - `tool`: one collapsed line with an icon: "Searched bids", "Read 2 documents", "Created a task: Call ABC Cleaning" (link). Expands to a short result.
  - Approval requests: inline approval card ([§22.12](#2212-approval-card)), preview collapsed to 8 lines with "Show all".
  - `notice`: centered muted line ("This answer stopped at the step limit for one run.").
- **Composer:** textarea growing from 1 to 8 lines. Placeholder "Ask {Bot} anything, or tell it what to do". Enter sends, Shift Enter adds a line. Send button becomes "Stop" while streaming. Typing "@" at the start opens the Bot picker; choosing a Bot starts a new thread with it.
- Thinking indicator after send until the first token: "{Bot} is thinking" (dots animate unless reduced motion is on). First token under 2.5 seconds p95.

**Empty thread.** "Ask about your bids, deadlines and contacts, or tell a Bot what to do." Three suggestion chips. With no record: "What's due this week?", "Find janitorial bids in Virginia", "Which quotes are still out?" On a bid: "What's still missing on this bid?", "Summarize the brief", "Draft a quote request". On a contact or company: "What do we know about {name}?", "Add a follow-up task", "Find their past awards".

**Errors.**

| Case | Copy | Button |
|---|---|---|
| Stream failed | "The reply stopped. Try again." (under the message) | Try again |
| Step or cost cap | Notice: "This answer hit the limit for one run. Ask again to continue." | none |
| `model_unavailable` | Problem code copy | none |
| Offline | Composer disabled: "You're offline." | none |

**History.** Threads for me, newest first: title, Bot, channel icon (web, Telegram, text), last message time. Search field "Search chats".

### 15.2 Full-page chat

**Routes** `/chat`, `/chat/$threadId`. **Release** MVP. **Requirements** FR-CH-6.

Desktop: thread list (19rem) on the left, conversation (max 47.5rem) in the center. Phone: the list, then the thread. Telegram and text threads appear with a "From Telegram" or "From texts" label; the web composer can continue them on the web. Empty list: "No chats yet. Ask the Assistant anything to start one." Button "New chat". `{thing}` = "chats" or "chat".

**Data.** Thread list `["threads","list"]`. Messages load from `["threads","messages",threadId]` as the initial state of AI SDK `useChat`, which streams from `POST /api/app/threads/$threadId/messages` ([§23.1](#231-structure-and-rules)).

## 16. Notifications

**Where** Bell popover (desktop), `/notifications` (all sizes). **Release** MVP. **Requirements** FR-CH-8.

**Popover.** Header "Notifications" and the button "Mark all as read". Up to 20 rows of `notifications` with `channel='in_app'`, newest first: icon by `kind`, `payload.title`, one line of `payload.body`, relative time, unread dot when `read_at` is null. Click opens `payload.url` and marks it read. Footer link "See all".

**Page.** Same rows with filters All and Unread, grouped Today, Yesterday, Earlier, infinite scroll.

| `kind` | Icon | Example title |
|---|---|---|
| `digest` | `Sunrise` | "Your morning digest" |
| `approval` | `Stamp` | "Sub Finder needs your yes" |
| `deadline` | `CalendarClock` | "Fort Lee grounds proposal is due in 24 hours" |
| `quote_received` | `Inbox` | "Green Lawn quoted $18,400" |
| `run_finished` | `CircleCheck` | "Bid Reader finished the brief for Fort Lee grounds" |
| `alert` | `TriangleAlert` | "Your workspace used 80% of this month's Bot runs" |
| `billing` | `CreditCard` | "Your last payment didn't go through" |
| `system` | `Info` | "Texts are off for (804) 555-0123 because you replied STOP" |

**States.** `{thing}` = "notifications". Empty: "No notifications yet." Unread filter empty: "No unread notifications."

Live: `notification.created` adds rows and the bell dot. An arriving approval notification also shows a toast when the person isn't on Approvals: "{Bot} needs your yes: {title}" with "Review".
## 17. Settings

**Frame.** `/settings/*`. Desktop: a sub-navigation column (14rem) and the page. Phone: `/settings` is a list of the pages below; each opens as its own page. Pages use the settings layout: `h1`, a description, then sections (`h2`) of rows inside one bordered card per section. Row kinds, as in the current product:
- **Switch row:** takes effect at once, no Save. The description states the result in the present tense.
- **Summary row:** shows the current value and a chevron; opens a dialog to edit. Use it for anything with more than one input.
- **Read-only row:** the value, no chevron.

Content width 48rem (`max-w-3xl`). Tables (Audit log, People, API keys, Usage) use the full width.

| Group | Page | Route | Who sees it |
|---|---|---|---|
| You | Your account | `/settings/account` | everyone |
| You | Channels and alerts | `/settings/channels` | everyone |
| You | API keys (v1) | `/settings/api-keys` | everyone (`apiKeysCreate`) |
| Your business | Company profile | `/settings/company` | everyone; edit `profileManage` |
| Your business | Past performance | `/settings/past-performance` | everyone; edit `recordsWrite` |
| Your business | Library | `/settings/library` | everyone; edit `recordsWrite` |
| Workspace | General | `/settings/workspace` | `settingsManage` |
| Workspace | People | `/settings/people` | everyone; edit `membersManage` |
| Workspace | Pipelines | `/settings/pipelines` | `settingsManage` |
| Workspace | Fields and tags | `/settings/fields` | `settingsManage` |
| Workspace | Connections | `/settings/connections` | everyone (own mailbox); workspace services `settingsManage` |
| Workspace | Billing | `/settings/billing` | `billingManage` |
| Workspace | Usage | `/settings/usage` | `billingManage` |
| Workspace | Automations (v1) | `/settings/automations` | `automationsManage` |
| Workspace | Webhooks (v1) | `/settings/webhooks` | `automationsManage` |
| Owner | Audit log | `/settings/audit` | `auditView` |
| Owner | Data and deletion | `/settings/data` | `dataExport` |

Every change on a Workspace or Owner page writes `audit_log` (FR-SET-1).

### 17.1 Your account

**Route** `/settings/account`. **Requirements** FR-ACC-6, FR-BID-4.

| Section | Rows |
|---|---|
| Profile | Name (`users.name`), Email (change sends a confirmation to the new address: "We sent a link to {email}. Your email changes when you open it."), Photo (`users.image`), Timezone (`users.timezone`, searchable select), Language (read-only "English (US)" until more locales ship; `users.locale` **(requested)**) |
| Sign-in | Password ("Change password" dialog: Current password, New password; Google-only people see "Set a password"), Google and Microsoft sign-in (Connected or Connect) |
| Calendar | "Add your bid deadlines to your calendar." Buttons "Copy calendar link" and "Reset link" (`calendar_feeds` **(requested)**). Reset dialog: "Reset your calendar link? Calendars using the old link stop updating." |
| Preferences | Theme (System, Light, Dark; stored in `localStorage`), switch "Single-key shortcuts" ("Keys like A and S work in lists. Turn off if they get in your way.") |
| Devices | Sessions: device and browser ("Chrome on Mac"), "Last active {relative}", "This device" tag. Button "Sign out of all devices": dialog "Sign out of all devices?", body "You'll need to sign in again everywhere, including here.", button "Sign out everywhere" (FR-ACC-6) |

`{thing}` = "your account".

### 17.2 Channels and alerts

**Route** `/settings/channels`. **Requirements** FR-CH-1, FR-CH-2, FR-CH-3, FR-CH-5, FR-CH-8, FR-BIL-4.

Per person. Preferences live in `notification_preferences` **(requested)**; bindings in `channel_bindings`.

| Section | Rows |
|---|---|
| Text messages (SMS) | Number and status: "Connected", "Off. You replied STOP." (`is_enabled=false`; text "Reply START from your phone, or connect again here."), "Not verified". Buttons: Connect a number, Change number, Disconnect. The verify flow is the one in [§6.6](#66-step-5-phone). Disconnect dialog: "Disconnect {number}? Magpie stops texting it. Your digest comes by email." |
| Telegram | Status "Connected as {label}" (`channel_bindings.label` **(requested)**). Buttons: Connect Telegram (deep link and QR code, [§6.6](#66-step-5-phone)), Disconnect. |
| Notifications on this device | Switch "Get notifications in this browser" (asks the browser, [§25.4](#254-web-push)). List of other devices with web push: label, added date, Remove. |
| Email | Read-only row: "Always on. Sent to {email}." |
| Morning digest | Switch "Send my morning digest" (`is_digest_enabled`). Time (`digest_hour`; default is the workspace's). Days (`digest_days`: Weekdays or Every day). Send by: checkboxes Text, Telegram, Email (`channels.digest`). |
| What goes where | Table, one row per kind: Approvals, Deadline reminders, Quotes received, Bot runs finished, Usage and billing alerts. Columns Text, Telegram, Push, Email, In app. In app is always checked and disabled. Saves on change. |
| Quiet hours | "Hold texts from {start} to {end}." Two time selects; default from the workspace (`quiet_hours`). Note: "Deadline reminders due within 2 hours still come through." (FR-CH-5) |

Defaults for "What goes where":

| Kind | Default channels |
|---|---|
| Approvals | Text or Telegram (whichever is connected), Push, In app; Email when neither phone channel is connected |
| Deadline reminders | Text or Telegram, Email, In app |
| Quotes received | Push, Email, In app |
| Bot runs finished | In app |
| Usage and billing alerts | Email, In app; Text at 100% and 120% |

`{thing}` = "your channels".

### 17.3 Company profile

**Route** `/settings/company`. **Requirements** FR-PRO-2, FR-PRO-3, FR-PRO-6.

Summary rows that open dialogs. Each value prefilled from SAM.gov shows "From SAM.gov" (`field_provenance`).

| Section | Rows (columns of `company_profiles`) |
|---|---|
| Business | Legal name and DBA, UEI and CAGE, Website and phone, Base address. Button "Refresh from SAM.gov" ("Refreshing…"; toast "Updated {n} fields from SAM.gov.") |
| SAM registration | Status and expiry (`sam_status`, `sam_expires_on`), read-only, with the FR-PRO-6 warning when it applies |
| What you do | NAICS codes, PSC codes, Trades you do yourself, Capabilities, Differentiators |
| Where you work | Service area summary |
| Certifications | List |
| Size and limits | Employees, Revenue band (`annual_revenue_band`), Contract size range |
| Bonding | Single and aggregate limits, surety |
| Insurance | General liability, auto, workers' comp, umbrella |
| Labor rates | Table in the dialog: Role, Hourly rate, Burden %, with Add row and Remove. Description: "Estimator prices labor from these rates and the wage determination." |
| Capability statement | File (`capability_statement_file_id`): Upload, Replace, Download |

Validation: NAICS codes against the NAICS list (FR-PRO-3): "{code} isn't a NAICS code." `{thing}` = "company profile".

### 17.4 Past performance

**Route** `/settings/past-performance`. **Requirements** FR-PRO-4, FR-DRF-1, FR-DRF-4.

Table (`past_performance`): Title, Customer, Contract number, Value, Period ("{start_on} to {end_on}"), NAICS, Reference ("Can list" when `is_reference_allowed`). Primary "Add past performance". Dialog fields: Title, Customer (agency or company), Contract number, Value, Start, End, NAICS, What you did (`description`), Reference contact (name, title, email, phone), switch "OK to list this customer as a reference".

`{thing}` = "past performance". Empty: "No past performance yet. Add contracts you've done so Proposal Writer can cite them." Button "Add past performance".

### 17.5 Library

**Route** `/settings/library` (`?kind=`). **Requirements** FR-PRO-4.

Tabs by `library_items.kind`: All, Boilerplate, Resumes, Certificates, Insurance certificates, W-9, Licenses, Reference letters, Other. Rows: title, kind, expiry ("Expires {date}" needs tone within 30 days; "Expired {date}" problem tone), file, updated. Primary "Add to library". Dialog: Kind, Title, then Text (TipTap, for boilerplate) or File (upload), and Expires on (optional; shown first for certificates, insurance and licenses).

`{thing}` = "library". Empty: "Your library is empty. Add boilerplate and documents Bots can reuse in bids, like your W-9 and insurance certificate."

### 17.6 Workspace general

**Route** `/settings/workspace`. **Requirements** FR-SET-1, FR-BID-6, FR-APR-4, FR-CH-5, FR-PRC-4.

| Section | Row | Kind | Source |
|---|---|---|---|
| Workspace | Name | summary | `tenants.name` |
| | Logo | summary | `tenants.logo` |
| | Timezone | summary | `tenants.timezone` |
| Messages | Default digest time | summary | `tenant_settings.digest_hour` ("People can change their own in Channels and alerts.") |
| | Quiet hours | summary | `quiet_hours` |
| Outreach | Postal address | summary | `outreach_footer` ("Every outreach email includes this address and an unsubscribe link. US law requires it.") |
| Approvals | Approvals expire after | summary | `approval_expiry_hours`: 1, 2, 3, 5 or 7 days ("Deadline-bound approvals expire at the deadline.") |
| AI | AI drafting | switch | `ai_drafting_allowed`. On: "Bots can draft proposal text. Bids whose solicitation bans AI stay off." Off: "Bots don't draft proposal text for any bid." |
| | AI providers | summary | `model_policy.excludedProviders`. Dialog: switches Anthropic, OpenAI, Google. "Bots skip providers you turn off. If every provider a task needs is off, that task stops." Warning when a tier would be left empty: "With these settings, {feature} can't run." |
| Pricing | Margin floor | summary | `tenant_settings.margin_floor_bps` **(requested)**: "Estimator warns when a price sheet's margin is below this." |

`{thing}` = "workspace settings".

### 17.7 People and roles

**Route** `/settings/people`. **Requirements** FR-ACC-2, FR-ACC-4, FR-SET-3.

Seat line: "{n} of {limit} people on your plan."

**Members table:** Name, Email, Role (select; the owner row shows "Owner" and no select), Title (`memberships.title`), Joined. Row menu: Change role, Remove from workspace. Remove dialog: title "Remove {name}", body "They lose access to {workspace} right away. Their records stay.", button "Remove".

**Invitations table:** Email, Role, Invited by, Expires, Status. Row menu: Resend, Cancel invite.

**Invite people** (primary): Emails (several, separated by commas or new lines), Role with descriptions:

| Role | Description |
|---|---|
| Admin | "Manages settings, people, billing and Bots." |
| Member | "Works on bids and records. Approves what their Bots ask." |
| Viewer | "Sees everything. Can't change anything." |

Button "Send invites". Toast: "Sent {n} invites. They expire in 7 days." Errors: `seat_limit`; "{email} is already in this workspace."

`{thing}` = "people". Viewers and members see the table without controls.

### 17.8 Pipelines

**Route** `/settings/pipelines`. **Requirements** FR-CRM-2.

One card per pipeline (`pipelines`): name, kind (Bids or Sales), "Default" tag, and its stages (`pipeline_stages`) as rows: drag handle plus "Move up" and "Move down", Name, Category (Open, Submitted, Won, Lost, No bid), Probability %, Delete. "Add stage" under the rows. Deleting a stage with deals asks "Move its {n} deals to" with a stage select, then "Delete stage". "New pipeline" asks Name and Kind and seeds stages from the default of that kind. Saves on change.

### 17.9 Fields and tags

**Route** `/settings/fields` (`?object=company|contact|deal|tags`). **Requirements** FR-CRM-4, FR-CRM-7.

Tabs: Companies, Contacts, Deals, Tags.

**Fields table** (`field_definitions`): Label, Key, Type, Required, Bots fill (Off, Suggest, Auto), with drag and Move up and down for `position`. Primary "New field". Dialog:
- Label; Key (generated from the label, editable until saved).
- Type: Text, Long text, Number, Money, Date, Date and time, Yes or no, Select, Multi-select, Email, Phone, Link, Rating, Record link.
- Options for Select and Multi-select (choices editor) and Record link (target: Company, Contact, Deal).
- Switch "Required".
- "Bots fill this": Off; "Suggest a value for a person to approve" (`suggest`); "Fill it in" (`auto`).
- "Instructions for Bots" (`ai_instructions`), shown unless Off. Placeholder: "Example: The prime's CAGE code from SAM.gov."

Row menu: Edit, Archive ("Archive {label}? It's hidden from records. Values are kept.").

**Tags** (`tags`): Name, Color (named palette: gray, blue, teal, green, amber, red, violet), used on {n} records, menu Rename and Delete ("Delete {name}? It's removed from {n} records.").

### 17.10 Connections

**Route** `/settings/connections`. **Requirements** FR-SET-2, FR-SUB-2. This is an admin screen for the second section and may say "API key".

**Your mailbox** (everyone; `connections` with `user_id` = me, `purpose='send_email'`):

| Provider | States |
|---|---|
| Gmail (`google`) | "Connected as {account_label}" (done), "Needs reconnecting" (needs; `status` expired or error, with `last_error` mapped to "Google stopped Magpie's access."), "Not connected" |
| Outlook (`microsoft`) | same |

Description: "Quote requests go out from Magpie's address with your name, and replies come back to the bid. Connect your mailbox to send from your own address." Buttons: Connect, Reconnect, Disconnect. Disconnect dialog: "Disconnect {provider}? Outreach will go out from Magpie's address with your name. Magpie deletes its access to your mailbox." Button "Disconnect".

**Workspace services** (`settingsManage`; workspace-wide connections, `user_id` null):

| Service | Provider | Purpose |
|---|---|---|
| Email checks | MillionVerifier (`millionverifier`) | `verification` |
| Contact lookup | Hunter (`hunter`), LeadMagic (`leadmagic`) | `enrichment` |

Rows: "Using your API key, added {date}" or "Not set up". Buttons: "Add API key" (dialog with a password-type field: "Magpie stores the key encrypted and never shows it again."; button "Save key"), "Remove key".

`{thing}` = "connections".

### 17.11 Billing

**Routes** `/settings/billing`, `/settings/billing/cancel`. **Requirements** FR-BIL-1, FR-BIL-2, FR-BIL-5, FR-BIL-6, FR-BIL-7.

**Current plan card.** Plan name (`plans.name`), price, status pill, and one line by state: "Trial ends {date} ({n} days left)", "Renews {current_period_end}", "Ends {cancel_at}", "Payment failed on {date}". Buttons by state:

| State | Primary | Secondary |
|---|---|---|
| Trial | Choose a plan (Stripe Checkout) | none |
| Active | Manage billing (Stripe Customer Portal) | Change plan, Buy a run pack |
| Past due or read-only | Update card (Customer Portal) | none |
| Canceled, period not ended | Resume plan | Manage billing |

**Plans** (section or dialog from "Change plan"). Columns from `plans` where `is_public`: name, price, people, Bot runs, document pages, saved searches, texts, notes. "Current plan" tag. Button per other plan: "Switch to {name}". Copy under the table: "Month to month. Cancel in the app anytime."

**Run packs** (FR-BIL-5). "Buy a run pack" dialog: "Buy a run pack for $150? It adds 1,000 Bot runs and 2,500 document pages to this period. Your card on file is charged." Button "Buy run pack" ("Buying…"). Success toast: "Run pack added. You have {n} Bot runs left this period." Packs bought this period are listed under the plan card.

**Cancel** (`billingCancel`, FR-BIL-7). Link "Cancel plan" opens `/settings/billing/cancel`, one screen:
- `h1` "Cancel your plan"
- "You keep full access until {current_period_end}. After that your workspace is read-only, and your data is kept for {retention_days} days. You can export everything anytime." (Days from BILLING.md.)
- Optional reason, radio: Too expensive, Not finding enough bids, Missing something I need, Switching to another tool, Other (text).
- Buttons: destructive "Cancel plan", secondary "Keep my plan".
- No discounts, no extra steps. After: banner on Billing "Your plan ends on {date}." with "Resume plan".

`{thing}` = "billing".

### 17.12 Usage

**Route** `/settings/usage` (`?period=`). **Requirements** FR-BIL-3, FR-BIL-4, FR-BOT-7.

Period select (current, previous periods). One meter per metered entitlement (keys from BILLING.md, numbers from `usage_counters`):

| Meter | Unit text |
|---|---|
| Bot runs (`ai_runs`) | "{used} of {limit} Bot runs" |
| Document pages (`doc_pages`) | "{used} of {limit} pages read" |
| Texts (`sms_segments`) | "{used} of {limit} texts" |
| Saved searches | "{used} of {limit} saved searches" |
| People | "{used} of {limit} people" |

Each meter: a bar with marks at 80%, 100% and 120%, and a state line: "Bots keep working past 100%." or at 120% "Scheduled jobs are paused until {reset date} or a run pack."

**Cost per Bot** (`costsView`): table Bot, Runs, Cost this period. **Runs by day:** bar chart with a table alternative ("Show as table").

`{thing}` = "usage".

### 17.13 API keys and MCP (v1)

**Route** `/settings/api-keys`. **Release** v1. **Requirements** FR-API-1, FR-API-2, FR-SET-3.

**Keys table** (`api_keys`; mine, or everyone's with `apiKeysManageAll`): Name, Key (`prefix` followed by "…"), Access (`scopes`: "Read" or "Read and write"), Created by, Created, Last used, Expires. Row menu: Revoke.

**Create API key** dialog: Name, Access (Read, Read and write; viewers get Read only), Expires (Never, 30 days, 90 days, 1 year). Button "Create key". Then a second dialog: "Copy this key now. You won't see it again." The key in monospace with "Copy". Button "Done". Closing without copying asks "Close without copying? You'll need to create a new key."

Revoke dialog: "Revoke {name}? Apps using it stop working right away." Button "Revoke key". Takes effect immediately (FR-SET-3).

**MCP section.** `h2` "Use Magpie in Claude, ChatGPT and other AI apps". Server address `https://{APP_HOST}/mcp` with "Copy". Three numbered steps: "Add a custom connector in your AI app.", "Paste this address.", "Sign in to Magpie when asked." Link "API docs".

`{thing}` = "API keys". Empty: "No API keys yet. Create one to connect another app to Magpie."

### 17.14 Webhooks (v1)

**Route** `/settings/webhooks`. **Release** v1. **Requirements** FR-API-3.

Endpoints (`webhook_endpoints`): URL, events, switch On, last delivery status. Primary "Add endpoint": URL (https only), Events (multi-select of the public event list from API.md), then a one-time "Signing secret" reveal like API keys. Endpoint detail shows deliveries (`webhook_deliveries`): Time, Event, Status code, Attempts, Next try, and "Resend". Empty: "No endpoints. Add one to get record and approval events in another system."

### 17.15 Audit log

**Route** `/settings/audit` (`?actor=&bot=&action=&from=&to=`). **Requirements** FR-SET-4, FR-APR-5, FR-OPS-2, FR-OPS-3.

Full-width table, read-only (`audit_log`): Time, Who (person; Bot with run link; System; "Magpie support" for `actor_type='staff'`; API key name), Action (human label from a map in `packages/shared/src/audit-actions.ts`, for example `approval.decide` is "Decided an approval", `secret.read` is "Used a stored key"), Target (link), Channel (for approvals, from `data.via`), Details (opens a drawer with Field, From, To from `data`). Rows with `impersonated_by` show "During a support session by {staff name}". Filters: Person, Bot, Action, Date range. Button "Export CSV".

`{thing}` = "audit log". Empty with filters: the filtered copy. Empty otherwise: "Nothing logged yet."

### 17.16 Data and deletion

**Route** `/settings/data`. **Requirements** FR-ACC-5.

| Section | Content |
|---|---|
| Export | "A ZIP of every record as CSV and JSON, plus your files. It's ready within an hour and we'll email you." Primary "Export all data". List of `data_exports` with `kind='workspace'`: Requested by, Requested, Status, and "Download" when ready ("Link works until {date}"). |
| Transfer ownership | "Make another admin the owner. You become an admin." Button "Transfer ownership": dialog with an admin select and "Type {workspace name} to confirm" (paste allowed). Button "Transfer ownership". |
| Delete workspace | "Magpie deletes the workspace 30 days after you ask. You can cancel until then." Destructive "Delete workspace": dialog "Delete {workspace}?", body "Magpie deletes it on {date}. Until then you can cancel. After that every record and file is gone for good.", "Type {workspace name} to confirm", button "Schedule deletion". When scheduled: "Scheduled for deletion on {date}." with "Cancel deletion". |

`{thing}` = "exports".

## 18. Reports and automations (v1)

### 18.1 Reports list

**Route** `/reports`. **Release** v1. **Requirements** FR-REP-1.

`h1` "Reports". First row: "Bid results" (fixed). Then `reports`: Name, Shared or "Only you", Updated. Primary "New report" (`reportsCreate`): Name and switch "Share with the team". Empty: "No reports yet. Bid results is always here. Create your own to track anything else."

### 18.2 Bid results

**Route** `/reports/bids` (`?from=&to=`). **Release** v1. **Requirements** FR-REP-1.

Date range select (This month, Last 3 months, This year, Custom). Number tiles: Bids found (matches created), Pursued, Submitted, Won, Win rate ("{won} of {won plus lost}" and the percent), Average bid value (submitted bids' `amount_cents`), Bot work time (sum of run durations, hours). Line chart: matches, pursued and submitted per week. Table by agency: Agency, Pursued, Submitted, Won, Win rate. Every chart has "Show as table". Colors from the chart tokens ([§22.2](#222-color)). Widgets load in under 2 seconds for 50,000 records.

### 18.3 Custom report

**Route** `/reports/$reportId`. **Release** v1. **Requirements** FR-REP-1.

Grid of `report_widgets`. "Add widget" dialog: Kind (Number, Bar, Line, Table), Records (Companies, Contacts, Deals, Matches), Measure (Count, Sum of amount), Group by (a field), Filters, Date range. Widget menu: Edit, Duplicate, Move up, Move down, Delete. Drag also reorders. Each widget loads and fails on its own: "Couldn't load this widget." with Try again. Empty report: "No widgets yet. Add one to start." Button "Add widget".

### 18.4 Automations

**Routes** `/settings/automations`, `/settings/automations/$automationId`. **Release** v1. **Requirements** FR-AUT-1.

**List** (`automations`): Name, When (trigger summary), switch On, Last run (status), Runs this month. Primary "New automation". Empty: "No automations yet. Automations do simple steps when something happens, like creating a task when a bid reaches Pricing."

**Editor** (a form, not a canvas):
1. **When**: Record created, Field changed, Stage changed, Date reached, On a schedule, Incoming webhook. Each shows its own fields (record type, field, stage, date field and offset, schedule, the generated URL).
2. **If** (optional): condition rows Field, Operator, Value, with "All of these" or "Any of these".
3. **Then**: ordered steps, each a card with Move up, Move down, Remove: Update the record, Create a task, Notify someone, Ask a Bot to do something, Send a templated email (always creates an approval), Call a webhook.

Buttons: primary "Save", secondary "Turn on" or "Turn off". Tab "Runs" (`automation_runs`): Time, Trigger, Status, Step results, Retries (up to 3).

## 19. Ops console and reviewer queue (v1)

**Frame.** `/ops/*`, staff only (`users.is_staff`). Own rail: Tenants, Review queue, Costs, Flags. Header: "Magpie staff", the staff member's name and role. A 3px top border in the needs color marks every Ops page. Footer on every page: "Your views here are logged." (FR-OPS-1). Ops may use internal terms (tenant, MRR, token).

| Staff role (`users.staff_role`) | Sees |
|---|---|
| `support` | Tenants (read), tenant detail, impersonation |
| `reviewer` | Review queue for assigned tenants only |
| `admin` | Everything, plus suspend, credits, entitlement overrides, trial extensions, deletion, flags, reviewer assignments |

Every action dialog in Ops requires "Reason" (at least 10 characters) and states: "This is logged. The workspace owner sees it in their audit log." (FR-OPS-3).

### 19.1 Tenants

**Route** `/ops/tenants`. **Requirements** FR-OPS-1.

Table: Tenant (name, slug), Plan, Status, MRR, Users, Runs this period (and % of limit), AI cost (period), Vendor cost (SMS, Kontract, enrichment), Margin %, Created, Last active. Filters: Status, Plan, "Cost over 50% of revenue" (PRD §7 cost alert), Margin below. Search by name, slug or owner email. Row opens the tenant.

### 19.2 Tenant detail

**Route** `/ops/tenants/$tenantId` (`?tab=`). **Requirements** FR-OPS-1, FR-OPS-2, FR-OPS-3, FR-OPS-5.

Header: name, status pill, plan. Actions (by role): "Start support session", Suspend or Unsuspend, Extend trial (days), Grant credit (amount), Entitlement overrides (key, limit), Schedule deletion or Cancel deletion, Assign reviewer (Managed plan; `reviewer_assignments` **(requested)**).

Tabs: Overview (subscription, trial, period, owner, members), Usage (counters against entitlements, overrides marked "Override"), Costs (per day: AI, SMS, Kontract, enrichment against revenue), Runs (recent failed runs, opening a read-only run view), Billing events (`billing_events`), Flags (this tenant's overrides), Audit (staff actions on this tenant).

**Start support session** dialog (FR-OPS-2): Person (members select), Reason (required), fixed "Lasts 60 minutes." Button "Start support session". Opens the tenant app as that person with the banner below. The owner gets an in-app notification (`kind='system'`): "Magpie support opened a support session in your workspace. Reason: {reason}."

### 19.3 Support session banner

Shown in the tenant app on every page during impersonation, above the header, not dismissible, needs tone (FR-OPS-2):

"Support session. You're signed in as {user name} in {workspace}. Reason: {reason}. Ends in {minutes} min. Outside actions are blocked." Button "End session".

At 5 minutes left the timer text turns problem tone. At the end, or on "End session", the staff member returns to `/ops/tenants/$tenantId` with the toast "Support session ended." Writes during the session carry `impersonated_by`. Every external action control is disabled with the `support_session_blocked` copy.

### 19.4 Costs

**Route** `/ops/costs` (`?from=&to=`). **Requirements** FR-OPS-6.

Stacked bars per day by vendor (AI, SMS, Kontract, enrichment) with a revenue line (MRR divided by days in the month). Table per tenant: Revenue, AI, SMS, Kontract, Enrichment, Total cost, Margin, and a "Cost over 50%" flag. Totals match `usage_events`. Export CSV.

### 19.5 Flags

**Route** `/ops/flags`. **Requirements** FR-OPS-4.

Table (`feature_flags` with `tenant_id` null): Key, On, Value, Tenant overrides (count), Updated. Edit dialog: switch On, Value (JSON editor with validation), overrides list (tenant search, On, Value, Remove), "Add override". Note: "Changes take effect within a minute."

### 19.6 Reviewer queue

**Routes** `/ops/review`, `/ops/review/$approvalId`. **Requirements** FR-OPS-5.

**List.** `h1` "Review queue". Stat: "Your median review time this week: {duration}". Admins also see a table of reviewers with their medians. Tabs: Waiting (`review_stage='staff'`, `status='pending'`, for tenants assigned to me), Sent back, Done today. Rows, oldest first: tenant name, approval title, Bot, effect pill, bid link, waiting time against the 4-hour target (needs tone after 3 hours, problem tone after 4).

**Detail.** The approval card in reviewer mode ([§22.12](#2212-approval-card)) plus a context column: company profile summary, the bid's brief (read-only link), the tenant's memories, and this tenant's last 10 decided approvals of the same tool.

Actions:
- Primary "Approve and send to owner": sets `review_stage='owner'`, `staff_decided_by`, `staff_decided_at` **(requested)**. The owner is notified as usual.
- "Edit": edit form as in [§14.3](#143-preview-kinds), then "Save and send to owner".
- "Send back to Bot": requires "What should the Bot fix?" (`review_notes` **(requested)**). Sets `status='returned'` **(requested)**; the run gets the notes and makes a new approval.

Reviewers never send anything to outside recipients. The owner still approves.

`{thing}` = "review queue". Empty: "Nothing to review. New drafts from your workspaces show up here."
## 20. Text messages: SMS and Telegram

Templates live in `packages/core/channels/templates/` as catalog messages ([§26](#26-internationalization)) and render from the same payload as the web card (FR-APR-1). Examples use `magpie.app` as a stand-in for `APP_HOST` and "Clean Co" as the workspace.

### 20.1 Rules for every text

| Rule | Detail |
|---|---|
| Character set | GSM-7 only. No curly quotes, dashes other than the hyphen, ellipsis character, emojis, or non-breaking spaces. Avoid `[ ] { } \| ^ ~ \ €`; each counts as two characters. Server formatters run in `style: 'sms'` mode and replace Intl's narrow no-break space before AM and PM with a normal space. A unit test fails any template that renders outside GSM-7. |
| Segments | One segment holds 160 characters; longer texts split into 153-character segments. Each template states its budget. Budgets assume the worst case for every slot. |
| Brand | Every text Magpie starts begins with "Magpie". When the person has SMS connected in two or more workspaces, it adds the workspace: "Magpie (Clean Co)". Replies to the person's own texts don't repeat the brand. |
| Links | Short links `https://{SHORT_HOST}/s/{code}` with a 7-character code, from `short_links` **(requested)**. Budget 36 characters, so `SHORT_HOST` is at most 18 characters. A link opens the app at its target after sign-in and switches to the right workspace. Links expire after 30 days. |
| Slots | `{title}` notice or bid short title, at most 34 characters in the digest and 40 elsewhere, cut at a word boundary with "...". `{bid}` the deal's short name, at most 30. `{bot}` at most 20. `{company}` at most 24. `{code}` an approval short code, "A" plus 1 to 3 digits. `{amount}` like "$18,400". Dates "Nov 12" or "11/12" in the digest; times "2:00 PM ET" or "Thu 2pm" in the digest. |
| Times | In the recipient's `users.timezone`. Deadlines add the zone abbreviation; when the deadline's own timezone differs, the text uses the deadline's zone. |
| Quiet hours | Non-urgent texts wait until the quiet hours end (`notifications.send_after`, FR-CH-5). Always sent at once: verification codes, replies to the person's texts, deadline reminders due within 2 hours, and link confirmation. |
| Dedupe | One text per `notifications.dedupe_key` per channel. |
| Numbering | Match numbers in a digest are stored in that digest's `notifications.payload.refs` as `[{ n, matchId }]`. A reply with a number refers to the most recent digest sent to that number. |
| Short codes | Unique per person across all their workspaces while pending **(requested)**, so "A7" never needs a workspace prefix. Freed codes are reused, lowest number first. |
| Who gets texts | Only verified people in the workspace (PRD §7). Never contacts, subs or agencies. |

### 20.2 Reply grammar

FR-CH-4, FR-DIS-6, FR-APR-2. Input is trimmed, case-insensitive, and spaces between a letter and its code are optional. Carrier keywords are handled first.

| Input | Meaning |
|---|---|
| `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` | Turn texts off for this number (`channel_bindings.is_enabled=false`). Reply: STOP template. |
| `START`, `UNSTOP`, `YES` | Turn texts back on. Reply: START template. |
| `HELP`, `INFO` | Reply: HELP template. |
| `1` to `5`, `Y1`, `Y 1` | Pursue match n from the last digest |
| `N1`, `N 1` | Dismiss match n (`dismiss_reason='other'`, `dismiss_note='Dismissed by text'`) |
| `A7`, `Y A7`, `YA7` | Approve A7 |
| `X A7`, `XA7` | Skip A7 |
| `E A7`, `EA7` | Reply with an edit link for A7 |
| `A7 A8`, `A7, A8`, `X A7 A8` | The same action for each code; one combined reply |
| `?` | List what's waiting |
| `A`, `Y`, `N`, `X`, `E` alone | Help reply for a bare letter |
| Anything else | Sent to the Assistant as chat in this person's SMS thread (`threads.channel='sms'`) |

The parser lives in `packages/core/channels/grammar.ts` and is tested against a fixture table of inputs and expected replies (FR-CH-4).

### 20.3 Templates

Each row gives the exact text with example values, its character count, and its worst-case budget. `{link}` in the examples is `https://magpie.app/s/x7Kp2Qa` (29 characters).

**Morning digest** (FR-CH-3, FR-DIS-6). Sent at the person's digest hour on their digest days. Example, 459 characters, 3 segments:

```
Magpie, Tue Nov 10
New matches:
1 Custodial services, VA hospital, Hampton VA. Score 86, due 11/24
2 Grounds maintenance, Fort Lee VA. Score 78, due 12/2
3 Snow removal, Shenandoah NP, Luray VA. Score 71, due 12/5
Reply 1 to pursue, N1 to dismiss.
Waiting for you: A7 Send quote request to ABC Cleaning. A8 Move Fort Lee grounds to Pricing.
Due soon: Fort Lee grounds questions Thu 2pm.
Quotes in: Green Lawn $18,400.
Open Magpie: {link}
```

| Line | Rule | Max characters |
|---|---|---|
| Header | "Magpie, {Ddd Mmm D}" or "Magpie ({workspace}), {Ddd Mmm D}" | 41 |
| New matches | "New matches:" then up to 5 lines "{n} {title}, {place}. Score {score}, due {mm/dd}" (title 34, place 16), highest score first, `status` new | 12 plus 5 times 76 |
| Reply hint | "Reply 1 to pursue, N1 to dismiss." Only with matches. | 33 |
| Waiting | "Waiting for you: " then up to 3 "{code} {title}." then "+{n} more." | 155 |
| Due soon | "Due soon: " then up to 2 "{bid} {kind} {when}." in the next 7 days. Kind: proposal, questions, site visit, amendment ack, or the label. | 127 |
| Quotes | "Quotes in: " then up to 2 "{company} {amount}." received since the last digest | 84 |
| Expiring | "Expiring: {item} {mm/dd}." Earliest library item within 30 days, or "SAM registration {mm/dd}." | 47 |
| Bot news | One line from the most useful finished run, at most 50 characters | 50 |
| Link | "Open Magpie: {link}" to `/today` | 49 |

Empty sections are left out. Worst case with every slot full: 991 characters, 7 segments, under the PRD's 1,000. Target under 612 characters (4 segments). If a render still exceeds 1,000, drop Bot news, then Expiring, then Quotes, then cut matches to 3 and add "+{n} more in the app." When every section is empty, no digest is sent on any channel.

**Approvals and their replies.**

| Template | Text (example) | Chars | Budget |
|---|---|---|---|
| Single approval (FR-APR-1) | `Magpie A7, Sub Finder: Send quote request to ABC Cleaning for Fort Lee grounds. Reply A7 to approve, X A7 to skip, E A7 to edit. {link}` | 157 | 231, 2 segments |
| Batched (3 or more created within 5 minutes for one person) | `Magpie: 3 things are waiting for you. A7 Send quote request to ABC Cleaning. A8 Send quote request to Green Lawn. A9 Move Fort Lee grounds to Pricing. Reply a code to approve, X and the code to skip. {link}` | 228 | 306, 2 segments (up to 3 listed, then "+{n} more.") |
| Approved, external | `Approved A7. Sub Finder is sending the quote request to ABC Cleaning.` | 69 | 160 |
| Approved, internal | `Approved A8. Fort Lee grounds moved to Pricing.` | 47 | 160 |
| Several codes | `Approved A7 and A8. A9 was already skipped on the web.` | 54 | 306 |
| Skipped, external | `Skipped A7. Nothing was sent.` | 29 | 160 |
| Skipped, internal | `Skipped A8. Nothing changed.` | 28 | 160 |
| Edit link | `Edit A7 here: {link} It waits for you until Nov 13 at 9:00 AM.` | 84 | 160 |
| `?` with items | `Waiting for you: A7 Send quote request to ABC Cleaning. A8 Move Fort Lee grounds to Pricing. New matches: 1, 2, 3. Reply a code, or open {link}` | 165 | 306, 2 segments |
| `?` with nothing | `Nothing is waiting for you. Bid Scout checks your searches every 4 hours.` | 73 | 160 |

The approval text title is `approvals.title` plus " for {bid}" when the approval has a deal. On the Managed plan, the owner's text goes out only after the reviewer approves (FR-OPS-5).

**Matches by text.**

| Template | Text (example) | Chars |
|---|---|---|
| Pursued | `Pursuing match 1, Custodial services, VA Medical Center. Bid Reader is reading it now. {link}` | 115 |
| Dismissed | `Dismissed match 1, Custodial services, VA Medical Center. Tell Bid Scout why: {link}` | 106 |

**Reply errors.**

| Case | Text (example) | Chars |
|---|---|---|
| Unknown approval code | `There's no A9 waiting for you. Reply ? to see what is.` | 54 |
| Already decided | `A7 was already approved on the web at 9:14 AM. Nothing else to do.` (variants: skipped; by text, in Telegram, through the API) | 66 |
| Expired | `A7 expired on Nov 9 and the Bot went on without it. See what happened: {link}` | 99 |
| Canceled | `A7 was canceled because its bid was archived. Nothing was sent.` (or "because the run was stopped") | 63 |
| Blocked (suppressed recipient, missing postal address) | `A7 can't be approved yet. ABC Cleaning unsubscribed. Edit it in the app: {link}` | 101 |
| No such match number | `There's no match 6 in your last digest. Reply ? to see what's waiting.` | 70 |
| Match is already a bid | `Match 1 is already a bid: Custodial services, VA Medical Center. {link}` | 93 |
| Match was dismissed | `Match 1 was dismissed on Nov 9. Pursue it in the app: {link}` | 82 |
| Viewer | `You can view this workspace but can't approve. Ask an owner or admin.` | 69 |
| Read-only workspace | `Clean Co is read-only because a payment failed. An owner can fix it here: {link}` | 102 |
| Suspended | `Clean Co is suspended. Contact Magpie support at magpie.app/help.` | 65 |
| Bare letter | `Add the number after the letter, like A7 or N1. Reply ? to see what's waiting.` | 78 |
| Number not connected | `This number isn't connected to Magpie. Sign in at magpie.app and connect it in Settings.` | 88 |
| Chat over the monthly allowance | `Clean Co used this month's Bot runs, so the Assistant can't answer by text. An owner can add a run pack in the app.` | 115 |

**Chat by text.** The Assistant's reply is at most 480 characters (3 segments). A longer answer sends the first 400 characters, cut at a sentence, then "... Full answer: {link}".

**Deadlines** (FR-BID-4). Sent 72, 24 and 2 hours before. The 2-hour reminder ignores quiet hours.

| Template | Text (example) | Chars | Budget |
|---|---|---|---|
| 72 hours | `Magpie: Fort Lee grounds questions are due in 72 hours, Thu Nov 12 at 2:00 PM ET. {link}` | 110 | 2 segments |
| 24 hours | `Magpie: Fort Lee grounds proposal is due in 24 hours, Thu Nov 12 at 2:00 PM ET. 3 required items are still open. {link}` | 141 | 2 segments |
| 2 hours | `Magpie: Fort Lee grounds proposal is due in 2 hours, at 2:00 PM ET. It isn't marked submitted yet. {link}` | 127 | 2 segments |

The open-items sentence appears only for `proposal_due` when required requirements are open. "It isn't marked submitted yet." appears only for `proposal_due` without a submission. Phrases per kind are in [§9.13](#913-deadlines).

**Quotes** (FR-SUB-3).

| Template | Text (example) | Chars | Budget |
|---|---|---|---|
| Quote with amount | `Magpie: Green Lawn LLC quoted $18,400 for Fort Lee grounds, valid to Dec 15. Check the numbers before they go in the price sheet: {link}` | 158 | 2 segments |
| Reply without an amount | `Magpie: Green Lawn LLC replied to your quote request for Fort Lee grounds. {link}` | 103 | 1 segment |

**Runs finished.** Off by default for texts; in-app only unless the person turns it on.

| Template | Text (example) | Chars |
|---|---|---|
| Brief ready | `Magpie: Bid Reader finished the brief for Fort Lee grounds. 42 requirements, 3 red flags. {link}` | 118 |
| Other run | `Magpie: Estimator finished: Drafted price sheet v2, total $412,000, margin 11%. {link}` (summary at most 80) | 108 |
| Failed | `Magpie: Bid Reader couldn't finish the brief for Fort Lee grounds. One document has no readable text. {link}` | 130 |
| Hit a run limit (FR-BOT-9) | `Magpie: Proposal Writer stopped at the step limit for one run on Fort Lee grounds. Open it to continue: {link}` | 132 |

**Limit alerts** (FR-BIL-4). 80% goes to owners and admins; 100% and 120% go to everyone. Units: "Bot runs", "document pages", "texts".

| Template | Text (example) | Chars |
|---|---|---|
| 80% | `Magpie: Clean Co has used 80% of this month's Bot runs (480 of 600). Bots keep working. {link}` | 116 |
| 100% | `Magpie: Clean Co has used all 600 Bot runs this month. Bots keep working. Jobs pause at 720 runs. Add a run pack: {link}` | 142 |
| 120% | `Magpie: Scheduled Bot jobs are paused. Clean Co used 720 of 600 Bot runs this month. Chat and approvals still work. {link}` | 144 |
| 120% of texts | `Magpie: Clean Co used 360 of 300 texts this month. Texts pause until Dec 1. Updates come by email and in the app. {link}` | 142 |

What happens at 120% of texts follows BILLING.md; this copy assumes texts pause and other channels carry on.

**Connecting and carrier keywords** (FR-CH-1).

| Template | Text | Chars |
|---|---|---|
| Verification code | `Your Magpie code is 482913. It expires in 10 minutes. Don't share it.` then a blank line and `@magpie.app #482913` (WebOTP) | 90 |
| Link confirmation | `Magpie: This number is connected to Clean Co. Your morning digest and approvals will come here. Reply HELP for help, STOP to stop. Msg & data rates may apply.` | 158 |
| STOP | `Magpie: You won't get texts from Magpie on this number. Your digest will come by email. Reply START to turn texts back on.` | 122 |
| START | `Magpie: Texts are back on for this number. Reply HELP for help, STOP to stop.` | 77 |
| HELP | `Magpie: Reply 1 to pursue match 1, N1 to dismiss it. A7 approves A7, X A7 skips it, E A7 sends an edit link. ? lists what's waiting. Help: magpie.app/help. STOP to stop.` | 169, 2 segments |

STOP also creates an in-app notification (`kind='system'`): "Texts are off for {number} because you replied STOP."

### 20.4 Telegram

Same words as SMS, with these differences:

| Rule | Detail |
|---|---|
| Format | `parse_mode: HTML`. Section headings in `<b>`. Up to 4,096 characters; the digest stays under 2,000. |
| Brand | No "Magpie" prefix, since the chat is Magpie. Keep "({workspace})" when the person has two or more workspaces connected. |
| Links | No raw URLs in the text. Links are URL buttons. |
| Replies | The reply grammar works the same. Buttons cover the common actions. |
| Private chats only | Group or channel messages get: "Magpie only works in a private chat. Open a direct chat with Magpie and try again." (FR-CH-2) |
| Limits | Digest: up to 5 matches (titles up to 60 characters), 5 approvals, 3 deadlines, 3 quotes, 3 Bot news lines. Approval previews: email body up to 600 characters, document excerpt up to 300. |

**Digest** (example):

```
<b>Tue Nov 10</b>

<b>New matches</b>
1. Custodial services, VA hospital, Hampton VA. Score 86, due Nov 24
2. Grounds maintenance, Fort Lee VA. Score 78, due Dec 2
3. Snow removal, Shenandoah NP, Luray VA. Score 71, due Dec 5

<b>Waiting for you</b>
A7 Send quote request to ABC Cleaning
A8 Move Fort Lee grounds to Pricing

<b>Due soon</b>
Fort Lee grounds questions, Thu Nov 12 at 2:00 PM ET

<b>Quotes in</b>
Green Lawn LLC $18,400 for Fort Lee grounds

Tap a button, or reply 1 to pursue and N1 to dismiss.
```

Keyboard: `[Pursue 1] [Dismiss 1]`, `[Pursue 2] [Dismiss 2]`, `[Pursue 3] [Dismiss 3]`, `[Open Magpie]`.

**Approval** (example, `email` kind). Telegram shows more of the preview than SMS (FR-APR-1):

```
<b>A7, Sub Finder</b>
Send quote request to ABC Cleaning for Fort Lee grounds

Why: ABC Cleaning is 12 miles from the site and quoted similar work in March.

To: Maria Lopez, bids@abccleaning.com
Subject: Quote request: grounds maintenance at Fort Lee, due Nov 20
Hi Maria, we're bidding on grounds maintenance at Fort Lee and would like your price for...

Leaves your business. Expires Nov 13 at 9:00 AM.
```

Keyboard: `[Approve] [Skip]`, then `[Edit in Magpie]`.

Preview lines by kind: `email` shows To, Subject and the body's first 600 characters; `sms` shows "To {name}" and the text; `record_change` shows one line per change, "{label}: {before} to {after}"; `stage_change` shows "{deal}: {from} to {to}" and the reason; `document` shows title, "Version {n}, about {pages} pages" and the first 300 characters. When the approval has sources, a last line reads "{n} sources. Open Magpie to check them." The Edit in Magpie button opens the full card with its citation chips.

**Buttons per message.**

| Message | Inline keyboard |
|---|---|
| Digest | One row per listed match: [Pursue {n}] [Dismiss {n}] (callback). Last row: [Open Magpie] (URL, `/today`). |
| Single approval | Row 1: [Approve] [Skip] (callback). Row 2: [Edit in Magpie] (URL, `/approvals/$approvalId`). |
| `?` or `/waiting` | One row per approval, up to 5: [Approve {code}] [Skip {code}]. Last row: [Open approvals] (URL). |
| Deadline | [Open bid] (URL) |
| Quote | [Check numbers] (URL to the quote on the bid) |
| Run finished | [Open] (URL) |
| Limit alert | [See usage] (URL; owners and admins) or [Open Magpie] |

**After a button press.** Answer the callback with a short toast ("Approved A7", "Skipped A7", "Pursuing match 1", "Dismissed match 1", or the error copy from [§20.3](#203-templates) shortened to 200 characters). Then edit the original message: remove its keyboard and add an italic last line, for example "<i>Approved by you at 9:14 AM.</i>", "<i>Approved on the web by Dana at 9:14 AM.</i>", "<i>Expired on Nov 9.</i>". When an approval is decided anywhere else, the open Telegram message is edited the same way.

**Callback data format.** ASCII, 36 bytes, under Telegram's 64-byte limit:

```
1:{op}:{id22}:{mac8}
1:ap:pUiLXsdHTUuh0iAQoDIfdg:9m6O9Vws
```

| Part | Meaning |
|---|---|
| `1` | Format version. Unknown versions answer "This button is out of date. Open Magpie." |
| `op` | `ap` approve, `sk` skip, `mp` pursue match, `md` dismiss match, `ms` save match |
| `id22` | The approval or match id: the UUID's 16 bytes in base64url without padding (22 characters) |
| `mac8` | First 8 characters of base64url HMAC-SHA256 over `1:{op}:{id22}:{chat_id}` with `TELEGRAM_CALLBACK_SECRET` |

The handler checks the MAC in constant time, resolves the binding by chat id (`binding_for_channel_address`), checks the person's permission and the entity's current state, then acts. Edits always go through the URL button, never a callback.

**Commands** (registered with `setMyCommands`):

| Command | Reply |
|---|---|
| `/start {code}`, success | "Connected to {workspace}. Your morning digest and approvals will come here. Send /stop to disconnect." |
| `/start {code}`, expired | "This connect link expired. In Magpie, open Settings, then Channels and alerts, and connect Telegram again." |
| `/start {code}`, used | "This connect link was already used. If this chat isn't connected, get a new link in Magpie." |
| `/start` with no code | "To connect, open Magpie, go to Settings, then Channels and alerts, and choose Connect Telegram." |
| `/stop` | "Disconnected. Magpie won't send messages to this chat. You can connect again from Settings in the app." |
| `/help` | The HELP text without "STOP to stop", plus "Send /stop to disconnect." |
| `/waiting` | Same as `?` |

## 21. Email templates

**Common to every email.** From "Magpie <notifications@{MAIL_DOMAIN}>" through Postmark's transactional stream. No reply-to (replies go to a mailbox that answers with the help link), except forwarded quote replies. Built with React Email in `packages/core/notifications/email/`. 600px column, Magpie logo, `h1`, short paragraphs, at most one primary button, a plain-text part. Footer: "You get this because you're in {workspace} on Magpie. Change what we email you: {link to /settings/channels}." and Magpie's postal address. Emails that aren't about a workspace (sign-in, password) say "You get this because someone asked to sign in to Magpie with this address." Links in emails never take an action by themselves; they open the app.

### 21.1 Morning digest

FR-CH-3. Sent with the SMS or Telegram digest when the person's digest channels include email.

| Part | Content |
|---|---|
| Subject | By content, first match: "{n} new matches and {m} waiting for you", "{n} new matches today", "{m} things waiting for you", "{bid} is due {weekday}" |
| Preheader | The first item's line |
| `h1` | "Your morning, {Weekday Mon D}" |
| Sections | Same order as SMS. New matches: up to 10 rows with score, title, agency, place, due, value, and a "View" link. Waiting for you: approvals (title, Bot, expiry, "Review" link), quotes to check, bid decisions. Due this week: deadlines and tasks. Quotes received. Expiring documents. Bot news (up to 5). |
| Button | "Open Today" |

### 21.2 Invite

FR-ACC-2. Sent by Better Auth's organization plugin through the same template system.

| Part | Content |
|---|---|
| Subject | "{inviter} invited you to {workspace} on Magpie" |
| Preheader | "Join as {role}. The invite works until {date}." |
| Body | "{inviter} added you to {workspace} as {role}." Then: "{workspace} uses Magpie to find bids and do the paperwork. Bots do the reading and chasing, and people approve what goes out." Then: "This invite expires on {date}." |
| Button | "Join {workspace}" (`/invite/$invitationId`) |

### 21.3 Sign-in link, set password, reset password, confirm email

FR-ACC-1.

| Email | Subject | Body | Button |
|---|---|---|---|
| Magic link | "Your Magpie sign-in link" | "Use this link to sign in to Magpie. It works once, for {minutes} minutes. If you didn't ask for it, you can ignore this email." | "Sign in to Magpie" |
| Set password | "Set your Magpie password" | "Set a password to sign in to {workspace} on Magpie. The link works for 1 hour." | "Set password" |
| Reset password | "Reset your Magpie password" | "Use this link to choose a new password. It works for 1 hour. If you didn't ask for it, your password stays the same." | "Choose a new password" |
| Confirm email | "Confirm your email for Magpie" | "Confirm this address so Magpie can send you your digest and approvals." | "Confirm email" |

### 21.4 Approval waiting

FR-APR-1, FR-APR-2. Sent when the person's channels for approvals include email, or when no phone channel is connected.

| Part | Content |
|---|---|
| Subject | "{bot} needs your yes: {approvals.title}" |
| Preheader | "Why: {preview.why}" (first 90 characters) |
| `h1` | `approvals.title` |
| Body | "{bot} wants to do this for {bid}." Then "Why: {why}." Then the preview: email (From, To, Subject, first 400 characters of the body), record change (field, now, after table), stage change ("{from} to {to}"), document (title, version, excerpt). Then "Expires {date time}." When SMS is connected: "Or reply {code} to the text we sent." |
| Button | "Review in Magpie" (`/approvals/$approvalId`) |

No approve or skip links in email, so a link scanner can never approve anything.

### 21.5 Trial ending

FR-BIL-1. Sent 3 days and 1 day before `tenants.trial_ends_at` to owners and admins.

| Part | Content |
|---|---|
| Subject | "Your Magpie trial ends in 3 days" or "Your Magpie trial ends tomorrow" |
| Preheader | "Choose a plan to keep your Bots working." |
| Body | "Your trial for {workspace} ends on {date}. After that, scheduled Bot jobs stop until you choose a plan. Your data stays." Then a factual list of the trial so far: "{n} matches found", "{n} bids pursued", "{n} approvals decided". Then: "Plans are month to month. You can cancel in the app anytime." |
| Button | "Choose a plan" (`/settings/billing`) |

### 21.6 Payment failed

FR-BIL-6. To owners and admins on the first failure, then on day 3 and day 6, then at each state change.

| Email | Subject | Body | Button |
|---|---|---|---|
| Day 0 | "Your Magpie payment didn't go through" | "We couldn't charge your card for {plan} on {date}. Update your card by {date + 7 days} to keep your Bots working." Then what happens next: "After {date + 7 days}, scheduled Bot jobs pause. After {date + 14 days}, your workspace becomes read-only." | "Update card" |
| Day 3 and 6 | "Reminder: update your card for Magpie" | "Your payment for {plan} still hasn't gone through. Update your card by {date} to keep your Bots working." | "Update card" |
| Day 7 | "Your Bot jobs are paused" | "Scheduled Bot jobs are paused because payment failed. Chat and approvals still work. Update your card by {date} to keep editing." | "Update card" |
| Day 14 | "Your Magpie workspace is read-only" | "{workspace} is read-only because payment failed. Your data is kept until {date}. Update your card to turn everything back on." | "Update card" |

"Update card" opens `/settings/billing`, which opens the Stripe Customer Portal. Dates come from BILLING.md's state machine.

### 21.7 Other emails

| Email | Subject | Requirement |
|---|---|---|
| Quote reply forwarded | "Fwd: {original subject}" with a header block: "{company} replied to your quote request for {bid}. It's on the bid in Magpie." Button "Open the bid". Reply-To is the sub's address. | FR-SUB-3 |
| Deadline reminder | "{bid} {deadline phrase} in {24 hours}" | FR-BID-4 |
| Quote received | "{company} quoted {amount} for {bid}" | FR-SUB-3 |
| Usage alert | "Your workspace used {80%, all} of this month's {unit}" or "Scheduled Bot jobs are paused" | FR-BIL-4 |
| Export ready | "Your Magpie export is ready" ("The download link works until {date}.") | FR-ACC-5 |
| Deletion scheduled | "{workspace} will be deleted on {date}" (button "Cancel deletion") | FR-ACC-5 |
| Deletion canceled | "{workspace} won't be deleted" | FR-ACC-5 |
| Ownership transferred | "You're now the owner of {workspace}" and, to the old owner, "You transferred {workspace}" | FR-ACC-5 |
| Support session opened | "Magpie support opened your workspace" ("Reason: {reason}. It ends within 60 minutes. Every action is in your audit log.") | FR-OPS-2 |
| Plan canceled | "Your Magpie plan ends on {date}" | FR-BIL-7 |
## 22. Design system

### 22.1 Foundations

| Item | Choice |
|---|---|
| Where | Tokens in `packages/ui/src/styles/tokens.css`. Components in `packages/ui/src/components/` (shadcn/ui, Radix primitives, "new-york" style), owned and linted like app code. `apps/web` imports both. |
| CSS | Tailwind CSS v4. `@import "tailwindcss";`, `@custom-variant dark (&:where(.dark, .dark *));`, and an `@theme inline` block that maps every token below to a Tailwind color (`--color-background: var(--background);` and so on). |
| Theme | `.dark` on `<html>`. Choice in `localStorage` key `magpie.theme` (`system`, `light`, `dark`), default `system` following `prefers-color-scheme` live. An inline script in `index.html` sets the class before first paint. |
| Font | Inter Variable (`@fontsource-variable/inter`). Monospace: `ui-monospace, SFMono-Regular, Menlo, monospace`. `font-variant-numeric: tabular-nums` on table cells, money, dates, countdowns and codes. |
| Icons | `lucide-react`, 16px in dense UI and 20px in navigation, `stroke-width` 1.75. Icons inherit `currentColor`. |
| Root size | The browser's (16px by default). Every size is in rem so it follows the person's text size. Never compute layout from a rem token in pixels; measure the element. |

### 22.2 Color

One accent (brand blue, from the logo's gradient end) used for links, focus, selection and citations. Primary buttons are ink on light and light on dark. Four status tones say how work stands and are used only for status. Every text pair below meets 4.5:1 and every boundary, focus ring and chart color meets 3:1 against the card and page backgrounds in its theme (WCAG 2.2 AA); `packages/ui/test/tokens.test.ts` recomputes them and fails on regression.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#f7f8fa` | `#0b1220` | Page background |
| `--foreground` | `#0b1220` | `#e8ecf2` | Body text |
| `--card` | `#ffffff` | `#111a2b` | Cards, tables, panels |
| `--card-foreground` | `#0b1220` | `#e8ecf2` | Text on cards |
| `--popover` | `#ffffff` | `#172238` | Menus, popovers, dialogs, sheets (lighter than card in dark so rows inside stay visible) |
| `--popover-foreground` | `#0b1220` | `#e8ecf2` | |
| `--primary` | `#0b1220` | `#e8ecf2` | Primary buttons |
| `--primary-foreground` | `#ffffff` | `#0b1220` | Text on primary (18.7:1, 15.8:1) |
| `--secondary` | `#eef1f5` | `#1c2740` | Secondary buttons, selected rows |
| `--secondary-foreground` | `#0b1220` | `#e8ecf2` | |
| `--muted` | `#f1f3f6` | `#162036` | Table headers, user chat bubbles, code blocks |
| `--muted-foreground` | `#5b6474` | `#9aa4b4` | Secondary text (5.6:1 on background, 7.4:1 dark) |
| `--accent` | `#eef1f5` | `#1c2740` | shadcn hover fill (not the brand accent) |
| `--accent-foreground` | `#0b1220` | `#e8ecf2` | |
| `--border` | `#e3e6eb` | `#253049` | Dividers and card edges (decorative) |
| `--input` | `#808a9a` | `#5f6b7e` | Input, checkbox and switch boundaries (3.3:1 on background, 3.2:1 dark) |
| `--ring` | `#2563eb` | `#6b9cff` | Focus ring |
| `--brand` | `#2563eb` | `#6b9cff` | Links, citation chip text, selected tab line, progress fill (5.2:1 on card, 6.5:1 dark) |
| `--brand-foreground` | `#ffffff` | `#0b1220` | Text on brand fills |
| `--brand-soft` | `#eef3fe` | `#15244a` | Citation chip fill, changed-cell fill |
| `--destructive` | `#b91c1c` | `#f87171` | Destructive buttons and field errors |
| `--status-done` | `#157a3a` | `#4ade80` | Done, met, approved, connected |
| `--status-done-soft` | `#ebf6ee` | `#0f2a1c` | Pill fill (4.9:1, 8.8:1) |
| `--status-needs` | `#a34a06` | `#fbbf24` | Needs you, waiting, due soon |
| `--status-needs-soft` | `#fdf3e1` | `#2e2208` | Pill fill (5.4:1, 9.3:1) |
| `--status-working` | `#1d4ed8` | `#93b4ff` | Working, sent, in review |
| `--status-working-soft` | `#eaf0fd` | `#15244a` | Pill fill (5.9:1, 7.4:1) |
| `--status-problem` | `#b91c1c` | `#f87171` | Failed, overdue, not met, blocked |
| `--status-problem-soft` | `#fbeaea` | `#351414` | Pill fill (5.6:1, 6.0:1) |
| `--status-neutral` | `#5b6474` | `#9aa4b4` | Draft, skipped, archived |
| `--status-neutral-soft` | `#f1f3f6` | `#1c2740` | Pill fill (5.4:1, 5.9:1) |
| `--highlight` | `#fff3b0` | `#5c4a00` | Cited sentence in the document viewer (body text keeps 16.7:1, 7.3:1) |
| `--sidebar` | `#f1f3f6` | `#0e1626` | Rail background |
| `--sidebar-foreground` | `#0b1220` | `#e8ecf2` | |
| `--sidebar-accent` | `#e3e8f0` | `#1c2740` | Active rail item |
| `--sidebar-border` | `#e3e6eb` | `#253049` | |
| `--chart-1` | `#2563eb` | `#6b9cff` | First series |
| `--chart-2` | `#0d9488` | `#2dd4bf` | Second series |
| `--chart-3` | `#b45309` | `#fbbf24` | Third series |
| `--chart-4` | `#7c3aed` | `#a78bfa` | Fourth series |
| `--chart-5` | `#64748b` | `#94a3b8` | Other, totals |

Rules: never use a status color for decoration or headings. Red appears only for problems and destructive actions. Status is never shown by color alone ([§22.14](#2214-status-pills)).

### 22.3 Type

| Role | Tailwind | Size and line height | Weight | Use |
|---|---|---|---|---|
| Page title | `text-2xl` (phones `text-xl`) | 1.5rem / 2rem (1.25rem / 1.75rem) | 600 | `h1` |
| Section title | `text-lg` | 1.125rem / 1.75rem | 600 | `h2`, dialog titles, card titles |
| Subsection | `text-base` | 1rem / 1.5rem | 600 | `h3`, table group headers |
| Reading | `text-base` | 1rem / 1.625rem | 400 | Brief facts, chat, document text view, email previews, the draft editor |
| UI body | `text-sm` | 0.875rem / 1.25rem | 400 | Default for controls, tables, lists, descriptions |
| Label | `text-sm` | 0.875rem / 1.25rem | 500 | Form labels, buttons, tabs |
| Caption | `text-xs` | 0.75rem / 1rem | 500 | Pills, timestamps, meta lines. Nothing smaller anywhere. |
| Mono | `font-mono text-[0.8125rem]` | 0.8125rem / 1.25rem | 400 | Codes, API keys, JSON |

Inputs use `text-base` below 48rem (prevents zoom on iOS) and `text-sm` above. Weights are 400, 500 and 600 only; stat tiles may use 600 at `text-2xl`. Reading text is held to `max-w-prose` (65ch).

### 22.4 Spacing and layout

| Item | Value |
|---|---|
| Scale | Tailwind's 0.25rem steps. Use 1, 1.5, 2, 3, 4, 6, 8, 12 only. |
| Page padding | `px-4` below 48rem, `px-6` above. `py-6` at the top of a page. |
| Between sections | `gap-8` |
| Inside a card | `p-4` (`p-3` for compact rows) |
| Form fields | `gap-4` between fields, `gap-1.5` label to input |
| Rail | 15rem, collapsed 4rem |
| Header and phone top bar | 3.5rem |
| Phone bottom tabs | 4rem plus `env(safe-area-inset-bottom)` |
| Assistant panel | 25rem (20 to 35rem) |
| Settings and forms | `max-w-3xl` (48rem) |
| Draft page | `max-w-[51rem]` |
| Bid right rail | 20rem (`w-80`) |
| Split views | List 19 to 26rem as stated per screen, the rest to the detail |

### 22.5 Radius

`--radius: 0.5rem`. Derived: `rounded-sm` 0.375rem (small chips inside inputs), `rounded-md` 0.5rem (buttons, inputs, menus items), `rounded-lg` 0.75rem (cards, popovers, dialogs), `rounded-xl` 1rem (top corners of phone bottom sheets), `rounded-full` (pills, citation chips, score badge, avatars).

### 22.6 Shadow

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shadow-card` | `0 1px 2px rgb(11 18 32 / 0.06)` | none (border only) | Cards |
| `--shadow-popover` | `0 0 0 1px rgb(11 18 32 / 0.06), 0 4px 12px -2px rgb(11 18 32 / 0.12)` | `0 0 0 1px #253049, 0 8px 24px rgb(0 0 0 / 0.5)` | Menus, popovers, hover cards, toasts |
| `--shadow-dialog` | `0 16px 40px -12px rgb(11 18 32 / 0.25)` | `0 0 0 1px #253049, 0 16px 40px rgb(0 0 0 / 0.6)` | Dialogs, sheets |

### 22.7 Motion

150 ms for hover and press, 200 ms for popovers and toasts, 250 ms for dialogs and sheets. Easing `cubic-bezier(0.2, 0, 0, 1)`. With `prefers-reduced-motion: reduce`, no movement: opacity changes only, and the typing dots in chat stay still.

### 22.8 Density

- One density for the app, tuned for laptop work. Table rows 2.5rem. A per-table toggle "Compact rows" (2rem) is stored in `localStorage` key `magpie.density.{table}`.
- On coarse pointers (`@media (pointer: coarse)`), rows are at least 2.75rem and every target is at least 44 by 44px.
- One primary button per region. Secondary actions are outline or ghost buttons. More than three secondary actions go in a menu.
- Lists over 50 rows virtualize (TanStack Virtual).
- No more than two banners. No modal on page load.

### 22.9 Tables

TanStack Table v8 rendered with shadcn `Table` and TanStack Virtual.

| Behavior | Rule |
|---|---|
| Header | Sticky. Sortable headers are buttons with `aria-sort`. Column menu: Sort ascending, Sort descending, Hide, Move left, Move right. |
| Columns | Priority P1 always shows, P2 hides below 64rem, P3 hides below 80rem. "Columns" menu shows and hides. Widths resize by dragging the edge or with the column menu "Wider" and "Narrower". |
| First column | Sticky when the table scrolls sideways. Holds the row's link. |
| Row link | The primary cell holds a real `<a>`; the whole row is clickable through it, so middle-click and open-in-new-tab work. Other cells don't nest links in that anchor. |
| Selection | Checkbox column only when the table has bulk actions. Shift-click selects a range. Header checkbox selects visible rows; a line offers "Select all {n}". |
| Bulk bar | Sticky above the table: "{n} selected", the actions, "Clear". |
| Inline edit | Enter or double-click opens the cell editor. Enter saves, Esc cancels, Tab moves to the next editable cell. |
| Empty value | A blank cell with `aria-label="Not set"`. |
| Loading more | Infinite scroll with a "Load more" button at the end for keyboard and screen reader users. Total count above the table. |
| Phones | Card lists, not tables. Each spec says which fields the card shows. |
| Export | "Export CSV" exports the current view's columns and filters (FR-CRM-8). |

### 22.10 Kanban

`@dnd-kit/core` and `@dnd-kit/sortable`.

| Behavior | Rule |
|---|---|
| Columns | 18rem wide, header sticky inside the column (name, count, sum). Board scrolls sideways; Shift and the wheel scroll it. Collapsed columns are 3rem. |
| Cards | `bg-card`, `rounded-lg`, `p-3`, focusable, open on Enter or click. |
| Drag | Pointer sensor with a 4px threshold; touch sensor with a 250 ms press. A drop line shows where the card lands. |
| Keyboard | Focus a card, Space to pick up, arrow keys to move within and across columns, Space to drop, Esc to cancel. Live announcements: "Picked up {deal}. In {stage}, position {n} of {total}." "Moved to {stage}." "Move canceled." |
| Without dragging | Card menu "Move to" lists every stage (WCAG 2.5.7). |
| Writes | Optimistic, with rollback ([§23.4](#234-optimistic-updates)). Stage rules (Submitted, Lost, No bid) open their dialogs before the write. |
| Phones | One column at a time with a stage select at the top, swiping between columns. Cards move with the "Move to" menu; dragging is off on phones. |

### 22.11 Citation chip

The component that makes principle 3 true. `<CitationChip citation={Citation} />` in `packages/ui`, with `citationHref(citation, context)` in `apps/web/src/lib/citations.ts`.

**`Citation` shape** (zod in `packages/shared`, **(requested)**, discriminated by `kind`):

| `kind` | Fields | Label | Opens |
|---|---|---|---|
| `bid_document` | `documentId`, `page`, `quote` | "{document short title} p. {page}" | Document sheet at the page, sentence highlighted |
| `notice_text` | `opportunityId`, `documentRef`, `page`, `quote` | "{document title} p. {page}" | Notice document reader at the page |
| `url` | `url`, `title` | "{site name}" with an external-link icon | New tab |
| `record` | `recordType`, `recordId`, `field?` | "{record name}" or "Profile: {field label}" | The record |
| `quote` | `quoteId`, `page?`, `quote?` | "{company} quote" | Quote check dialog |
| `past_performance` | `pastPerformanceId` | "Past performance: {title}" | Past performance row |
| `library_item` | `libraryItemId` | "Library: {title}" | Library item |
| `message` | `messageId`, `quote?` | "Email from {sender}" | The message in the bid timeline |
| `award` | `url`, `piid` | "Award {piid}" | New tab |

`bid_requirements.citation`, `bid_deadlines.citation` and `price_lines.citation` keep their stored shape `{documentId, page, quote}`; a missing `kind` means `bid_document`.

**Look.** `rounded-full`, height 1.5rem, `px-2`, `text-xs` weight 500, `--brand` text on `--brand-soft`, a 12px file icon. Document title truncated to 24 characters.

**Behavior.**
- It's a real link (`<a href>` from `citationHref`) so Ctrl-click and middle-click open the full page in a new tab. A plain click is intercepted to open the document sheet: a right sheet at half the viewport on desktop, full screen on phones, with the viewer from [§9.5](#95-documents-tab-and-viewer).
- Hover or focus for 300 ms opens a hover card: document title, "Page {n}", the quoted sentence in quotation marks (up to 300 characters), and "Open page {n}". The hover card can be hovered, and Esc closes it (WCAG 1.4.13).
- Accessible name: "Source: {document title}, page {n}".
- More than three citations on one fact: three chips and a "+{n}" chip that opens a list.
- A citation that no longer resolves renders an outline chip in the problem tone, "Source unavailable", with the tooltip "The document was removed."

### 22.12 Approval card

`<ApprovalCard approval={Approval} density="full" | "compact" | "inline" mode="owner" | "reviewer" />` in `apps/web/src/components/approvals/`.

| Region | Full | Compact (Today, bid rail) | Inline (chat) |
|---|---|---|---|
| Header | Bot icon and name; `title` as `h2`; short code pill; effect pill ("Leaves your business", needs tone, or "Inside Magpie", neutral); related record link; "Asked {relative}"; expiry line | Code, title, Bot, effect, expiry on two lines | As full, `title` as `h3` |
| Reviewer line | "Checked by your Magpie reviewer, {name}, {date}." plus `review_notes` when present | Hidden | Hidden |
| Why | "Why: {preview.why}" | Hidden | Shown |
| Preview | Per kind ([§14.3](#143-preview-kinds)) | Hidden | Collapsed to 8 lines, "Show all" |
| Sources | Citation chips under "Sources" | Hidden | Shown |
| Footer | Primary "Approve", secondary "Edit", ghost "Skip" | Internal: "Approve", "Skip". External: "Review" | As full |

- **Edit** replaces the preview with the kind's edit form; the footer becomes "Approve with changes" and "Cancel edit".
- **Skip** opens a small popover: "Skip this? The Bot won't do it." with an optional "Tell the Bot why" field (sent to the run and stored in `audit_log.data`), and the button "Skip".
- **Decided** replaces the footer with the decided line from [§14.2](#142-approval-detail).
- **Blocked** states disable Approve with a reason line: support session, read-only workspace, suppressed recipient, missing postal address, expired. Viewers see "You can view this but can't approve." and no buttons.
- **Reviewer mode** footer: "Approve and send to owner", "Edit", "Send back to Bot" ([§19.6](#196-reviewer-queue)).
- Container queries (`@container`) switch the header to one column under 28rem, so the same card works in the chat panel and the inbox.
- Keyboard: Ctrl Enter approves when focus is inside the card, after the person has seen the preview (the card must have been focused).

### 22.13 Score badge

`<ScoreBadge score={number} size="sm" | "lg" />`. A `rounded-full` 2rem circle (3rem for `lg`) with the number in 600 weight, plus the band label beside it in `lg` and in the tooltip and accessible name in `sm` ("Score 86, strong").

| Score | Band | Tone |
|---|---|---|
| 80 to 100 | Strong | done |
| 60 to 79 | Good | working |
| 40 to 59 | Fair | neutral |
| 1 to 39 | Weak | neutral, muted text |
| 0 | Not eligible | problem outline, no fill |

### 22.14 Status pills

`<StatusPill tone="neutral" | "working" | "needs" | "done" | "problem" label="…" />`: `rounded-full`, `text-xs` weight 500, a 6px dot in the tone color, the label in the tone color on its soft fill. The label always carries the meaning.

| Enum | Value: label (tone) |
|---|---|
| `opportunity_matches.status` | `new`: New (working). `shown`: Seen (neutral). `saved`: Saved (neutral). `dismissed`: Dismissed (neutral). `pursuing`: Pursuing (done). `expired`: Closed (neutral) |
| Deal stage by `pipeline_stages.category` | `open`: stage name (neutral). `submitted`: stage name (working). `won`: stage name (done). `lost`: stage name (neutral). `no_bid`: stage name (neutral) |
| `deals.bid_decision.decision` | `bid`: Bid (done). `no_bid`: No bid (neutral). `undecided`: Not decided (needs) |
| `approvals.status` | `pending`: Waiting (needs). `approved`: Approved (done). `edited`: Approved with changes (done). `rejected`: Skipped (neutral). `expired`: Expired (neutral). `canceled`: Canceled (neutral). `returned` **(requested)**: Sent back (needs) |
| `approvals.effect` | `external`: Leaves your business (needs). `internal`: Inside Magpie (neutral) |
| `agent_runs.status` | `queued`: Queued (neutral). `running`: Working (working). `waiting_approval`: Waiting for you (needs). `succeeded`: Done (done). `failed`: Failed (problem). `canceled`: Stopped (neutral). `limit_reached`: Hit a limit (needs) |
| `bid_requirements.status` | `open`: Open (neutral). `met`: Met (done). `not_met`: Not met (problem). `not_applicable`: Doesn't apply (neutral) |
| `bid_documents.text_status` | `pending`: Waiting to read (neutral). `ready`: Read (done). `failed`: Couldn't read (problem). `unsupported`: Can't read this type (neutral) |
| `files.scan_status` | `pending`: Checking file (working). `infected`: Removed (problem). `clean`, `skipped`: no pill |
| `quote_requests.status` | `draft`: Draft (neutral). `awaiting_approval`: Waiting for you (needs). `sent`: Sent (working). `replied`: Replied (working). `quoted`: Quoted (done). `declined`: Declined (neutral). `no_response`: No response (needs). `canceled`: Canceled (neutral) |
| `quotes.is_confirmed` | `true`: Checked (done). `false`: Check numbers (needs) |
| `drafts.status` | `draft`: Draft (neutral). `in_review`: In review (working). `approved`: Approved (done). `sent`: Sent (done). `archived`: Archived (neutral) |
| `price_sheets.status` | `draft`: Draft (neutral). `approved`: Approved (done). `superseded`: Replaced (neutral) |
| `messages.status` | `draft`: Draft. `awaiting_approval`: Waiting for you (needs). `queued`: Sending (working). `sent`: Sent (working). `delivered`: Delivered (done). `bounced`: Bounced (problem). `failed`: Failed (problem). `received`: Received (neutral). `canceled`: Canceled (neutral) |
| `tasks.priority` | `high`: High (needs). `normal`: no pill. `low`: Low (neutral) |
| `tasks.status` | `open`: no pill. `done`: Done (done). `canceled`: Canceled (neutral) |
| Contact email `status` | `unknown`: Not checked (neutral). `valid`: Valid (done). `risky`: Risky (needs). `invalid`: Invalid (problem) |
| `field_suggestions.status` | `pending`: Suggested (working). `accepted`: Approved (done). `rejected`: Skipped (neutral). `superseded`: Replaced (neutral) |
| `connections.status` | `active`: Connected (done). `expired`: Needs reconnecting (needs). `revoked`: Disconnected (neutral). `error`: Not working (problem) |
| `channel_bindings` | verified and enabled: Connected (done). `verified_at` null: Not verified (needs). `is_enabled=false`: Off (neutral) |
| `invitations.status` | `pending`: Invited (working). `accepted`: Joined (done). `canceled`: Canceled (neutral). `expired`: Expired (neutral) |
| `subscriptions.status` | `trialing`: Trial (working). `active`: Active (done). `past_due`: Payment failed (problem). `canceled`: Canceled (neutral). `unpaid`: Unpaid (problem). `incomplete`: Incomplete (needs). `paused`: Paused (needs) |
| `tenants.status` | `trialing`: Trial. `active`: Active (done). `past_due`: Payment failed (problem). `suspended`: Suspended (problem). `canceled`: Canceled (neutral). `deleting`: Deleting (problem) |
| `data_exports.status` | `queued`: Queued (neutral). `running`: Building (working). `ready`: Ready (done). `failed`: Failed (problem). `expired`: Expired (neutral) |
| `bots.is_enabled`, `bot_jobs.is_enabled` | On (done), Off (neutral). Learning mode: Learning (working) |

### 22.15 Toasts

Sonner, through one wrapper `toast.success | info | error(message, { action })` in `apps/web/src/lib/toast.ts`.

| Rule | Detail |
|---|---|
| Position | Bottom right on desktop. Bottom center above the tab bar on phones. At most 3 visible. |
| Timing | 4 seconds; 8 seconds with an action; errors stay until closed. Hover or focus pauses the timer. |
| Roles | Success and info `role="status"`; errors `role="alert"`. |
| Copy | A past-tense statement and at most one action ("Undo", "Open bid", "Review"). |
| When not to toast | Validation errors (inline instead), and anything the person can already see change. |
| Live arrivals | Only approvals for me, when I'm not on Approvals: "{Bot} needs your yes: {title}" with "Review". |
| Undo | Only for reversible internal changes: archive, dismiss match, save for later, task done. Never for approval decisions or anything sent. Every undoable action is also reversible elsewhere, so a missed toast loses nothing (WCAG 2.2.1). |

### 22.16 Dialogs, sheets and pages

| Use | When | Examples |
|---|---|---|
| **Page** (own route) | It has a URL people share or come back to, or it's where real work happens | Records, bid tabs, draft editor, run detail, approval detail, import, cancel plan |
| **Side sheet** (right, 28 to 40rem; bottom sheet on phones) | Look at or edit one row while keeping the list in view | Requirement detail, task detail, quote request thread, document sheet from a citation |
| **Dialog** (`max-w-lg`) | One decision or at most 6 fields; returns to where you were | New contact, dismiss match, mark submitted, invite people, edit job |
| **Alert dialog** | Confirming something destructive or hard to undo | Delete, archive with consequences, revoke key, turn off a Bot, schedule deletion |
| **Popover** | A small choice tied to a control | Skip reason, filters, stage menu |

Rules: confirmation titles name the action ("Delete saved search"), never "Are you sure?". The confirm button repeats the verb ("Delete search"). Cancel is always present and focused first for destructive dialogs. Dialogs never stack more than one deep; a dialog needing another becomes a page. Esc closes; focus returns to the control that opened it. Dialogs with more than 4 fields become full-screen pages on phones.

### 22.17 Forms

| Rule | Detail |
|---|---|
| Library | react-hook-form with `@hookform/resolvers/zod`. Input schemas come from `packages/shared` (`<entity>InputSchema`); form-only schemas and mappers live in `apps/web/src/lib/<entity>/form.ts`. |
| Validation | `mode: 'onTouched'`: validate a field on blur, then on change. Submit validates everything. The submit button is never disabled for invalid input; it is disabled only while submitting. |
| Errors | Under the field in `--destructive`, linked with `aria-describedby`, field gets `aria-invalid`. On a failed submit, focus moves to the first invalid field. Forms with more than 6 fields also show "Check the highlighted fields." at the top. |
| Server errors | problem+json `errors: [{ field, code, message }]` maps to `setError`. Unknown fields go to the form-level message. |
| Labels | Above inputs, always visible, never placeholder-only. Mark optional fields "(optional)"; required is the default. |
| Inputs | Money in dollars with thousands separators, stored as cents. Dates with a picker and typed input. Phone formatted as typed, stored E.164. Codes accept paste. |
| Buttons | Dialogs: footer right, primary last. Page forms: bottom left; sticky at the bottom on phones. In-progress labels: "Saving…", "Sending…", "Creating…". |
| Unsaved changes | Leaving a dirty form asks "Leave without saving? Your changes will be lost." with "Leave" and "Stay". |
| Inline edit | Record fields and table cells save on Enter or blur, cancel on Esc, show "Saved" for 2 seconds; errors show inline under the field. |

### 22.18 Autosave for the draft editor

FR-DRF-2: editing never loses work.

| Part | Rule |
|---|---|
| Local copy | Every change writes the TipTap JSON to IndexedDB (`idb-keyval`, key `draft:{userId}:{draftId}`), debounced 500 ms. Cleared on a confirmed server save and on sign-out. |
| Server save | PATCH `/api/app/drafts/$draftId` with `{ content, contentText, baseUpdatedAt }`. Debounced 1 second after the last keystroke, and at most 5 seconds apart while typing continues. One request in flight; newer changes wait and send next. |
| Retries | On failure: retry after 2, 4, 8, 16, then every 30 seconds. "Retry now" in the status. |
| Status text | In the toolbar, `role="status"`: "Saved" (hover shows "Saved at {time}"), "Saving…", "Offline. Your changes are kept on this device.", "Couldn't save. Retrying in {s} s." with "Retry now". Screen readers hear only the change to offline or failing, and back to saved. |
| Versions | A snapshot row in `draft_versions` **(requested)** is created when the person chooses "Save version", when a Bot writes, when status changes, before a restore, and at the first save more than 30 minutes after the last snapshot. Autosave alone never creates a version. |
| Conflict | The server answers `conflict` when `updated_at` moved. Dialog: "This draft changed while you were editing. {name or Bot} saved a newer version." Buttons: primary "Keep both" (saves mine as a new version on top), secondary "Load theirs" (my text stays in a version named "Your unsaved changes, {time}"). Nothing is discarded either way. |
| Bot writing | While a run writes the draft, the editor is read-only with the banner from [§9.9](#99-draft-editor), and updates live from `draft.updated`. |
| Leaving | With unsaved changes, `beforeunload` asks the browser to confirm. On next open, if the IndexedDB copy is newer than the server's, a banner: "You have unsaved changes from {time} on this device." with "Restore them" and "Discard". |
| Multiple editors | No live co-editing in v1. Conflicts are caught by `baseUpdatedAt`. |

### 22.19 Components

From shadcn/ui unless noted. Add a component only when nothing here fits; say why in the pull request.

| Need | Component |
|---|---|
| Buttons, links | `Button` (variants `default` = primary, `secondary`, `outline`, `ghost`, `destructive`, `link`; sizes `sm`, `default`, `lg`, `icon`) |
| Text input | `Input`, `Textarea`, `Label`, `Form` (react-hook-form bindings) |
| Choice | `Select`, `Combobox` (`Command` in `Popover`), `Checkbox`, `RadioGroup`, `Switch`, `ToggleGroup` (segmented controls) |
| Dates | `Calendar` and a date picker built on it; time select |
| Codes | `InputOTP` (6-digit SMS code) |
| Layout | `Sidebar` (rail), `Tabs` (only for in-page panels; route tabs are links styled as tabs), `Separator`, `ScrollArea`, `Resizable` (split views), `Collapsible`, `Accordion` |
| Overlays | `Dialog`, `AlertDialog`, `Sheet`, `Drawer` (vaul, phones), `Popover`, `HoverCard` (citations), `Tooltip`, `DropdownMenu`, `ContextMenu` |
| Feedback | `Sonner` (toasts), `Skeleton`, `Progress`, `Badge` (base for pills and counts), `Alert` (callouts and banners) |
| Data | `Table` with TanStack Table and TanStack Virtual; `Chart` (Recharts) for Usage, Reports and Ops |
| Search | `Command` (Ctrl K palette) |
| People | `Avatar` |
| Not shadcn | TipTap (`@tiptap/react`, StarterKit, Table, Link, Placeholder, plus Magpie's `citation` mark and `comment` mark); `pdfjs-dist` (document viewer); `@dnd-kit/core`, `@dnd-kit/sortable` (kanban and reordering); `react-qr-code` (Telegram connect); `idb-keyval` (draft autosave) |
| Magpie components (`packages/ui`) | `CitationChip`, `ScoreBadge`, `StatusPill`, `Empty`, `RegionError`, `Banner`, `PageHeader`, `SettingsSection`, `SettingsRow`, `MoneyInput`, `PhoneInput`, `TimezoneSelect`, `CountdownPill`, `BotIcon` |
| Magpie components (`apps/web`) | `ApprovalCard`, `DocumentViewer`, `DocumentSheet`, `KanbanBoard`, `RecordDetails`, `Timeline`, `ChatPanel`, `DraftEditor`, `PriceSheetTable`, `SearchFilters` |
## 23. Data access

### 23.1 Structure and rules

```
apps/web/src/
  lib/
    client.ts          the only fetch in the app
    query-client.ts    the one QueryClient, imported everywhere
    events.ts          the event stream and the event-to-key map
    errors.ts          problem code to copy (§2.3)
    toast.ts           toast wrapper (§22.15)
    <entity>/
      queries.ts       read types, <entity>Keys, queryOptions factories
      mutations.ts     input types, mutationOptions factories
      form.ts          form schemas and mappers
```

| Rule | Detail |
|---|---|
| One client | `client<TResult>(path, { method, body, signal, fallback })` prefixes `/api/app`, sends `credentials: 'include'`, serializes `body` (callers pass objects, never strings), parses JSON, and turns problem+json into `ApiError { status, code, title, detail, errors, params }`. `tryClient` returns the `Response` without throwing, for calls where a refusal is the answer. A component never calls `fetch`. |
| Reads | Every cached read is a `queryOptions` (or `infiniteQueryOptions`) factory named `<subject>QueryOptions` in `lib/<entity>/queries.ts`. The `queryFn` has an explicit return type and unwraps the envelope. |
| Keys | One `<entity>Keys` factory per entity in `queries.ts`. `all` is the bare entity name and the invalidation root. List parameters go in a trailing object. Arrays are `as const`. No inline keys anywhere. |
| Writes | Every write is a `mutationOptions` factory named `<verb><Entity>MutationOptions(queryClient)` in `mutations.ts`, with one parameter (a value or a named `variables` object). On success it invalidates; it never patches the cache, except the optimistic cases in [§23.4](#234-optimistic-updates). |
| One QueryClient | Constructed once in `query-client.ts`, given to `QueryClientProvider` and the router context. Import it; don't call `useQueryClient()`. |
| Routes | Data that decides whether a page can open is loaded in `beforeLoad` or `loader` with `context.queryClient.ensureQueryData(<factory>)`, sharing the component's factory. |
| Branches | Components branch pending, error, empty, data, in that order ([§4](#4-how-to-read-a-screen-spec)). |
| Permissions | Read types carry the server's verdicts (`permissions` on `me`, and per-record flags such as `canEdit`, `canDecide`). The browser never recomputes them. |
| Secrets | Never in a read type. A stored key is `{ hasKey: true, addedAt }`. |
| Chat streaming | The one exception to "every request through `client`": AI SDK `useChat` with `DefaultChatTransport` posting to `/api/app/threads/$threadId/messages`, created in `lib/chat/transport.ts` with the same credentials and error mapping. |
| Uploads | `lib/files/upload.ts`: ask the API for a presigned URL (`POST /api/app/files/uploads`), PUT the file to R2 with progress, then `POST /api/app/files/$fileId/complete`. The PUT is the second allowed direct request and lives only in that file. |

**Defaults** (`query-client.ts`): `staleTime` 30 seconds (5 minutes for catalogs: plans, tools, pipelines, fields, tags; 10 minutes for notices), `gcTime` 5 minutes, query retry up to 2 times but never on a 4xx, mutation retry 0, `refetchOnWindowFocus` only while the event stream is disconnected.

**Workspace switch.** Call Better Auth's set-active-organization, then `queryClient.clear()`, close and reopen the event stream, and navigate to `/today`. Events whose `tenantId` isn't the active workspace are dropped. No tenant id in query keys: clearing on switch keeps workspaces apart.

**Sign-out.** `queryClient.clear()`, close the stream, clear IndexedDB drafts for the person, go to `/sign-in`.

### 23.2 Query keys and endpoints

Every path is under `/api/app` and is **(requested)** for API.md with these shapes; API.md wins on naming if it differs, and the factories adapt.

| Entity dir | Keys | Endpoint |
|---|---|---|
| `me` | `["me"]` | `GET /me` (person, memberships, active workspace, role, `permissions`, plan features, banners state) |
| `workspace` | `["workspace","settings"]` | `GET /workspace/settings`, `PATCH /workspace/settings` |
| `profile` | `["company-profile"]` | `GET /company-profile`, `PATCH /company-profile`, `POST /company-profile/lookup` (UEI or name), `POST /company-profile/refresh` |
| `past-performance` | `["past-performance","list"]`, `["past-performance","detail",id]` | `GET/POST /past-performance`, `PATCH/DELETE /past-performance/$id` |
| `library` | `["library","list",{kind}]` | `GET/POST /library`, `PATCH/DELETE /library/$id` |
| `onboarding` | `["onboarding"]`, `["onboarding","suggested-searches"]` | `GET/PATCH /onboarding`, `GET /onboarding/suggested-searches` |
| `today` | `["today"]` | `GET /today` |
| `search` | `["search",{q}]` | `GET /search?q=` |
| `matches` | `["matches","list",{status,searchId,minScore,due,setAside,state,source,ineligible,q,sort}]`, `["matches","detail",matchId]`, `["matches","counts"]` | `GET /matches`, `GET /matches/$id`, `GET /matches/counts`, `POST /matches/$id/pursue`, `POST /matches/$id/save`, `POST /matches/$id/dismiss`, `POST /matches/$id/restore`, `POST /matches/bulk` |
| `notices` | `["notices","search",{filters,page}]`, `["notices","detail",opportunityId]`, `["notices","document",opportunityId,documentRef]` | `GET /notices`, `GET /notices/$id`, `GET /notices/$id/documents/$ref`, `POST /notices/$id/pursue`, `POST /notices/$id/save` |
| `market` | `["market","sources"]` | `GET /market/sources` |
| `searches` | `["searches","list"]`, `["searches","preview",{filters}]` | `GET/POST /searches`, `PATCH/DELETE /searches/$id`, `POST /searches/$id/scan`, `POST /searches/preview` |
| `bids` | `["bids","list",{tab,owner,due,stage,tag,sort}]`, `["bids","detail",dealId]`, `["bids","brief",dealId,{version}]`, `["bids","requirements",dealId,{filters}]`, `["bids","deadlines",dealId]`, `["bids","documents",dealId]`, `["bids","document",documentId]`, `["bids","document-page",documentId,{page}]` | `GET/POST /bids`, `GET/PATCH /bids/$dealId`, `GET /bids/$dealId/brief`, `POST /bids/$dealId/brief/rerun`, `PUT /bids/$dealId/decision`, `GET/POST /bids/$dealId/requirements`, `PATCH/DELETE /bids/$dealId/requirements/$id`, `POST /bids/$dealId/requirements/bulk`, `GET/POST /bids/$dealId/deadlines`, `PATCH/DELETE /bids/$dealId/deadlines/$id`, `GET/POST /bids/$dealId/documents`, `GET /bids/$dealId/documents/$id` (with presigned URL), `GET /bids/$dealId/documents/$id/pages/$page`, `POST /bids/$dealId/submission`, `POST /bids/$dealId/exports`, `GET /bids/$dealId/calendar.ics` |
| `pricing` | `["price-sheets","list",dealId]`, `["price-sheets","detail",priceSheetId]`, `["award-comparables",dealId]` | `GET/POST /bids/$dealId/price-sheets`, `GET /price-sheets/$id`, `POST /price-sheets/$id/lines`, `PATCH/DELETE /price-lines/$id`, `POST /price-sheets/$id/approve`, `POST /price-sheets/$id/copy`, `GET /bids/$dealId/award-comparables` |
| `quotes` | `["quote-requests","list",dealId]`, `["quote-requests","detail",quoteRequestId]`, `["quotes","list",dealId]`, `["sub-suggestions","list",dealId]` | `GET /bids/$dealId/quote-requests`, `POST /bids/$dealId/quote-requests/draft`, `GET/PATCH /quote-requests/$id`, `POST /quote-requests/$id/follow-up`, `GET /bids/$dealId/quotes`, `PATCH /quotes/$id`, `POST /quotes/$id/confirm`, `POST /quotes/$id/use`, `GET /bids/$dealId/sub-suggestions`, `POST /bids/$dealId/sub-suggestions/find`, `PATCH /sub-suggestions/$id` |
| `drafts` | `["drafts","list",{dealId}]`, `["drafts","detail",draftId]`, `["drafts","versions",draftId]`, `["drafts","version",draftId,version]`, `["drafts","comments",draftId]` | `GET/POST /drafts`, `GET/PATCH /drafts/$id`, `POST /drafts/$id/versions`, `GET /drafts/$id/versions/$version`, `POST /drafts/$id/restore`, `GET/POST /drafts/$id/comments`, `PATCH /draft-comments/$id`, `POST /drafts/$id/exports`, `POST /bids/$dealId/drafts/generate` |
| `deals` | `["deals","list",{pipelineId,viewId,filters,sort,layout}]`, `["deals","detail",dealId]` | `GET/POST /deals`, `GET/PATCH /deals/$id`, `POST /deals/$id/stage`, `POST /deals/bulk` |
| `pipelines` | `["pipelines"]` | `GET/POST /pipelines`, `PATCH /pipelines/$id`, `POST/PATCH/DELETE /pipelines/$id/stages[/$stageId]` |
| `companies` | `["companies","list",{viewId,kind,filters,sort}]`, `["companies","detail",companyId]` | `GET/POST /companies`, `GET/PATCH /companies/$id`, `POST /companies/merge`, `POST /companies/bulk` |
| `contacts` | `["contacts","list",{viewId,filters,sort}]`, `["contacts","detail",contactId]` | `GET/POST /contacts`, `GET/PATCH /contacts/$id`, `POST /contacts/merge`, `POST /contacts/bulk` |
| `tasks` | `["tasks","list",{assignee,status,priority,recordType,due,viewId}]` | `GET/POST /tasks`, `PATCH /tasks/$id` |
| `notes` | `["notes",recordType,recordId]` | `GET/POST /notes?recordType=&recordId=`, `PATCH/DELETE /notes/$id` |
| `timeline` | `["timeline",recordType,recordId,{types}]` (infinite) | `GET /timeline?recordType=&recordId=&types=&cursor=` |
| `record-history` | `["record-history",recordType,recordId]` | `GET /record-history?recordType=&recordId=` |
| `field-suggestions` | `["field-suggestions",recordType,recordId]` | `GET /field-suggestions?...`, `POST /field-suggestions/$id/decision` |
| `files` | `["files",recordType,recordId]` | `GET /files?...`, `POST /files/uploads`, `POST /files/$id/complete`, `DELETE /file-links` |
| `views` | `["views",object]` | `GET/POST /views?object=`, `PATCH/DELETE /views/$id` |
| `fields` | `["fields",object]` | `GET/POST /fields?object=`, `PATCH /fields/$id` |
| `tags` | `["tags"]` | `GET/POST /tags`, `PATCH/DELETE /tags/$id` |
| `imports` | `["imports","detail",importId]` | `POST /imports`, `GET /imports/$id`, `PATCH /imports/$id` (mapping), `POST /imports/$id/start` |
| `bots` | `["bots","list"]`, `["bots","detail",botId]`, `["bot-jobs",botId]`, `["tool-policies",botId]`, `["tools"]` | `GET /bots`, `GET/PATCH /bots/$id`, `GET /bots/$id/jobs`, `PATCH /bot-jobs/$id`, `POST /bot-jobs/$id/run`, `GET /bots/$id/tool-policies`, `PUT /bots/$id/tool-policies/$toolKey`, `GET /tools` |
| `runs` | `["runs","list",{botId,status,trigger,from,to}]`, `["runs","detail",runId]`, `["runs","steps",runId]` | `GET /runs`, `GET /runs/$id`, `GET /runs/$id/steps`, `POST /runs/$id/cancel` |
| `approvals` | `["approvals","list",{tab,effect,botId,for,record}]`, `["approvals","detail",approvalId]`, `["approvals","count"]` | `GET /approvals`, `GET /approvals/$id`, `GET /approvals/count`, `POST /approvals/$id/decision` (`{ decision: 'approve' \| 'skip', editedArgs?, note? }`), `POST /approvals/bulk-decision` (internal only) |
| `threads` | `["threads","list"]`, `["threads","messages",threadId]` | `GET/POST /threads`, `GET /threads/$id/messages`, `POST /threads/$id/messages` (stream) |
| `memories` | `["memories",{about,kind,review,q}]` | `GET/POST /memories`, `PATCH/DELETE /memories/$id` |
| `notifications` | `["notifications","list",{filter}]` (infinite), `["notifications","unread"]` | `GET /notifications`, `POST /notifications/read` (ids or all) |
| `channels` | `["channels"]`, `["notification-preferences"]` | `GET /channels`, `POST /channels/sms/start`, `POST /channels/sms/verify`, `POST /channels/telegram/link`, `DELETE /channels/$id`, `POST /channels/web-push`, `GET/PATCH /notification-preferences` |
| `connections` | `["connections"]` | `GET /connections`, `POST /connections/$provider/start`, `DELETE /connections/$id`, `PUT /connections/keys/$provider`, `DELETE /connections/keys/$provider` |
| `members` | `["members"]`, `["invitations"]` | `GET /members`, `PATCH/DELETE /members/$id`, `GET/POST /invitations`, `POST /invitations/$id/resend`, `DELETE /invitations/$id` |
| `account` | `["sessions"]`, `["calendar-feed"]` | `GET /sessions`, `POST /sessions/revoke-all`, `GET/POST /calendar-feed` (POST resets) |
| `billing` | `["billing","subscription"]`, `["billing","plans"]`, `["usage",{period}]` | `GET /billing/subscription`, `GET /billing/plans`, `POST /billing/checkout`, `POST /billing/portal`, `POST /billing/run-packs`, `POST /billing/cancel`, `POST /billing/resume`, `GET /usage?period=` |
| `api-keys` | `["api-keys"]` | `GET/POST /api-keys`, `DELETE /api-keys/$id` |
| `webhooks` | `["webhooks","list"]`, `["webhooks","deliveries",endpointId]` | `GET/POST /webhooks`, `PATCH/DELETE /webhooks/$id`, `GET /webhooks/$id/deliveries`, `POST /webhook-deliveries/$id/resend` |
| `audit` | `["audit",{actor,bot,action,from,to}]` (infinite) | `GET /audit` |
| `exports` | `["exports",{kind,dealId}]` | `GET/POST /exports`, `GET /exports/$id/download` |
| `workspace-lifecycle` | none (writes only) | `POST /workspace/transfer`, `POST /workspace/deletion`, `DELETE /workspace/deletion` |
| `reports` (v1) | `["reports","list"]`, `["reports","detail",reportId]`, `["reports","widget",widgetId,{range}]`, `["reports","bids",{range}]` | `GET/POST /reports`, `GET/PATCH/DELETE /reports/$id`, `POST/PATCH/DELETE /reports/$id/widgets[/$widgetId]`, `GET /report-widgets/$id/data`, `GET /reports/bids` |
| `automations` (v1) | `["automations","list"]`, `["automations","detail",id]`, `["automations","runs",id]` | `GET/POST /automations`, `GET/PATCH /automations/$id`, `GET /automations/$id/runs` |
| `ops` (v1) | `["ops","tenants",{filters}]`, `["ops","tenant",tenantId]`, `["ops","costs",{from,to}]`, `["ops","flags"]`, `["ops","review",{tab}]`, `["ops","review-stats"]` | `/api/ops/*` (staff session; `magpie_ops` pool, every read audited) |

Public routes outside `/api/app`: `GET /calendar/$token.ics` (deadline feed), `POST /u/$token` (unsubscribe), `GET /s/$code` (resolved by the web route, which calls `GET /api/app/short-links/$code`).

### 23.3 Realtime events and invalidation

`GET /api/app/events` is an `EventSource` (ARCHITECTURE §9). Each message: `id` = `domain_events.id`, `event: domain`, `data: { id, type, tenantId, payload, createdAt }`. The server also sends `event: ping` every 25 seconds and `event: reset` when `Last-Event-ID` is older than the 7-day replay window (the client then invalidates everything). Reconnect with backoff 1, 2, 5, 10, then every 30 seconds.

The map lives in `packages/shared/src/events.ts` (types and payloads) and `apps/web/src/lib/events.ts` (invalidations). The five names in ARCHITECTURE §9 are kept as they are; the rest are **(requested)**. Payloads carry ids only, never record content.

| Event `type` | Payload | Invalidates |
|---|---|---|
| `deal.created` | `dealId, kind` | `bids.list`, `deals.list`, `today` |
| `deal.updated` | `dealId, kind, fields[]` | `bids.detail(dealId)`, `deals.detail(dealId)`, `bids.list`, `deals.list`, `today` |
| `deal.stage_changed` | `dealId, fromStageId, toStageId` | as `deal.updated`, plus `timeline("deal", dealId)` |
| `deal.archived` | `dealId` | `bids.list`, `deals.list`, `today` |
| `company.created`, `company.updated`, `company.archived`, `company.merged` | `companyId, mergedIntoId?` | `companies.list`, `companies.detail(companyId)` |
| `contact.created`, `contact.updated`, `contact.archived`, `contact.merged` | `contactId, mergedIntoId?` | `contacts.list`, `contacts.detail(contactId)` |
| `task.created`, `task.updated` | `taskId, recordType?, recordId?` | `tasks.list`, `today`, `bids.detail(recordId)` when the record is a deal |
| `note.created`, `note.updated` | `noteId, recordType, recordId` | `notes(recordType, recordId)`, `timeline(recordType, recordId)` |
| `activity.created` | `activityId, links: [{recordType, recordId}]` | `timeline` for each link |
| `field_suggestion.created`, `field_suggestion.decided` | `recordType, recordId` | `field-suggestions(recordType, recordId)`, the record's detail |
| `match.created` | `matchId, searchId` | `matches.list`, `matches.counts`, `today` |
| `match.updated` | `matchId, status, dealId?` | `matches.detail(matchId)`, `matches.list`, `matches.counts`, `today` |
| `search.updated`, `search.scanned` | `searchId` | `searches.list` |
| `bid_document.updated` | `dealId, documentId, textStatus, scanStatus` | `bids.documents(dealId)`, `bids.document(documentId)`, `bids.brief(dealId)` |
| `bid.brief_updated` | `dealId, briefId, status` | `bids.brief(dealId)`, `bids.detail(dealId)`, `today` |
| `bid.requirements_updated` | `dealId` | `bids.requirements(dealId)`, `bids.detail(dealId)` |
| `bid.deadlines_updated` | `dealId` | `bids.deadlines(dealId)`, `bids.list`, `today` |
| `submission.created` | `dealId` | `bids.detail(dealId)` |
| `price_sheet.updated` | `dealId, priceSheetId` | `price-sheets.list(dealId)`, `price-sheets.detail(priceSheetId)` |
| `award_comparables.updated` | `dealId` | `award-comparables(dealId)` |
| `quote_request.updated` | `dealId, quoteRequestId` | `quote-requests.list(dealId)`, `quote-requests.detail(quoteRequestId)` |
| `quote.received`, `quote.updated` | `dealId, quoteId` | `quotes.list(dealId)`, `today`, `bids.detail(dealId)` |
| `sub_suggestions.updated` | `dealId` | `sub-suggestions.list(dealId)` |
| `message.received` | `messageId, dealId?, quoteRequestId?` | `quote-requests.detail(quoteRequestId)`, `timeline("deal", dealId)` |
| `draft.updated` | `draftId, dealId, updatedAt, runId?` | `drafts.list({dealId})`; `drafts.detail(draftId)` unless `updatedAt` equals the editor's own last save |
| `draft.version_created` | `draftId, version` | `drafts.versions(draftId)` |
| `draft.comment_created` | `draftId` | `drafts.comments(draftId)` |
| `approval.requested` | `approvalId, requestedForUserId, effect, recordType?, recordId?` | `approvals.list`, `approvals.count`, `today`, `bids.detail(recordId)`; toast when for me ([§22.15](#2215-toasts)) |
| `approval.decided` | `approvalId, status, via` | `approvals.detail(approvalId)`, `approvals.list`, `approvals.count`, `today`, `runs.detail(runId)` |
| `approval.expired` | `approvalId` | as `approval.decided` |
| `run.updated` | `runId, botId, status` | `runs.detail(runId)`, `runs.steps(runId)`, `runs.list`, `bots.list`; `today` when finished |
| `thread.message_created` | `threadId, messageId` | `threads.list`; `threads.messages(threadId)` unless that thread is streaming in this tab |
| `notification.created` | `notificationId, userId, kind` | `notifications.list`, `notifications.unread` |
| `bot.updated`, `bot_job.updated` | `botId` | `bots.list`, `bots.detail(botId)`, `bot-jobs(botId)` |
| `tool_policy.updated` | `botId, toolKey` | `tool-policies(botId)` |
| `memory.updated` | `memoryId` | `memories` |
| `channel.updated` | `userId, channel` | `channels` (only for me) |
| `connection.updated` | `connectionId` | `connections` |
| `membership.updated`, `invitation.updated` | `userId?` | `members`, `invitations`; `me` when it's me |
| `settings.updated` | `keys[]` | `workspace.settings`, `me` |
| `company_profile.updated` | | `company-profile`, `today` |
| `library_item.updated` | `libraryItemId` | `library`, `today` |
| `past_performance.updated` | `pastPerformanceId` | `past-performance` |
| `pipeline.updated` | `pipelineId` | `pipelines`, `deals.list` |
| `field_definition.updated` | `object` | `fields(object)` |
| `tag.updated` | `tagId` | `tags` |
| `view.updated` | `object` | `views(object)` |
| `import.updated` | `importId, status, processed, total` | `imports.detail(importId)`; on finish `contacts.list` or `companies.list` |
| `export.updated` | `exportId, kind, status, dealId?` | `exports` |
| `usage.threshold_reached` | `key, percent` | `usage`, `me` |
| `subscription.updated` | | `billing.subscription`, `usage`, `me` |
| `report.updated`, `automation.updated` (v1) | `reportId` or `automationId` | the matching list and detail |

### 23.4 Optimistic updates

Allowed only where the server computes nothing the person would see differently, and a rollback is clear:

| Write | Optimistic change |
|---|---|
| Move a deal card to an open stage | Card moves to the new column |
| Task done or not done | Checkbox and grouping |
| Requirement status, owner, position | The row |
| Notification read, mark all read | Dot and unread state |
| Match save for later, dismiss, restore | Row leaves or returns to the tab |
| Approval decision | Item leaves Waiting; count drops by one |
| Switches: Bot job on or off, saved search active, Bot on or off (after its confirmation) | The switch |
| Reorder: stages, price lines, fields, widgets | The order |

Pattern, in the mutation factory:

```ts
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: dealKeys.all });
  const snapshot = queryClient.getQueriesData({ queryKey: dealKeys.all });
  queryClient.setQueriesData({ queryKey: dealKeys.all }, (data) => moveCard(data, variables));
  return { snapshot };
},
onError: (_error, _variables, context) => {
  context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
  toast.error(t`Couldn't move ${variables.dealName}. It's back in ${variables.fromStageName}.`);
},
onSettled: () => queryClient.invalidateQueries({ queryKey: dealKeys.all }),
```

Never optimistic: creates (ids come from the server), price totals (previewed only, [§9.6](#96-pricing-tab)), anything sent outside the business, billing, roles, tool policies, deletes.

### 23.5 Lists, prefetch and freshness

- Lists use cursor pagination (`?cursor=&limit=50`) and `infiniteQueryOptions`. The response is `{ items, nextCursor, total }`.
- Hovering a row link for 150 ms prefetches the detail factory.
- Route loaders prefetch the first tab of a page (`/bids/$dealId` loads `bids.detail` and `bids.brief` together).
- Notices and plans are global; they're never invalidated by events and use longer stale times.

## 24. Accessibility

Target: WCAG 2.2 AA (PRD §7). Each criterion below names how Magpie meets it.

| Criterion | How |
|---|---|
| 1.1.1 Non-text content | Icon-only buttons have `aria-label`. Charts have "Show as table". The logo has alt text "Magpie". Decorative icons are `aria-hidden`. |
| 1.3.1 Info and relationships | Landmarks: `nav` (Main), `header`, `main`, `aside` (Assistant). One `h1` per page, headings in order. Tables use `th` with `scope`. Radio groups in `fieldset` with `legend`. Definition lists for key facts. |
| 1.3.4 Orientation | Works in portrait and landscape. |
| 1.3.5 Identify input purpose | `autocomplete` on name, email, organization, tel, current-password, new-password, one-time-code. |
| 1.4.1 Use of color | Status pills, score bands, diffs, due tones and required fields all carry text. |
| 1.4.3 Contrast (minimum), 1.4.11 Non-text contrast | Token pairs in [§22.2](#222-color), checked by a unit test. Focus ring 3:1 against both backgrounds. |
| 1.4.4 Resize text, 1.4.10 Reflow | Everything in rem. At 320 CSS px wide no page needs sideways scrolling except data tables, the kanban board, the document viewer and the draft page, which scroll inside their own region. |
| 1.4.12 Text spacing | No fixed heights on text containers; clamped text expands on demand. |
| 1.4.13 Content on hover or focus | Hover cards and tooltips can be hovered, stay until moved away, and close with Esc. |
| 2.1.1 Keyboard | Every action works by keyboard: kanban ([§22.10](#2210-kanban)), reordering (Move up and down), document viewer, draft editor, citation chips, approval cards. |
| 2.1.2 No keyboard trap | Dialogs and sheets trap focus on purpose and release on Esc or close. The editor releases with Esc then Tab. |
| 2.1.4 Character key shortcuts | Single-key shortcuts (A, S, E, J, K) work only while the approvals list has focus, and can be turned off in Your account. Global shortcuts use Ctrl or Cmd. |
| 2.2.1 Timing adjustable | Toasts pause on hover and focus; actions in toasts are available elsewhere. Sessions last 30 days. SMS codes last 10 minutes with "Send a new code". |
| 2.3.1 Three flashes | Nothing flashes. |
| 2.4.1 Bypass blocks | "Skip to content" link. |
| 2.4.2 Page titled | "{page} \| {workspace} \| Magpie" ([§4](#4-how-to-read-a-screen-spec)). |
| 2.4.3 Focus order | DOM order matches visual order. After closing a dialog or sheet, focus returns to the control that opened it. After a route change, focus moves to the `h1`. |
| 2.4.6 Headings and labels | Headings describe their section; every input has a visible label. |
| 2.4.7 Focus visible | 2px `--ring` outline with 2px offset on every focusable element (`focus-visible`). |
| 2.4.11 Focus not obscured | `scroll-padding-top` and `scroll-padding-bottom` match the sticky header, bulk bars and bottom tabs. Toasts never cover the focused element. |
| 2.5.3 Label in name | Accessible names start with the visible label ("Approve A7"). |
| 2.5.7 Dragging movements | Every drag has a button or menu alternative. |
| 2.5.8 Target size (minimum) | At least 24 by 24 CSS px everywhere; 44 by 44 on coarse pointers. Citation chips are 24px tall. |
| 3.1.1 Language of page | `<html lang="en-US">`, set from the active locale. |
| 3.2.6 Consistent help | "Help" sits in the same place on every page (You menu, More sheet on phones, footer of public pages). |
| 3.3.1 Error identification, 3.3.3 Error suggestion | Errors say what's wrong and how to fix it, in text, next to the field. |
| 3.3.2 Labels or instructions | Formats shown in helper text ("12 letters and numbers"). |
| 3.3.4 Error prevention (legal, financial, data) | External sends show the full preview first; billing changes, cancel, transfer and delete have a confirmation step; deletion can be canceled for 30 days. |
| 3.3.7 Redundant entry | Onboarding prefills from SAM.gov; forms keep values on error; the import wizard remembers the mapping. |
| 3.3.8 Accessible authentication (minimum) | No puzzles. Paste works in password and code fields. Password managers work. Magic link, Google and Microsoft are alternatives. WebOTP and `one-time-code` fill SMS codes. |
| 4.1.2 Name, role, value | Radix primitives for widgets. Custom components (kanban, citation chip, score badge, document viewer) set roles and states explicitly. |
| 4.1.3 Status messages | Toasts, save status, "Reconnecting…", loading text and live counts use `role="status"` or `aria-live="polite"`; errors use `role="alert"`. |

**Testing.** `@axe-core/playwright` on every route in light and dark, failing on serious or critical issues. Keyboard-only Playwright flows: sign in, pursue a match, approve and skip, move a card, change a requirement status, edit and save a draft, verify a phone. Each release: manual VoiceOver with Safari on iPhone and Mac, and NVDA with Firefox on Windows, through the same flows. Reduced-motion and 200% zoom checks on Today, the bid workspace and Approvals.

## 25. Responsive layout, PWA and web push

### 25.1 Breakpoints

Tailwind v4 defaults, in rem.

| Name | Min width | Layout |
|---|---|---|
| base | 0 | Phone: top bar, bottom tabs, card lists, bottom sheets. Tested from 360px (PRD §7). |
| `sm` | 40rem (640px) | Phone landscape and small tablets: two-column forms, wider cards |
| `md` | 48rem (768px) | Tablet: icon rail replaces bottom tabs, tables replace cards (P1 and P2 columns), Assistant as an overlay sheet |
| `lg` | 64rem (1024px) | Desktop: full rail, docked Assistant panel available, split views (Approvals, Documents), record pages in two columns |
| `xl` | 80rem (1280px) | Wide: P3 columns, Today in two columns, bid right rail |
| `2xl` | 96rem (1536px) | Assistant panel open by default on first visit |

Components that live in panels of different widths (approval card, record details, chat messages) use container queries (`@container`) instead of viewport breakpoints.

### 25.2 PWA

| Item | Detail |
|---|---|
| Plugin | `vite-plugin-pwa` (Workbox), `registerType: 'prompt'` |
| Manifest | `name` "Magpie", `short_name` "Magpie", `start_url` "/today", `scope` "/", `display` "standalone", `background_color` "#f7f8fa", `theme_color` "#f7f8fa" (meta `theme-color` switches to "#0b1220" in dark), icons from `brand/magpie.svg` at 192, 512 and 512 maskable, Apple touch icon 180 |
| Shortcuts | Approvals (`/approvals`), Bids (`/bids`), Chat (`/chat`) |
| Caching | Precache the app shell and static assets only. API responses are never cached by the service worker, so workspace data never stays on a shared device. |
| Offline | Navigations while offline show `/offline`: `h1` "You're offline", "Magpie needs a connection to load your workspace. Pages you already opened still work.", button "Try again". The header shows the offline line from [§2.3](#23-shared-copy). |
| Updates | When a new version is waiting: toast "A new version of Magpie is ready." with "Reload". Never reloads by itself, so an open draft isn't interrupted. |
| Sign-out | Clears IndexedDB drafts and unsubscribes this device's push subscription for that workspace. |

### 25.3 Install prompt

- Shown on phones only, at most once every 30 days, and never during onboarding steps 1 to 4 or when already installed (`display-mode: standalone`).
- Trigger: the person's second session on a phone, or right after they decide their first approval on a phone browser.
- Chromium (has `beforeinstallprompt`): a card at the top of Today or Approvals. Title "Add Magpie to your home screen". Body "Open approvals and bids in one tap, and get notifications." Buttons "Add to home screen" (calls `prompt()`) and "Not now".
- iOS Safari: same card and trigger. Body "Tap the Share button, then Add to Home Screen." Button "Got it".

### 25.4 Web push

**Asking** (FR-CH-8). Never on page load. Only after a click:
- the switch "Get notifications in this browser" in Channels and alerts, or
- a card on Today and Approvals for people with no text or Telegram channel: title "Get a notification when a Bot needs your yes", body "Magpie only notifies you about approvals, deadlines and alerts you choose.", buttons "Turn on notifications" and "Not now" (hidden for 30 days).

On iPhone and iPad the card appears only when installed (iOS 16.4 and later). In Safari tabs the switch is replaced by: "On iPhone, add Magpie to your home screen first. Then you can turn on notifications." If permission is denied: "Notifications are blocked in your browser settings. Turn them on there, then try again."

Success writes `channel_bindings` with `channel='web_push'`, the endpoint as `address`, the keys in `push_subscription`, and `label` from the browser and OS ("Chrome on Mac").

**Payloads.** `{ title, body, tag, url, approvalId?, actions? }`. Title at most 50 characters, body at most 120. `tag` is the notification's `dedupe_key`, so updates replace earlier ones.

| Kind | Title | Body | Actions |
|---|---|---|---|
| Approval, internal | "{Bot} needs your yes" | `{title}` | "Approve", "Skip" |
| Approval, external | "{Bot} needs your yes" | `{title}` | none (tap opens the card, principle 4) |
| Deadline | "Due in {2 hours}: {bid}" | "{kind label} at {time}." | none |
| Quote received | "{company} quoted {amount}" | "For {bid}. Check the numbers." | none |
| Run finished | "{Bot} finished" | `output_summary` | none |
| Alert | "Usage alert" or "Payment failed" | the SMS text without "Magpie:" and the link | none |

Action buttons post from the service worker to `POST /api/app/approvals/$id/decision` with the session cookie (`decided_via='web'`). If that fails (signed out, already decided), the worker opens the approval page instead.

## 26. Internationalization

US English at launch (PRD §7). Everything is ready for French and Spanish.

| Rule | Detail |
|---|---|
| Library | Lingui v5: `@lingui/core`, `@lingui/react`, `@lingui/vite-plugin`, and the macro (`t`, `<Trans>`, `plural`, `select`). **(requested)** for ARCHITECTURE §3, which names no i18n library. |
| Catalogs | PO files. Web: `apps/web/src/locales/{locale}/messages.po`. Server-rendered text (SMS, Telegram, email, push, server-side copy): `packages/shared/src/i18n/locales/{locale}/messages.po`. Compiled at build. Locales: `en-US` now; `fr`, `es` later. |
| No raw strings | ESLint `lingui/no-unlocalized-strings` on `apps/web/src` and the template folders. Test ids, routes, enum values, CSS classes and log messages are exempt. |
| Whole sentences | Never build a sentence from pieces. Plurals with ICU: `{count, plural, one {# bid} other {# bids}}`. Placeholders are named (`{bidName}`), with translator comments for anything ambiguous. |
| Server errors | problem+json carries `code` and `params`. The browser renders copy from its own catalog by code ([§2.3](#23-shared-copy)) and shows `detail` only for unknown codes. |
| Locale | `users.locale` **(requested)**, default `en-US`. Server text for a person uses their locale. `<html lang>` follows the active locale. |
| Formatting | All dates, times, numbers and money through helpers in `packages/shared/src/format.ts` built on `Intl`: `formatMoney(cents, currency)`, `formatDate`, `formatTime`, `formatDeadline(at, deadlineTimezone, viewerTimezone)`, `formatRelative`, `formatRange`. Each takes `{ locale, timezone, style: 'web' \| 'sms' }`. `sms` style keeps output GSM-7 (normal spaces, no narrow no-break space). |
| Layout | Text can grow 30% without breaking: no fixed-width buttons, truncation with a tooltip, labels above inputs. |
| What's not translated | Government data (notice titles, agency names), record data, and names people typed, including renamed Bots. Default Bot names and role descriptions are catalog strings until renamed. |
| Checks | A pseudo-locale build (`pseudoLocalization` in Lingui config) runs in CI with Playwright screenshots of Today, a bid, Approvals and Settings to catch hard-coded or clipped text. |
| Units | US units and formats now (miles, MM/DD in SMS). Distances and dates go through the same helpers so a later locale can switch them. |

## 27. Schema additions requested

These are not in PRD.md, ARCHITECTURE.md or DATA_MODEL.md. The spine docs were not edited. Each item names its table or contract, its columns, and the screens and requirements that need it. Tenant tables follow DATA_MODEL §1 and §2 (tenant column, RLS template, indexes, `set_updated_at` trigger).

**New tables**

1. **`bid_briefs`** (module `bids`). The brief has no home today. Brief tab, Today, run notifications. FR-BID-2.
   ```sql
   create table bid_briefs (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     deal_id uuid not null references deals(id) on delete cascade,
     version int not null default 1,
     status text not null default 'pending' check (status in ('pending','reading','ready','failed')),
     sections jsonb not null default '[]',      -- BidBriefSection[] (zod): [{key, items:[{text, citations: Citation[], isUnknown}]}]
                                                -- key in ('red_flags','scope','place','dates','contract','evaluation','bonding_insurance','wage','site_visit','submission','ai_use')
     source_document_ids uuid[] not null default '{}',
     error jsonb,
     run_id uuid,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     unique (deal_id, version)
   );
   ```
2. **`draft_versions`** (module `drafts`). Immutable snapshots, so autosave can write the living `drafts` row in place. Treat `drafts.version` as the latest snapshot number and `parent_draft_id` as "copied from". Draft editor, Versions panel, conflict handling. FR-DRF-2.
   ```sql
   create table draft_versions (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     draft_id uuid not null references drafts(id) on delete cascade,
     version int not null,
     content jsonb not null,
     content_text text not null,
     label text,                                 -- e.g. 'Your unsaved changes, 10:42 AM'
     created_by_type text not null check (created_by_type in ('user','bot')),
     created_by_id uuid,
     run_id uuid,
     created_at timestamptz not null default now(),
     unique (draft_id, version)
   );
   ```
3. **`draft_comments`** (module `drafts`). Comments panel. FR-DRF-2.
   ```sql
   create table draft_comments (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     draft_id uuid not null references drafts(id) on delete cascade,
     parent_comment_id uuid references draft_comments(id) on delete cascade,
     anchor jsonb,                               -- {from, to, quote}; null on replies
     body text not null,
     author_type text not null check (author_type in ('user','bot')),
     author_id uuid not null,
     resolved_at timestamptz,
     resolved_by uuid references users(id),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   ```
4. **`draft_requirement_links`** (module `drafts`). Which draft answers which requirement, for coverage and gaps. Requirements tab, Drafts tab, editor panel. FR-DRF-1.
   ```sql
   create table draft_requirement_links (
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     draft_id uuid not null references drafts(id) on delete cascade,
     requirement_id uuid not null references bid_requirements(id) on delete cascade,
     anchor text,                                -- id of the heading or block in the draft
     created_by_type text not null check (created_by_type in ('user','bot')),
     created_at timestamptz not null default now(),
     primary key (draft_id, requirement_id)
   );
   create index on draft_requirement_links (tenant_id, requirement_id);
   ```
5. **`sub_suggestions`** (module `quotes`). Sub Finder's candidates before they're in the CRM. Subs and quotes tab. FR-SUB-1. For `source='places'`, store only `place_id` in `source_ref` and leave `contact` empty (Google terms); fetch contact details live.
   ```sql
   create table sub_suggestions (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     deal_id uuid not null references deals(id) on delete cascade,
     company_id uuid references companies(id) on delete set null,
     name text not null,
     trade text,
     distance_miles numeric(7,1),
     source text not null check (source in ('crm','sam','kontract','website','places')),
     source_ref text,
     contact_path text not null default 'none' check (contact_path in ('email','phone','web_form','none')),
     contact jsonb not null default '{}',        -- {email, phone, website}
     status text not null default 'suggested' check (status in ('suggested','added','requested','dismissed')),
     run_id uuid,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   ```
6. **`notification_preferences`** (module `notifications`). Per person, per workspace: digest hour and days, channels per kind, personal quiet hours. ARCHITECTURE §7.4 already reads a per-user digest hour. Onboarding step 5, Channels and alerts. FR-CH-3, FR-CH-5, FR-CH-8.
   ```sql
   create table notification_preferences (
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     user_id uuid not null references users(id) on delete cascade,
     is_digest_enabled boolean not null default true,
     digest_hour smallint check (digest_hour between 0 and 23),   -- null = tenant_settings.digest_hour
     digest_days smallint[] not null default '{1,2,3,4,5}',       -- ISO weekdays
     channels jsonb not null default '{}',       -- {digest|approval|deadline|quote_received|run_finished|alert|billing: notifications.channel[]}
     quiet_hours jsonb,                          -- null = tenant_settings.quiet_hours
     updated_at timestamptz not null default now(),
     primary key (tenant_id, user_id)
   );
   ```
7. **`short_links`** (module `channels`) and resolver `short_link_target(code text) returns table (tenant_id uuid, user_id uuid, target text, expires_at timestamptz)` (security definer, as in DATA_MODEL §2.2). Links in texts and Telegram. [§20.1](#201-rules-for-every-text).
   ```sql
   create table short_links (
     code text primary key,                      -- 7 characters, base62
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     user_id uuid not null references users(id) on delete cascade,
     target text not null,                       -- app path, e.g. '/approvals/<id>'
     expires_at timestamptz not null,
     created_at timestamptz not null default now()
   );
   ```
8. **`calendar_feeds`** (module `bids`) and resolver `tenant_for_calendar_token(token_hash text) returns table (tenant_id uuid, user_id uuid, feed_id uuid)`. ICS deadline feed. Your account. FR-BID-4.
   ```sql
   create table calendar_feeds (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     user_id uuid not null references users(id) on delete cascade,
     token_hash text not null unique,            -- sha256 of the secret in the feed URL
     last_fetched_at timestamptz,
     revoked_at timestamptz,
     created_at timestamptz not null default now()
   );
   ```
9. **`imports`** (module `crm`). CSV import progress and per-row errors. Import screens. FR-CRM-8.
   ```sql
   create table imports (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     object text not null check (object in ('company','contact')),
     file_id uuid not null references files(id),
     mapping jsonb not null default '{}',        -- {csvHeader: fieldKey | null}
     dedupe text not null default 'update' check (dedupe in ('update','skip','create')),
     status text not null default 'draft' check (status in ('draft','queued','running','succeeded','failed')),
     total_rows int,
     processed_rows int not null default 0,
     created_count int not null default 0,
     updated_count int not null default 0,
     skipped_count int not null default 0,
     error_count int not null default 0,
     errors_file_id uuid references files(id),
     created_by uuid not null references users(id),
     created_at timestamptz not null default now(),
     finished_at timestamptz
   );
   ```
10. **`reviewer_assignments`** (module `ops`, `magpie_ops` pool only, like `impersonations`). "Reviewers see only their assigned tenants." Tenant detail, reviewer queue. FR-OPS-5.
    ```sql
    create table reviewer_assignments (
      staff_user_id uuid not null references users(id) on delete cascade,
      tenant_id uuid not null references tenants(id) on delete cascade,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now(),
      primary key (staff_user_id, tenant_id)
    );
    ```
11. **`market_source_health`** (module `market`, global like `market_opportunities`: `magpie_app` select only, written by `worker`). Source health on Matches and Bids. PRD §12.
    ```sql
    create table market_source_health (
      source text primary key check (source in ('sam','sled')),
      status text not null check (status in ('ok','degraded','down')),
      last_success_at timestamptz,
      checked_at timestamptz not null default now(),
      message text
    );
    ```

**New columns and enum values**

12. **`approvals`** (FR-OPS-5, FR-CH-4):
    - `status` adds `'returned'` (staff sent it back to the Bot).
    - New columns `staff_decided_by uuid references users(id)`, `staff_decided_at timestamptz`, `review_notes text`. Owner decisions keep using `decided_*`, so the reviewer's decision isn't overwritten and median review time can be computed.
    - Short codes unique per person across workspaces while pending: replace the per-tenant unique index with `create unique index on approvals (requested_for_user_id, short_code) where status = 'pending';` and allocate through a security definer function `allocate_approval_short_code(user_id uuid) returns text` (lowest free "A{n}").
13. **`opportunity_matches`** (FR-DIS-5): `dismiss_reason` constrained to `('not_our_work','too_far','too_big','too_small','not_eligible','due_too_soon','strong_incumbent','other')`, plus `dismiss_note text`.
14. **`bid_deadlines.timezone text not null`** (IANA; default from `tenants.timezone` in the service). FR-BID-4 says "in the solicitation's timezone"; the table stores only `at`.
15. **`deals.work_category text check (work_category in ('services','general_construction','special_trade','supplies'))`**, null until Bid Reader or a person sets it. Picks the FAR 52.219-14 cap. FR-PRC-5.
16. **`tenant_settings.margin_floor_bps int`**, null for no warning. Workspace general, Pricing. FR-PRC-4.
17. **`bot_jobs.is_learning_mode boolean not null default false`**. Learning mode is set per job; runs copy it to `agent_runs.is_learning_mode`. FR-BOT-5.
18. **`memberships.onboarded_at timestamptz`** for invited people's short onboarding, and the documented shape of `tenant_settings.settings.onboarding`: `{ currentStep: 'business'|'work'|'area'|'limits'|'phone'|'done', completed: string[], skipped: string[], finishedAt: string|null, dismissedAt: string|null }`. FR-PRO-1.
19. **`users.locale text not null default 'en-US'`**. i18n readiness, server-rendered text. PRD §7.
20. **`data_exports`**: `kind text not null default 'workspace' check (kind in ('workspace','bid_package'))`, `deal_id uuid references deals(id) on delete cascade`, `expires_at timestamptz`. Bid package export and download expiry. FR-BID-9, FR-ACC-5.
21. **`channel_bindings.label text`**: Telegram username or push device name, shown in Channels and alerts. FR-CH-2, FR-CH-8.
22. **`market_opportunities.search tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(solicitation_number,'') || ' ' || coalesce(agency,''))) stored`** with a GIN index, and a trigram index on `title`. FR-CRM-6 includes matches in global search; this is the only searched table without one.

**Shared contracts (zod in `packages/shared`, no migration)**

23. **`Citation`**: the discriminated union in [§22.11](#2211-citation-chip). Stored `{documentId, page, quote}` without `kind` means `bid_document`.
24. **`ApprovalPreview`**: the per-kind shapes in [§14.3](#143-preview-kinds), each with `why: string` and `sources: Citation[]` (FR-APR-1 asks for "why" and "sources"; `approvals` has no column for them).
25. **`notifications.payload`**: `{ title (max 80), body (max 160), url, refs?: [{ n, matchId }] }`. `refs` holds digest numbering for the reply grammar.
26. **`me.permissions`**: the flag object in [§3.7](#37-permissions-in-the-ui).
27. **Domain event types**: the names and payloads in [§23.3](#233-realtime-events-and-invalidation) beyond the five in ARCHITECTURE §9.

**API (for API.md)**

28. The `/api/app` routes in [§23.2](#232-query-keys-and-endpoints), including the non-CRUD ones the screens depend on: `GET /today`, `GET /search`, `GET /market/sources`, `POST /matches/$id/pursue|save|dismiss|restore`, `POST /notices/$id/pursue|save`, `PUT /bids/$dealId/decision`, `GET /bids/$dealId/documents/$id/pages/$page`, `POST /bids/$dealId/exports`, `POST /approvals/$id/decision`, `POST /approvals/bulk-decision`, `GET /approvals/count`, `POST /channels/sms/start|verify`, `POST /channels/telegram/link`, `POST /runs/$id/cancel`, `POST /bot-jobs/$id/run`, `GET /tools`, `POST /billing/checkout|portal|run-packs|cancel|resume`, `GET /usage`, `GET /short-links/$code`, and the public `GET /calendar/$token.ics` and `POST /u/$token`.
29. The problem `code` list in [§2.3](#23-shared-copy).

**Stack additions (for ARCHITECTURE §3)**

30. Lingui v5 (i18n), React Email (email templates), `vite-plugin-pwa`, `pdfjs-dist`, `@dnd-kit/core` and `@dnd-kit/sortable`, `idb-keyval`, Sonner, TanStack Table and TanStack Virtual, Recharts (through shadcn `Chart`), `react-qr-code`, `lucide-react`.

**Clarifications (no change, confirm the reading)**

31. `tenant_settings.outreach_footer` holds the postal address block; the server appends the unsubscribe line when sending.
32. `approvals.decided_via='email'` is unused by the app in v1: email links open the app, and decisions there and from web push record `'web'`.
33. Entitlement keys the Usage page expects: `ai_runs`, `doc_pages`, `sms_segments`, `saved_searches`, `users` (BILLING.md owns the list).
