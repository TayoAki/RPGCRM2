# Magpie: security

**Status:** ready to build. **Owner:** founder. **Last updated:** 2026-11-10.

How Magpie protects customer data, who can do what, which secrets and settings exist, how data is kept and deleted, and what the compliance commitments are. Table, column, module, role and queue names come from [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md); if this file disagrees with them, they win. HTTP rules that overlap (cookies, CSRF, rate limit buckets, problem codes) are in [API.md](API.md) §2; this file gives the reasons and anything API.md does not cover. Bot safety is in [AGENT_RUNTIME.md](AGENT_RUNTIME.md) §6 to §8. Data model changes this file needs are in §20. Anything marked **verify** must be checked against the provider's current documentation or terms before launch.

## 1. Threat model

| # | Threat | Impact | Controls | Proof |
|---|---|---|---|---|
| 1 | One workspace reads or changes another's data (missing filter, guessed id, pooled connection leak) | Breach of every customer | Forced RLS on every tenant table, `withTenant()` with transaction-local settings, resolver functions as the only cross-tenant lookups, ownership checks on foreign ids (§2) | Isolation suites on every PR |
| 2 | Account takeover (credential stuffing, phishing, stolen session) | Data theft; email sent in the owner's name | Breached-password check, sign-in rate limits and lockout, HttpOnly cookies, sign out everywhere, fresh sessions for sensitive actions, Google and Microsoft sign-in (§3) | Auth tests |
| 3 | Prompt injection through bid documents, emails or web pages | Unwanted sends, data leaving the workspace | Untrusted-text wrapping, taint rules, CRM-only recipients, URL reading only through Kontract, approval for every external action (AGENT_RUNTIME §7) | Injection eval suite |
| 4 | Bots state false facts or wrong prices | Lost bids; protests dismissed for fabricated citations (PRD §2) | Citations validator, code-computed totals, drafting fact check, person approval (AGENT_RUNTIME §6) | Golden evals in CI |
| 5 | Outbound channels used for spam | Sending domain or 10DLC campaign blocked for every customer | Approval for every outside message, `emails_sent` allowance, suppression lists, trial limits, separate Postmark stream for outreach, SMS only to verified workspace users (§18.4, §18.5) | Suppression tests |
| 6 | Secrets leak (OAuth refresh tokens, API keys, master key) | Abuse of customers' mailboxes | Envelope encryption, secret ids instead of values in workflows, redaction, secret scanning, key rotation (§6, §8, §15) | Secret scanning in CI |
| 7 | Staff misuse support access | Privacy breach | Staff roles, impersonation with reason, 60-minute limit, banner, audit and blocked external actions, audited ops pool (§4.6, §4.7) | Ops tests |
| 8 | Server-side request forgery | Access to cloud metadata or internal services | No arbitrary fetch in Magpie; hostname allowlists; IP range blocking for customer webhook URLs (§11) | SSRF tests |
| 9 | Malicious uploads (malware, script in SVG or HTML, zip bombs, parser exploits) | Compromise of users or workers | Type allowlist, malware scan before use, sandboxed extraction, downloads from another origin (§10) | Upload fuzzing (M10) |
| 10 | Forged or replayed webhooks | Fake payments, fake approvals by SMS | Signature checks, timestamp tolerance, `webhook_receipts` dedupe (§12) | Webhook tests |
| 11 | Spoofed SMS replies approving actions | An outside message sent without consent | Twilio signature, replies accepted only from verified bindings, per-person short codes not reused for 7 days, confirmations that echo the title (AGENT_RUNTIME §8.3) | Grammar fixture tests |
| 12 | Cost exhaustion (Bot loops, trial farming) | Margin loss | Per-run step and cost caps, hard monthly cost ceiling, trial abuse controls (BILLING §7) | Cap tests |
| 13 | Supply chain compromise | Code execution in api or worker | Frozen lockfile, pinned actions, dependency and container scanning, SBOM (§15) | CI |
| 14 | Data loss (bad migration, deletion bug, provider outage) | Lost customer data | Point-in-time restore, encrypted daily logical backups, quarterly restore drills, expand-then-contract migrations (§16) | Restore drill record |
| 15 | Breaking a solicitation's AI rule or a defense customer's provider ban | Customer disqualified or in breach | AI-use clause detection, no-AI mode, AI-use log, provider exclusions (§18.9, §18.10) | Evals and gateway tests |
| 16 | Model providers retain or train on customer data | Confidentiality breach | No-training terms, subprocessor list, minimal prompts (§18.11) | Vendor review |

## 2. Tenancy isolation

ARCHITECTURE §5 defines pooled tenancy with forced RLS, `withTenant()`, the role split and the isolation suites. DATA_MODEL §2 defines the policy template and the resolver functions. On top of that, these tests are required and run on every PR (`pnpm test:isolation`):

1. **Table suite** (ARCHITECTURE §5.3): two tenants with rows in every tenant table; tenant A sees zero rows of B, updates and deletes affect zero rows, inserts with B's id fail. New tables are added to the fixtures in the same PR (AGENTS.md).
2. **Catalog test:**
   - every `public` table with `tenant_id` has RLS enabled and forced, the `tenant_isolation` policy and an index starting with `tenant_id`;
   - `magpie_app` owns no table and lacks `BYPASSRLS`;
   - the append-only tables grant only `select, insert` to `magpie_app`;
   - every `security definer` function sets `search_path` explicitly (`set search_path = public, pg_temp`).
3. **Route suite** (ARCHITECTURE §5.3) for every `GET`, extended to every mutating route: calling with another tenant's ids returns 404 and changes nothing.
4. **Foreign ids.** Postgres foreign key checks ignore RLS, so an insert could link to another tenant's row. Every create and update in `packages/core` that accepts an id (`company_id`, `deal_id`, `file_id`, `contact_id` and the rest) loads it through `withTenant` first and returns `not_found` if it is not visible. One test per route sends a foreign id. The nightly orphan check (DATA_MODEL §1) also reports any row whose referenced row belongs to another tenant.
5. **Resolver and fan-out functions** (DATA_MODEL §2.2, AGENT_RUNTIME §15) return only the documented columns and nothing for unknown input.
6. **Workflows.** Every workflow's first database step opens `withTenant` with the tenant from its input. A test enqueues a workflow for tenant A with record ids of tenant B and expects `not_found`.
7. **Agent tools.** Each tool is tested with another tenant's ids and returns `not_found`.
8. **Realtime.** Two tenants subscribed to `/api/app/events`; each receives only its own events, including on `Last-Event-ID` replay.
9. **Files.** Object keys always start `t/<tenant_id>/`; presigned URLs are issued only after a `withTenant` read of `files`; another tenant's file id returns 404.
10. **Vector and keyword retrieval** filter by tenant, document or opportunity before ranking (AGENT_RUNTIME §12.2); tested with two tenants holding near-identical text.
11. **Connection reuse.** Two transactions run back to back on one pooled connection; the second does not see the first's `app.tenant_id`.
12. **Missing context.** In development and test builds, a hook fails any `magpie_app` query that runs without `app.tenant_id` set, so silent empty results are caught early.
13. **DBOS system schema** has no RLS. Workflow inputs carry ids, never customer text or secrets; the ops console reads workflow status only after checking the tenant prefix of the workflow id (API.md §2.13).

## 3. Authentication

### 3.1 Better Auth configuration

Verify every option name against the pinned Better Auth version (ARCHITECTURE §3).

| Area | Setting | Value | Reason |
|---|---|---|---|
| Base | `baseURL`, `basePath` | `APP_URL`, `/api/auth` | API.md §4 |
| | `secret` | `BETTER_AUTH_SECRET` | |
| | `trustedOrigins` | `[APP_URL]` | Origin check on auth routes |
| Email and password | `emailAndPassword.enabled` | true | FR-ACC-1 |
| | password length | 12 to 128 characters | NIST SP 800-63B favors length; Better Auth's default minimum is 8 |
| | composition rules, forced rotation | none | NIST SP 800-63B |
| | breached-password check | `haveIBeenPwned` plugin on sign-up, change and reset; only a 5-character hash prefix leaves Magpie | Blocks known leaked passwords |
| | hashing | scrypt (Better Auth default) | |
| | `requireEmailVerification` | false, so onboarding finishes in under 60 seconds (FR-ACC-1); unverified owners have limits (§3.3) | |
| | `revokeSessionsOnPasswordReset` | true | Default is false |
| | change password | `revokeOtherSessions: true` | |
| | reset link | valid 1 hour, single use | |
| Email verification | `sendOnSignUp` | true; link valid 24 hours | |
| Magic link | `magicLink` plugin | valid 10 minutes, single use, sent through Postmark | FR-ACC-1 |
| Google | scopes | `openid email profile` for sign-in; `gmail.send` only in the separate connect flow (API.md §4) | §18.6 |
| | account linking | automatic only when Google reports the email as verified | |
| Microsoft | tenant, scopes | `common`; `openid email profile` for sign-in; `Mail.Send` and `offline_access` only in the connect flow | §18.7 |
| | account linking | never automatic by email, because Microsoft's `email` claim is not always verified; people link Microsoft from settings while signed in | |
| Sessions | `expiresIn`, `updateAge` | 30 days, 1 day (sliding) | FR-ACC-6, API.md §2.10 |
| | `freshAge` | 10 minutes | Sensitive actions (§3.2) |
| | `cookieCache` | off, so revocation is immediate; if load tests need it, at most 60 seconds | FR-ACC-6 |
| | cookie | prefix `magpie`, `HttpOnly`, `Secure`, `SameSite=Lax` (`__Secure-` prefix in production) | API.md §2.10 |
| Rate limits | `rateLimit` | enabled outside unit tests; `storage: "database"` on `rate_limits`; global 100 requests per 10 seconds; per-path rules in §14 | No Redis in v1 |
| Client IP | `advanced.ipAddress.ipAddressHeaders`, `trustedProxies` | the one header Railway's edge sets (**verify** which) | Rate limits by IP must not be spoofable |
| Organizations | `organization` plugin | creator role `owner`; roles `owner`, `admin`, `member`, `viewer` (custom role through access control, **verify**); invitations expire in 7 days (FR-ACC-2); member limit from entitlement `users` in a hook | |
| Admin | `admin` plugin | `impersonationSessionDuration` 3,600 seconds; called only by `/api/ops` (§4.7); needs user fields in §20 | FR-OPS-2 |
| Two-factor | not enabled for customers in v1 (PRD §11); staff rely on Google Workspace 2-Step Verification (§3.5) | | |

### 3.2 Sensitive actions

These need a fresh session (signed in within the last 10 minutes); otherwise the person signs in again:
- change password or email;
- transfer ownership;
- delete or export the workspace;
- create an API key;
- change an admin's role;
- connect or disconnect Gmail or Outlook;
- change model provider exclusions.

### 3.3 Limits before email verification

An owner who signed up with email and password and has not verified can finish onboarding, see matches and use the CRM. Until verified, Magpie refuses:
- Bot runs;
- outreach;
- SMS and Telegram connection;
- invitations;
- Gmail or Outlook connection;
- purchases;
- API keys.

Google and Microsoft sign-ups arrive verified. The banner says "Verify your email to let your Bots start."

### 3.4 Sign-in protection

- Per-path limits are in §14.
- After 10 failed password sign-ins for one email in 15 minutes, password sign-in for that email is refused for 15 minutes. Magic link still works, so an attacker cannot lock the real person out. The person gets an email.
- New sign-ins from a new device send an email notice with a "This wasn't me" link that signs out everywhere.
- Sign-up and magic-link requests carry a Cloudflare Turnstile token checked server-side (BILLING §7).

### 3.5 Staff accounts

- Staff (`users.is_staff`) sign in only with Google accounts in `STAFF_GOOGLE_DOMAIN` (checked on the `hd` claim and the email domain). Password and magic-link sign-in are refused for staff.
- The Google Workspace enforces 2-Step Verification for that domain.
- Staff sessions end 12 hours after sign-in regardless of use.
- Staff roles are set only by a founder through an audited CLI command, never through the app.

### 3.6 Sign out everywhere and account deletion

- "Sign out of all devices" calls Better Auth's `revokeSessions`, which deletes every session of the person (FR-ACC-6). MCP grants are listed separately under "Connected AI apps" and can be revoked there.
- A person may delete their own account when they own no workspace. Their memberships, sessions, channel bindings, personal memories and personal API keys are deleted. Rows they authored keep the user id, and the UI shows "Former member".

## 4. Authorization

All checks happen in `packages/core` (the records layer and services), not only in routes. Routes enforce the minimum role in API.md §5; core enforces the permission. If API.md §5's role column and the matrix in §4.3 disagree, raise it rather than pick one (API.md §2.10).

### 4.1 Permission keys

`packages/shared/src/permissions.ts` exports these keys and the role map. Tools (AGENT_RUNTIME §3.3) and routes check them.

| Key | Allows |
|---|---|
| `records.read` | Read records, profile, bids, matches, documents, drafts, price sheets, quotes, files, timelines, reports |
| `records.write` | Create and edit companies, contacts, deals, tasks, notes, tags, shared views |
| `records.archive` | Archive and restore records |
| `records.bulk` | Bulk actions, import, merge |
| `records.export` | CSV export of a view |
| `schema.manage` | Custom field definitions, pipelines and stages |
| `profile.write` | Company profile, past performance, library |
| `searches.write` | Saved searches |
| `matches.decide` | Pursue, save, dismiss matches |
| `bids.write` | Bid documents, requirements, deadlines, submissions, package export |
| `bids.decide` | Bid or no-bid decision |
| `bids.ai_override` | Turn AI drafting back on for a bid flagged as banning AI |
| `pricing.write`, `pricing.approve` | Edit and approve price sheet versions |
| `quotes.write` | Quote requests, confirming parsed quotes, choosing a quote |
| `drafts.write` | Edit drafts, comment, restore versions |
| `outreach.send` | Approve or send a message to someone outside the business |
| `approvals.decide` | Decide approvals requested for yourself |
| `approvals.decide_any` | Decide approvals requested for others |
| `bots.chat` | Chat with Bots and Ask a Bot |
| `bots.configure` | Rename Bots, edit instructions, turn Bots and jobs on or off, job times, custom jobs |
| `bots.autonomy` | Tool policies and earned-autonomy suggestions |
| `bots.view_costs` | All runs and cost per Bot |
| `memory.write` | Add and edit business memories; delete those you added |
| `memory.manage` | Delete any business memory |
| `members.manage` | Invitations, roles, removal |
| `settings.manage` | Workspace settings, digest and quiet hours, AI drafting switch, provider exclusions, outreach footer, approval expiry |
| `connections.manage` | Workspace-wide connections and bring-your-own keys |
| `billing.manage` | Plan changes, payment method, run packs |
| `billing.cancel` | Cancel the subscription |
| `usage.view` | Usage page |
| `api_keys.manage` | API keys |
| `webhooks.manage` | Outgoing webhook endpoints |
| `automations.manage` | Automations |
| `reports.write` | Create and edit reports |
| `audit.read` | Audit log viewer |
| `workspace.export` | Full workspace export |
| `workspace.delete` | Delete the workspace or cancel deletion |
| `ownership.transfer` | Transfer ownership |

| Role | Permissions |
|---|---|
| `viewer` | `records.read`, `bots.chat` (Bots get read tools only) |
| `member` | viewer, plus `records.write`, `records.archive`, `records.bulk`, `records.export`, `profile.write`, `searches.write`, `matches.decide`, `bids.write`, `bids.decide`, `pricing.write`, `pricing.approve`, `quotes.write`, `drafts.write`, `outreach.send`, `approvals.decide`, `memory.write`, `reports.write` |
| `admin` | member, plus `schema.manage`, `bids.ai_override`, `approvals.decide_any`, `bots.configure`, `bots.autonomy`, `bots.view_costs`, `memory.manage`, `members.manage`, `settings.manage`, `connections.manage`, `billing.manage`, `usage.view`, `api_keys.manage`, `webhooks.manage`, `automations.manage` |
| `owner` | admin, plus `billing.cancel`, `audit.read`, `workspace.export`, `workspace.delete`, `ownership.transfer` |

Everyone can manage their own channels, notification preferences, personal saved views, personal memories, own calendar feed link and own session.

### 4.2 Not in v1

There are no per-record or per-field restrictions: every member of a workspace can read every record in it. Personal saved views, personal memories and personal notification settings are visible only to their owner.

### 4.3 Role matrix

"Own" means only items assigned to or created by the person.

| Area | Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|---|
| Accounts (FR-ACC) | Sign in, switch workspaces, sign out everywhere | yes | yes | yes | yes |
| | Invite, change roles, remove people (FR-ACC-2, FR-ACC-4) | yes | yes, not the owner | no | no |
| | Transfer ownership, export the workspace, delete the workspace (FR-ACC-5) | yes | no | no | no |
| Profile (FR-PRO) | View profile, past performance, library | yes | yes | yes | yes |
| | Edit them, run the setup wizard | yes | yes | yes | no |
| Discovery (FR-DIS) | Search bids, view notices and matches | yes | yes | yes | yes |
| | Create and edit saved searches | yes | yes | yes | no |
| | Pursue, save, dismiss matches (web or text) | yes | yes | yes | no |
| Bid workspace (FR-BID) | View bids, documents, brief, matrix, deadlines, timeline | yes | yes | yes | yes |
| | Upload documents, edit requirements and deadlines, record submission, export the package | yes | yes | yes | no |
| | Decide bid or no bid | yes | yes | yes | no |
| | Turn AI drafting back on for a bid that bans AI | yes | yes | no | no |
| Pricing (FR-PRC) | View price sheets | yes | yes | yes | yes |
| | Edit drafts, approve a version | yes | yes | yes | no |
| Subcontractors (FR-SUB) | View quote requests and quotes | yes | yes | yes | yes |
| | Draft requests, confirm parsed quotes, pick a quote | yes | yes | yes | no |
| Drafts (FR-DRF) | View drafts and versions | yes | yes | yes | yes |
| | Edit, comment, restore | yes | yes | yes | no |
| CRM (FR-CRM) | View records, timelines, field history | yes | yes | yes | yes |
| | Create, edit, archive, tag, bulk actions, merge, import | yes | yes | yes | no |
| | Export a view to CSV | yes | yes | yes | no |
| | Custom fields, pipelines and stages | yes | yes | no | no |
| | Personal saved views | yes | yes | yes | yes |
| | Shared saved views | yes | yes | yes | no |
| Bots (FR-BOT) | Chat, Ask a Bot | yes | yes | yes | yes, read tools only |
| | Rename, instructions, turn on or off, job times, custom jobs | yes | yes | no | no |
| | Tool policies, earned-autonomy suggestions (FR-BOT-3, FR-BOT-4) | yes | yes | no | no |
| | Runs log | all | all | own | own |
| | Cost per Bot (FR-BOT-7) | yes | yes | no | no |
| | Add business memories | yes | yes | yes | no |
| | Delete business memories | any | any | own | no |
| Approvals (FR-APR) | Decide approvals requested for you | yes | yes | yes | never requested |
| | Decide approvals requested for others | yes | yes | no | no |
| | Bulk approve internal approvals | all | all | own | no |
| Channels (FR-CH) | Connect own SMS, Telegram, web push; own preferences | yes | yes | yes | yes |
| | Digest hour, quiet hours | yes | yes | no | no |
| Billing (FR-BIL) | View plan, usage and cost per Bot (FR-BIL-3) | yes | yes | no | no |
| | Change plan, payment method, buy run packs | yes | yes | no | no |
| | Cancel the subscription (FR-BIL-7) | yes | no | no | no |
| Settings (FR-SET) | Workspace settings, AI drafting switch, provider exclusions (FR-SET-1) | yes | yes | no | no |
| | Connect own Gmail or Outlook for sending (FR-SET-2) | yes | yes | yes | no |
| | Workspace-wide connections and bring-your-own keys | yes | yes | no | no |
| | API keys (FR-SET-3) | yes | yes | no | no |
| | Own calendar feed link | yes | yes | yes | yes |
| | Audit log viewer (FR-SET-4) | yes | no | no | no |
| API and MCP (FR-API) | Use the API or MCP | as the key's or token's person | same | same | same |
| | Outgoing webhooks (FR-API-3) | yes | yes | no | no |
| Automations, reports (FR-AUT, FR-REP) | Create and edit automations | yes | yes | no | no |
| | View reports | yes | yes | yes | yes |
| | Create and edit reports | yes | yes | yes | no |

### 4.4 Bots

- A run acts with the permissions of `agent_runs.acting_user_id` (FR-BOT-2). Chat and Ask a Bot act for the person chatting; API and MCP for the key's or token's person; jobs and events for the workspace owner.
- The tool list removes tools the acting user lacks permission for, and the gate checks again (AGENT_RUNTIME §4.5). A run acting for a viewer cannot write.
- An approval is decided by its `requested_for_user_id` or by an admin or owner (API.md §2.10). The decider must also hold the tool's permission (for example `outreach.send`).
- Bots never change tool policies, roles, settings, billing, connections, API keys or memories' confirmation.

### 4.5 API keys and MCP tokens

| Rule | Detail |
|---|---|
| Format | `mgp_` plus 40 random base62 characters (about 238 bits). `api_keys.prefix` is the first 8 characters (for example `mgp_AbC1`); on a prefix collision, generate a new key. |
| Storage | `key_hash` is the SHA-256 of the full key. The key is shown once at creation and never again. |
| Lookup | `tenant_for_api_key_prefix(prefix)`, then a constant-time hash comparison. No cache, so revocation is immediate (FR-SET-3). |
| Identity | A key acts as `api_keys.user_id` with that person's current role, narrowed by `scopes` (`read`: GET only; `write`: adds writes, including deciding approvals) (API.md §2.10). |
| Lifetime | Creation suggests a 1-year expiry; keys without one are listed with a warning. Owners and admins get an email 14 days before a key expires. |
| Removal | A key stops working when revoked, expired, or when its person leaves the workspace or is downgraded to a role without the needed permission. |
| Usage | `last_used_at` updated at most once a minute; rate limit 600 requests a minute per key (FR-API-1) and the `api_requests_per_day` entitlement (BILLING §3). |
| Never | Keys never appear in URLs, logs or error messages. The calendar feed token in `/ics/<token>.ics` is a separate read-only key limited to the person's own deadlines; it can be rotated from settings. |
| MCP | OAuth 2.1 with PKCE through Better Auth's MCP plugins (API.md §4). Access tokens last 1 hour, refresh tokens 30 days. A grant is bound to one workspace and one person, writes follow approval rules (FR-API-2), and grants can be revoked under "Connected AI apps". **Verify** token lifetimes are configurable in the pinned plugin. |

### 4.6 Staff roles

Staff are not workspace members. They reach customer data only through the ops console (`/api/ops`, `magpie_ops` pool) and impersonation. Every ops view and action writes an `audit_log` row with `actor_type = 'staff'` (FR-OPS-1).

| Capability | `support` | `reviewer` | `admin` |
|---|---|---|---|
| Tenant list and detail: plan, status, MRR, usage, cost, margin | yes | no | yes |
| Customer records and documents | only by impersonating | only what the review queue shows for assigned tenants: the approval, its bid's brief, requirements, the draft or message | only by impersonating |
| Impersonate a workspace user (FR-OPS-2) | yes | no | yes |
| Managed review queue (FR-OPS-5) | no | assigned tenants (`staff_assignments`, §20) | all; assigns reviewers |
| Suspend, unsuspend, extend trial, grant credit, entitlement overrides (FR-OPS-3) | no | no | yes |
| Schedule or cancel deletion | no | no | yes |
| Feature flags (FR-OPS-4) | no | no | yes |
| Cost dashboard (FR-OPS-6) | read | no | yes |
| Change staff roles | no | no | no; founders only, by audited CLI |

### 4.7 Impersonation

1. Only `support` and `admin` staff, from the tenant page in `/ops`.
2. A reason of at least 10 characters is required. The `impersonations` row records the staff user, tenant, impersonated user, reason, `started_at` and `expires_at` (§20).
3. The session lasts at most 60 minutes (`impersonationSessionDuration` plus our own check of `expires_at`). Stopping sets `ended_at`.
4. Staff accounts cannot be impersonated. One impersonation at a time per staff user.
5. The web app shows a banner from `GET /me` on every page.
6. Every write is tagged in `audit_log.impersonated_by` (API.md §2.10).
7. Blocked while impersonating, returning `impersonation_blocked`:
   - external actions (sending email or SMS, deciding external approvals, submitting);
   - connecting or disconnecting integrations;
   - billing changes;
   - API key and webhook changes;
   - roles and ownership;
   - tool policies;
   - provider exclusions;
   - workspace export and deletion;
   - signing the person out everywhere.
8. Bot runs started while impersonating record it in `agent_runs.input.impersonatedBy` and get no external tools (AGENT_RUNTIME §3.13).
9. The workspace owner gets an email when impersonation starts (who, why, when), and the owner's audit log shows it.

## 5. Environment variables

`packages/shared/src/env.ts` validates these with zod at boot; a process with invalid or missing required values exits (ARCHITECTURE §10). Each process validates only the variables it uses. A fake `.env.example` lives in the repository; real values live only in Railway variables (sealed where Railway supports it) and in GitHub Actions secrets for CI. Preview and staging use test-mode Stripe and Twilio credentials. Nothing tenant-specific is ever an environment variable.

"Secret" means the value must never be logged, committed or shown in the UI.

### 5.1 Runtime and URLs

| Variable | Used by | Secret | Description |
|---|---|---|---|
| `APP_ENV` | api, worker, web build | no | `local`, `preview`, `staging` or `production`. |
| `NODE_ENV` | api, worker | no | `production` everywhere except local development and tests. |
| `APP_URL` | api, worker, web build | no | Public origin of the app and api (API.md §1). Used for links in messages, the CSRF origin check, Better Auth `baseURL`, and the base URL in Twilio signature checks. |
| `PORT` | api | no | Port the api listens on; set by Railway. |
| `LOG_LEVEL` | api, worker | no | pino level; default `info`. |
| `RELEASE` | api, worker, web build | no | Git SHA of the build, sent to Sentry and logs. |
| `SIGNUPS_ENABLED` | api | no | `true` by default; `false` closes sign-up (incident switch). |

### 5.2 Database

| Variable | Used by | Secret | Description |
|---|---|---|---|
| `DATABASE_URL` | api, worker | yes | `magpie_app` login on Neon's pooled endpoint (transaction mode). All `withTenant` work. |
| `DATABASE_AUTH_URL` | api | yes | `magpie_auth` login, pooled. Better Auth and `packages/core/tenants` only. |
| `DATABASE_OPS_URL` | api, worker | yes | `magpie_ops` login (`BYPASSRLS`), pooled. Only `packages/core/ops`, webhook intake and market cache writes. |
| `DATABASE_LISTEN_URL` | api, worker | yes | `magpie_app` login on Neon's direct endpoint, used only for `LISTEN domain_events`; a transaction-mode pooler cannot hold a `LISTEN`. |
| `DATABASE_MIGRATE_URL` | release step | yes | Login in the `magpie_owner` group on the direct endpoint. Never set on running services. |
| `DBOS_SYSTEM_DATABASE_URL` | api, worker | yes | `magpie_dbos` login (§20) on the direct endpoint, for DBOS's system schema. **Verify** whether DBOS supports a transaction-mode pooler. |
| `DB_POOL_MAX` | api, worker | no | Maximum connections per pool per process; default 10. |
| `DBOS__APPVERSION` | api, worker | no | Fixed application version so replacement workers recover in-flight workflows (AGENT_RUNTIME §4.13). Changed only with a planned drain. **Verify** the name. |
| `DBOS__VMID` | worker | no | Executor id per replica when Conductor is not used. **Verify**. |
| `DBOS_CONDUCTOR_KEY` | worker | yes | Only if the DBOS ADR adopts Conductor. |

### 5.3 Keys, signing and auth

| Variable | Used by | Secret | Description |
|---|---|---|---|
| `MASTER_KEY` | api, worker | yes | 32 random bytes, base64. Wraps data keys (§6) until KMS (M10). |
| `MASTER_KEY_VERSION` | api, worker | no | Integer version of `MASTER_KEY`, stored in `secrets.key_version`. |
| `MASTER_KEY_PREVIOUS` | api, worker | yes | `<version>:<base64>` of the previous master key, set only during a rotation. |
| `KMS_KEY_ID` | api, worker | no | From M10: the KMS key that wraps data keys. Cloud credentials are added by the ADR that picks the KMS. |
| `LINK_SIGNING_SECRET` | api, worker | yes | HMAC-SHA256 key for unsubscribe links, shared file links, one-time approval edit links and pagination cursors (API.md §2.4). |
| `TRIAL_CLAIM_PEPPER` | api | yes | HMAC key for `trial_claims` hashes (BILLING §7). |
| `BETTER_AUTH_SECRET` | api | yes | Better Auth secret, at least 32 random bytes. |
| `GOOGLE_CLIENT_ID` | api | no | Google OAuth client for sign-in and the `gmail.send` connection. |
| `GOOGLE_CLIENT_SECRET` | api | yes | |
| `MICROSOFT_CLIENT_ID` | api | no | Entra app for sign-in and `Mail.Send`. |
| `MICROSOFT_CLIENT_SECRET` | api | yes | |
| `MICROSOFT_TENANT_ID` | api | no | `common`. |
| `STAFF_GOOGLE_DOMAIN` | api | no | Google Workspace domain for staff sign-in (§3.5). |
| `TURNSTILE_SECRET_KEY` | api | yes | Cloudflare Turnstile server key for sign-up and magic-link requests. |

### 5.4 Models and market data

| Variable | Used by | Secret | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | worker | yes | Model calls run only in the worker. |
| `OPENAI_API_KEY` | worker | yes | Model calls and embeddings. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | worker | yes | Only if `models.json` lists Google entries; paid tier only (§18.11). |
| `KONTRACT_BASE_URL` | api, worker | no | Kontract engine base URL. |
| `KONTRACT_API_KEY` | api, worker | yes | Kontract service key. |
| `SAM_API_KEY` | api, worker | yes | SAM.gov key for the fallback adapter. |
| `GOOGLE_PLACES_API_KEY` | worker | yes | Optional; only if Magpie calls Places directly. v1 does not (Kontract does). |

### 5.5 Billing, messaging and files

| Variable | Used by | Secret | Description |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | api, worker | yes | A restricted key with only the resources the integration uses (**verify** the permission list). |
| `STRIPE_WEBHOOK_SECRET` | api | yes | Endpoint signing secret. |
| `STRIPE_API_VERSION` | api, worker | no | Pinned API version (BILLING §4.1). |
| `STRIPE_PORTAL_CONFIGURATION_ID` | api | no | Customer Portal configuration (BILLING §4.3). |
| `TWILIO_ACCOUNT_SID` | api, worker | no | |
| `TWILIO_AUTH_TOKEN` | api | yes | Validates `X-Twilio-Signature`. |
| `TWILIO_API_KEY_SID` | worker | no | REST calls use an API key, not the auth token. |
| `TWILIO_API_KEY_SECRET` | worker | yes | |
| `TWILIO_MESSAGING_SERVICE_SID` | worker | no | Messaging service tied to the 10DLC campaign. |
| `TELEGRAM_BOT_TOKEN` | api, worker | yes | |
| `TELEGRAM_WEBHOOK_SECRET` | api | yes | `secret_token` given to `setWebhook`: 1 to 256 characters of `A-Z a-z 0-9 _ -`. |
| `TELEGRAM_BOT_USERNAME` | api | no | For deep links. |
| `POSTMARK_SERVER_TOKEN` | api, worker | yes | api sends auth emails; worker sends the rest. |
| `POSTMARK_TRANSACTIONAL_STREAM` | api, worker | no | Stream for Magpie's own emails to its users. |
| `POSTMARK_OUTREACH_STREAM` | worker | no | Separate stream for quote requests and Bot emails sent from Magpie's domain (**verify** Postmark's policy for this traffic). |
| `EMAIL_FROM_DOMAIN` | api, worker | no | Sending domain with SPF, DKIM and return path. |
| `INBOUND_EMAIL_DOMAIN` | api, worker | no | Domain of tracked reply addresses. |
| `POSTMARK_INBOUND_USER`, `POSTMARK_INBOUND_PASSWORD` | api | yes | Basic auth credentials in the inbound webhook URL (§12). |
| `MAGPIE_POSTAL_ADDRESS` | api, worker | no | Magpie's postal address for its own emails. |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | api | no | |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | worker | yes | |
| `WEB_PUSH_SUBJECT` | worker | no | `mailto:` contact for push services. |
| `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_BUCKET` | api, worker | no | File storage. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | api, worker | yes | Token scoped to `R2_BUCKET` only. |
| `MALWARE_SCAN_URL` | worker | no | Private network address of the malware scanner (§10.3). |

### 5.6 Backups and observability

| Variable | Used by | Secret | Description |
|---|---|---|---|
| `BACKUP_DATABASE_URL` | backup job | yes | `magpie_backup` login (§20), direct endpoint. |
| `BACKUP_BUCKET`, `BACKUP_ENDPOINT` | backup job | no | Backup bucket in a separate Cloudflare account. |
| `BACKUP_ACCESS_KEY_ID`, `BACKUP_SECRET_ACCESS_KEY` | backup job | yes | Write-only token for the backup bucket. |
| `BACKUP_AGE_RECIPIENT` | backup job | no | Public key backups are encrypted to; the private key is held offline by the founders. |
| `SENTRY_DSN` | api, worker | no | |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | api, worker | no | Traces endpoint. |
| `OTEL_EXPORTER_OTLP_HEADERS` | api, worker | yes | Auth header for the traces backend. |
| `OTEL_SERVICE_NAME` | api, worker | no | `magpie-api` or `magpie-worker`. |
| `CSP_REPORT_URL` | api | no | Endpoint for CSP violation reports (§13). |

### 5.7 Web build (public)

These are compiled into the browser bundle and must never hold a secret: `VITE_APP_URL`, `VITE_APP_ENV`, `VITE_RELEASE`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, `VITE_TELEGRAM_BOT_USERNAME`. A CI check fails the build if any `VITE_` variable name contains `SECRET`, `TOKEN`, `PASSWORD` or `KEY_SECRET`.

## 6. Secrets and envelope encryption

### 6.1 What is encrypted

`secrets` rows (`oauth_refresh_token`, `oauth_access_token`, `byok_api_key`, `webhook_signing_secret`). Better Auth's login tokens in `auth_accounts` are not needed after sign-in: configure Better Auth not to keep provider tokens for login accounts, or to encrypt them (**verify** the option). Data-access tokens always live in `secrets` (DATA_MODEL §3).

### 6.2 Algorithm

1. Each secret gets a random 256-bit data key.
2. The value is encrypted with AES-256-GCM using the data key, a random 96-bit nonce (`secrets.nonce`) and a 128-bit tag stored with `ciphertext`. Additional authenticated data is `magpie:secret:v1|<tenant_id>|<secret id>|<kind>|<provider>`, so a ciphertext copied to another row or tenant fails to decrypt.
3. The data key is wrapped with the master key using AES-256-GCM, its own nonce prefixed to `wrapped_data_key`, and additional data `magpie:dek:v1|<secret id>|<key_version>`. From M10 the KMS wraps it instead (BUILD_PLAN M10).
4. `key_version` records which master key version wrapped the data key.
5. Implementation uses Node's `crypto` only; no custom primitives.

### 6.3 Access

- Only `packages/core/integrations/secrets.ts` decrypts, inside `withTenant`. Each decrypt writes an `audit_log` row `secret.read` with the secret id and the reason (for example `send_email`).
- Plaintext lives only in memory for the duration of the call. It is never returned by any API, never put in workflow inputs or step outputs (they carry the secret id), and never logged.
- Disconnecting a connection revokes the token at the provider where an endpoint exists (Google's revoke endpoint; Microsoft offers no per-app revoke for delegated tokens, so Magpie deletes its tokens and tells the person how to remove the app), then deletes the `secrets` row and sets `connections.status = 'revoked'` (FR-SET-2).

### 6.4 Rotation

| Secret | When | How |
|---|---|---|
| `MASTER_KEY` | yearly, on a founder's departure, on suspected exposure | Set the new key as `MASTER_KEY` with version n+1 and the old as `MASTER_KEY_PREVIOUS`. New wraps use n+1. A `system` queue workflow re-wraps every data key (unwrap with the old key, wrap with the new; ciphertext unchanged), updating `key_version` and `rotated_at`. When no row has the old version, remove `MASTER_KEY_PREVIOUS`. Tested on staging before production. |
| Data keys | when the value changes (OAuth refresh token rotation, a new BYOK key) | New random data key per write. |
| Provider keys and webhook secrets | yearly, on staff departure, on suspected exposure | Create the new credential, deploy, revoke the old. |
| `BETTER_AUTH_SECRET` | on suspected exposure | Rotation signs everyone out unless the pinned Better Auth supports several secrets (**verify**). |
| `LINK_SIGNING_SECRET` | yearly | Accept the previous secret for 30 days so sent unsubscribe links keep working (CAN-SPAM requires 30 days, §18.4). |

### 6.5 Never logged, stored in plain text or sent to Sentry

- Passwords, password hashes, session tokens, cookies, `Authorization` headers.
- API keys (full), MCP access and refresh tokens, OAuth codes and tokens, `secrets` plaintext.
- `MASTER_KEY` and every secret environment variable.
- SMS verification codes, link codes, magic-link and reset tokens, `reply_token` values, signed link tokens.
- Email bodies, SMS bodies, document text, chat text, prompts and model outputs (they live only in RLS tables).
- Payment card data (Magpie never receives it; Stripe Checkout and the Portal collect it).

## 7. Data classification and retention

### 7.1 Classes

| Class | Examples | Rules |
|---|---|---|
| Restricted | Secret plaintext, password hashes, session tokens, API key hashes, verification codes, `MASTER_KEY` | Encrypted or hashed; never logged; never in exports |
| Customer confidential | CRM records, bids, documents, drafts, price sheets, quotes, messages, threads, memories, `agent_steps` arguments and results, files | Tenant-scoped under RLS; in the workspace export; sent to model providers only as a run needs; deleted with the workspace |
| Personal data | `users` name, email, phone; `contacts` names, emails, phones; channel addresses; IPs in `sessions` and `audit_log` | Minimized; access and deletion requests (§18.2) |
| Public | `market_opportunities`, `market_opportunity_texts`, award data | Shared across tenants; no tenant data ever written into them |
| Operational | Logs, traces, metrics, Sentry events | Ids and metadata only, redacted (§8) |
| Financial | Stripe ids, `billing_events`, invoices (in Stripe) | `magpie_ops` pool only |
| Prohibited | Controlled Unclassified Information (CUI), classified data, ITAR or EAR technical data, payment card numbers, Social Security numbers, health records | Not allowed by the Terms; detection in §10.6 |

### 7.2 Retention

| Data | Kept | Then |
|---|---|---|
| Workspace data (every tenant table, the `t/<tenant_id>/` prefix in R2) | while the workspace exists | Hard delete when deletion runs (FR-ACC-5; BILLING §5 for ended trials and canceled workspaces) |
| Point-in-time restore history | 7 days (PRD §7) | Rolls off |
| Daily logical backups | 30 days | Deleted; deleted workspaces are gone from all backups within 30 days of deletion |
| `agent_steps.args`, `agent_steps.result` | 180 days | Set to null by `cleanup`; token and cost columns kept |
| `domain_events` | 7 days (ARCHITECTURE §9) | Deleted |
| `notifications` | 90 days after `sent_at` | Deleted |
| `inbound_emails` bodies and headers | 90 days | Bodies and headers nulled; the routed `messages` row stays |
| `inbound_channel_messages` | 90 days | Deleted |
| `webhook_receipts` | 30 days | Deleted |
| `billing_events` | 2 years (Stripe remains the financial system of record) | Deleted |
| `audit_log` | 2 years | Deleted. Workspace rows go with the workspace; a platform row (`tenant_id` null) records each deletion. |
| `usage_events`, `usage_counters` | 25 months | Deleted after the margin rollup is kept (BILLING §9) |
| `impersonations`, `trial_claims` | 2 years | Deleted |
| `sessions` | until expiry, then 7 days | Deleted |
| `verifications`, `link_codes`, `oauth_states` | until expiry | Deleted daily by `cleanup` |
| `rate_limits` | the window | Deleted hourly |
| `data_exports` files | 7 days | File deleted; row set `expired` |
| Market cache | while active plus 2 years | Deleted |
| Logs | 30 days | Deleted by the log backend |
| Traces | 14 days | |
| Sentry events | 90 days | |

## 8. Logging and redaction

- Log with typed helpers that take ids and metadata, not free objects. Every line carries `tenant_id`, `user_id`, `request_id`, and `run_id` or `workflow_id` when present (ARCHITECTURE §12).
- Request and response bodies are never logged. pino `redact` removes, as a backstop: `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, and any `password`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `code`, `body`, `text`, `html` key at any depth.
- Sentry: `sendDefaultPii: false`; `beforeSend` drops request bodies, cookies and headers outside an allowlist (`user-agent`, `x-request-id`); breadcrumbs strip query strings; tags carry ids only.
- OpenTelemetry: AI SDK telemetry with inputs and outputs not recorded (**verify** the option names); database spans keep statement shape without parameters.
- Third-party error bodies (Stripe, Twilio, Postmark, providers) are logged by code and status only.
- Log access is limited to founders and on-call staff; the backend keeps 30 days.

## 9. Input validation

- Every boundary validates with zod: HTTP bodies and queries (`z.strictObject`, API.md §2.1), webhook payloads after signature checks, tool arguments, jsonb columns before writing, environment variables at boot.
- Strings have maximum lengths in their schemas; arrays have maximum sizes; numbers have ranges; ids are UUIDs (non-UUID path ids return 404, API.md §2.2).
- SQL only through Drizzle parameters or tagged SQL templates. Dynamic identifiers (sort and filter fields) come from per-resource allowlists (API.md §2.5).
- Rich text is TipTap JSON validated against the editor schema; raw HTML is never accepted or stored. Email HTML is generated server-side with escaping.
- CSV exports prefix cells that start with `=`, `+`, `-`, `@`, tab or carriage return with `'` to stop formula injection. Imports treat every cell as text until mapped.
- Phone numbers are normalized to E.164 with libphonenumber; emails are lowercased for comparison and validated; URLs must be `https` (or `http` for reading public sites through Kontract) with a public hostname.
- Model output is untrusted input: it is parsed with the tool's zod schema, and Markdown shown to people is sanitized (AGENT_RUNTIME §7.2).

## 10. File uploads

### 10.1 Allowed types and sizes

| Type | Extensions | Content types | Max size |
|---|---|---|---|
| PDF | `.pdf` | `application/pdf` | 50 MB |
| Word | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 25 MB |
| Excel | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 25 MB |
| CSV (imports, attachments) | `.csv` | `text/csv` | 25 MB |
| Text | `.txt` | `text/plain` | 5 MB |
| Images | `.png`, `.jpg`, `.jpeg`, `.webp` | `image/png`, `image/jpeg`, `image/webp` | 15 MB |
| Logo and avatar | `.png`, `.jpg`, `.jpeg`, `.webp` | same | 2 MB, re-encoded server-side |

Refused: anything else, including SVG, HTML, macro-enabled Office files (`.docm`, `.xlsm`), old binary Office formats, archives and executables. The file's first bytes must match the declared type; extension, content type and magic bytes must agree.

### 10.2 Upload flow

1. The web app asks for a presigned `PUT` (API.md defines the route). The api checks the role, the type, the declared size and the `storage_bytes` entitlement, inserts `files` with `scan_status = 'pending'`, and signs the URL with the content type and length (**verify** R2 enforces a signed `Content-Length`; if not, the scan step's size check is the control).
2. The browser uploads straight to R2. Files never pass through the api (API.md §2.12).
3. The scan workflow on the `docs` queue:
   1. reads the object;
   2. checks size and magic bytes;
   3. computes `sha256`;
   4. scans it;
   5. sets `scan_status` to `clean` or `infected`.
4. An infected file is deleted from R2, the uploader is told, and an `audit_log` row is written. A file stays `pending` while the scanner is down and the workflow retries. User uploads are never marked `skipped`; that status is only for files Magpie generates itself (exports, packages).
5. Pending or infected files cannot be downloaded, read by Bots or attached to messages (`file_not_ready`, API.md §2.9).

### 10.3 Malware scanning

The scanner is a ClamAV daemon (`clamd`) reached at `MALWARE_SCAN_URL` on Railway's private network, with signatures updated at least daily (INTEGRATIONS.md owns the deployment details). Files never leave Magpie's infrastructure to be scanned. This is a third deployable besides `api` and `worker` (ARCHITECTURE §2 lists two); record it in an ADR.

### 10.4 Extraction sandbox

- Text extraction (PDF, DOCX, XLSX, OCR) runs in a child process with no network access, a 512 MB memory limit and a 60-second CPU limit per document.
- Zip-based formats are refused when they unpack to more than 200 MB, more than 10,000 entries or a ratio above 100 to 1.
- XML parsers disable external entities and DTDs.
- PDF parsing never executes embedded JavaScript.

### 10.5 Safe rendering

- User files are never served from the `APP_URL` origin. Downloads use presigned R2 `GET` URLs that expire after 5 minutes, with `Content-Disposition: attachment` and the stored content type.
- PDFs are previewed in-app by rendering their bytes with pdf.js to canvas, with script evaluation off.
- Images are shown from presigned URLs. Other types show extracted text only.
- File names are cleaned (path parts and control characters removed, at most 200 characters) and sent as `filename*` in headers.
- Shared links for subcontractors (`/files/shared/<token>`) are HMAC-signed with `LINK_SIGNING_SECRET`, name one file, expire 7 days after the quote request's due date, and always download as attachments.

### 10.6 Controlled markings

During extraction, documents whose banner or header lines carry markings such as "CUI", "CONTROLLED UNCLASSIFIED INFORMATION", "NOFORN", "ITAR", "EXPORT CONTROLLED" or "FOUO" are set to `text_status = 'unsupported'` and their text is not sent to any model provider. The owner is told why. The owner can release a false positive with a written confirmation that the document is not controlled; the release is audited. The Terms say workspaces must not upload controlled or classified information (§7.1).

## 11. SSRF controls

Magpie's servers fetch outside URLs only on these paths:

| Path | Control |
|---|---|
| Reading public websites for Bots (`web.read_url`) | Never fetched by Magpie. Sent to Kontract `POST /api/v1/websites/read` (AGENT_RUNTIME §3.5). Kontract must apply the IP rules below; record that requirement in INTEGRATIONS.md. |
| Notice attachments and wage determinations | Hostname allowlist: SAM.gov hosts and the hosts Kontract returns for a notice's attachments (configured list in `packages/integrations`). |
| Provider APIs (Stripe, Twilio, Telegram, Postmark, Google, Microsoft, Kontract, model providers, R2) | Fixed base URLs from configuration; never built from user input. |
| Outgoing customer webhooks (FR-API-3) | Customer-supplied URLs, guarded as below. |
| Web push endpoints | Must be `https` on known push service hosts (Apple, Google, Mozilla, Microsoft), checked when the subscription is saved. |

Guard for customer-supplied URLs (`packages/integrations/http/safe-fetch.ts`):
1. `https` only, port 443 only, no credentials in the URL, hostname not an IP literal.
2. Resolve DNS and refuse if any address is in a blocked range:
   - IPv4: loopback, RFC 1918, link-local `169.254.0.0/16` (cloud metadata), CGNAT `100.64.0.0/10`, `0.0.0.0/8`, multicast, reserved;
   - IPv6: `::1`, `fc00::/7`, `fe80::/10`, multicast, IPv4-mapped forms of the blocked IPv4 ranges.
3. Connect to the resolved address that passed (pinning it, so DNS rebinding cannot swap it) with the hostname for TLS.
4. No redirects.
5. Timeouts: 5 seconds to connect, 10 seconds total; response body read capped at 64 KB.
6. Tests cover each blocked range, rebinding and redirects.

## 12. Webhook verification

Every inbound webhook verifies before parsing the body as trusted input, records `webhook_receipts (provider, external_id)` (or `billing_events` for Stripe) before doing work, and answers quickly; the work runs in a workflow (ARCHITECTURE §7.3).

| Provider | Verification | Dedupe id | Body limit |
|---|---|---|---|
| Stripe `/webhooks/stripe` | `Stripe-Signature` checked with the official library on the raw body, 300-second tolerance | `event.id` in `billing_events` | 1 MB |
| Twilio `/webhooks/twilio` | `X-Twilio-Signature` (HMAC-SHA1 of the full public URL plus sorted POST parameters, keyed by `TWILIO_AUTH_TOKEN`) with the official helper; the URL is rebuilt from `APP_URL`, never from proxy headers | `MessageSid` plus status for callbacks | 64 KB |
| Telegram `/webhooks/telegram` | `X-Telegram-Bot-Api-Secret-Token` equals `TELEGRAM_WEBHOOK_SECRET` (constant-time); private chats only | `update_id` | 1 MB |
| Postmark inbound `/webhooks/postmark-inbound` | Postmark does not sign inbound webhooks: HTTPS with basic auth credentials in the URL, compared in constant time; optional allowlist of Postmark's published IPs (**verify** the current list); reply token resolved with `tenant_for_reply_token` | Postmark `MessageID` | 35 MB (attachments) |
| Google `/webhooks/google` | v1 uses it only for Cross-Account Protection (RISC) security events: a JWT signed by Google, checked against Google's published keys with issuer and audience (**verify**). On a token-revoked or account-disabled event, Magpie marks the connection revoked and deletes its tokens. | `jti` | 64 KB |
| Microsoft `/webhooks/microsoft` | Not used in v1. Reserved for Graph change notifications in v2 (validation token handshake and `clientState`). Returns 404 until then. | | |

Outgoing webhooks (FR-API-3, M8) are signed with HMAC-SHA256 over `<timestamp>.<raw body>` using the endpoint's `webhook_signing_secret`. The timestamp is in the signature header, and receivers should reject anything older than 5 minutes. API.md defines the header names; the secret is shown once and can be rolled with a 24-hour overlap.

## 13. HTTP security headers, CSP and CSRF

Set by `apps/api` on every response (the web app is served by the api from the same origin, API.md §1):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | see below |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` (except `/files/shared/*`: `cross-origin`) |
| `Cache-Control` | `no-store` on authenticated responses (API.md §2.12) |

Content Security Policy for the web app:

```
default-src 'self';
script-src 'self' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.r2.cloudflarestorage.com;
font-src 'self';
connect-src 'self' https://*.r2.cloudflarestorage.com https://*.ingest.sentry.io;
frame-src https://challenges.cloudflare.com;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'none';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-to csp-endpoint
```

- `style-src 'unsafe-inline'` is needed for inline style attributes from Radix positioning; scripts stay strict. Narrow the R2 and Sentry hosts to the exact hosts at deploy time.
- Stripe Checkout and the Customer Portal are full-page redirects, so no Stripe frames are needed.
- Run the policy in report-only mode on staging for a week before enforcing it in production.

CSRF:
- The session cookie is `SameSite=Lax`.
- Every non-GET `/api/app/*` and `/api/ops/*` request must carry an `Origin` equal to `APP_URL` (API.md §2.10); Better Auth checks origins on `/api/auth/*`.
- `/api/v1` and `/mcp` use bearer tokens, not cookies, so CSRF does not apply.
- Signed links that change state (unsubscribe, approval edit links) are one-time and confirm with a POST from a page, never on GET.

## 14. Rate limiting and abuse limits

HTTP buckets are in API.md §2.8 (counters in Postgres `rate_limits`, shared by every replica and by Better Auth). These limits are added here:

| Limit | Value | Key |
|---|---|---|
| `/sign-in/email` | Better Auth default (3 per 10 seconds) plus the lockout in §3.4 | IP; email |
| `/sign-up/email` | 5 an hour | IP |
| Magic link, password reset, verification email | 3 per 15 minutes per email; 10 a minute per IP (API.md §2.8) | email; IP |
| SMS verification code sends | 5 an hour per user, 10 a day per number (API.md §2.8) | user; number |
| SMS verification attempts | 5 per code; codes expire in 10 minutes (FR-CH-1) | code |
| Telegram inbound | 30 a minute per chat; excess ignored with one "slow down" reply | chat id |
| SMS inbound | 30 an hour per number | number |
| Workspaces created | 3 a day per user | user |
| Invitations | 50 a day per workspace | tenant |
| Bot runs started by a person | 30 a minute per user | user |
| Outreach emails | the `emails_sent` entitlement, plus 100 an hour per workspace | tenant |

Every 429 carries `Retry-After` (API.md §2.8).

## 15. Dependency, code and secret scanning in CI

| Check | Tool | Gate |
|---|---|---|
| Secrets in commits | gitleaks on every PR; GitHub secret scanning with push protection | Blocks merge |
| Dependency vulnerabilities | `pnpm audit --audit-level=high` and OSV-Scanner on the lockfile; Renovate opens update PRs weekly, security updates immediately | High or critical with a fix available blocks merge |
| Static analysis | CodeQL for TypeScript | High findings block merge |
| Container image | Trivy on the built `api` and `worker` images | Critical with a fix available blocks release |
| Lockfile integrity | `pnpm install --frozen-lockfile` | Blocks |
| Licenses | Allowlist of licenses; AGPL and Enterprise-licensed code refused (README.md) | Blocks |
| GitHub Actions | Third-party actions pinned by commit SHA; `permissions` minimal per job; OIDC instead of long-lived cloud keys where possible | Review |
| SBOM | Generated per release (Syft) and stored with the release | n/a |
| Isolation suites and evals | `pnpm test:isolation`, `pnpm eval` | Block (AGENTS.md) |

Branch protection on `main`: PRs only, required checks, at least one review once there are two engineers, no force pushes.

## 16. Backups and restore drills

| Layer | What | How | Retention |
|---|---|---|---|
| Neon point-in-time restore | the whole database, DBOS schema included | Neon history retention of at least 7 days (**verify** the plan's retention) | 7 days, RPO 1 hour (ARCHITECTURE §13) |
| Daily logical backup | `pg_dump --format=custom` of the production database as `magpie_backup` (§20) | Encrypted with `age` to `BACKUP_AGE_RECIPIENT`; uploaded to a bucket in a separate Cloudflare account with a write-only token | 30 days (lifecycle rule) |
| Files | the R2 bucket | Daily copy of new and changed objects to the backup bucket (**verify** whether R2 object versioning is available; if so, also enable it) | 30 days |
| Configuration | Railway variables, Stripe products, Postmark and Twilio settings | Exported to the founders' password manager after each change | current plus previous |

Restore drill every quarter (PRD §7) and at M10 (BUILD_PLAN):
1. Restore the latest logical backup into a new Neon branch, and separately a point-in-time restore to a chosen minute.
2. Run migrations to head, the isolation suites and a smoke test of sign-in, a bid page and a file download.
3. Compare row counts per table with production at the backup time.
4. Record the time to restore against RTO 4 hours.
5. File the record (date, who, durations, problems) as SOC 2 evidence.

Deleting a workspace removes it from the live database and R2 at once. Its data ages out of backups within 30 days. A restore never brings a deleted workspace back into production; restored data is used only to recover the workspace that was lost.

## 17. Incident response

| Severity | Examples | Response |
|---|---|---|
| SEV1 | Cross-tenant exposure, leaked secrets, outbound messages sent without approval, full outage | Founder paged at once; work until contained; customer notice as below |
| SEV2 | One feature down (SMS, digest, Bot runs), payment processing failing, provider outage | Respond within 1 hour in business hours, 4 hours otherwise |
| SEV3 | Degraded performance, single-tenant bug | Next business day |

Steps:
1. **Detect** through Sentry, alerts (ARCHITECTURE §12) and support reports.
2. **Contain** with the kill switches in `feature_flags` (FR-OPS-4), which take effect within 1 minute:
   - `ops.pause_all_bots`;
   - `ops.pause_outbound_email`;
   - `ops.pause_sms`;
   - `ops.pause_provider.<name>`;
   - `ops.signups_disabled`.

   Also: rotate exposed secrets (§6.4), suspend affected tenants.
3. **Fix** with an ordinary PR when possible; hotfixes still pass CI.
4. **Recover** data from backups if needed (§16).
5. **Notify.** Affected customers without undue delay, and within 72 hours of confirming a personal data breach (the DPA commitment). Regulators and individuals as the law of each affected person's place requires (US state breach laws; the supervisory authority within 72 hours for EU personal data under GDPR). Model providers, Twilio, Stripe or Google when their terms require it.
6. **Review**: a written post-incident review within 5 business days with timeline, cause, impact and actions, kept as SOC 2 evidence.

A public status page lists incidents affecting customers.

## 18. Compliance

### 18.1 SOC 2

| Milestone | Work |
|---|---|
| M10 (PRD §7: readiness from M10) | Connect a compliance platform (Vanta or Drata, **verify** cost). Write policies: information security, access control, change management, incident response, vendor management, data retention, business continuity, acceptable use. Start quarterly access reviews and the restore drill record. |
| v1.5 (PRD §5) | SOC 2 Type I audit. |
| After Type I | Type II observation window of 3 to 6 months, then the Type II report. |

Controls the build already provides, with evidence:

| Area | Control | Evidence |
|---|---|---|
| Logical access | Roles and permissions (§4), staff roles, Google sign-in with 2-Step Verification for staff, quarterly access reviews | Role tests, review records |
| Change management | PRs, required checks, reviews, migrations as a release step | GitHub history |
| Vulnerability management | §15 scans, Renovate, M10 security review | CI logs |
| Monitoring | Sentry, metrics, alerts (ARCHITECTURE §12), audit log | Alert history |
| Incident response | §17 | Post-incident reviews |
| Backup and recovery | §16 | Drill records |
| Encryption | TLS everywhere, encryption at rest by Neon and R2, envelope encryption for secrets (§6) | Configuration |
| Vendor management | Subprocessor list and reviews (§18.3) | Vendor files |
| Data retention and deletion | §7.2, deletion tests (BUILD_PLAN M7) | Test results |
| Confidentiality of AI processing | No-training terms, provider exclusions (§18.10, §18.11) | Vendor terms |

### 18.2 Privacy requests (GDPR, CCPA)

- **Roles.** Magpie is the processor (GDPR) or service provider (CCPA) for workspace data (CRM records, bids, contacts of the customer's companies) and the controller for its own account data (users, billing contacts, product analytics).
- **Requests from a workspace's contacts** (for example a subcontractor asking for its data) are forwarded to the workspace owner within 5 business days; Magpie helps the owner export or delete the contact.
- **Requests from Magpie users:**
  - access: an export of the person's account data;
  - correction: in-app or by support;
  - deletion: account deletion (§3.6);
  - objection or opt-out of marketing email: an unsubscribe link plus a support address.
- **Deadlines.** GDPR: one month, extendable by two months. CCPA and other US state laws: 45 days, extendable by 45 days. Identity is verified by signed-in session or by email from the account's address.
- **Selling and sharing.** Magpie does not sell or share personal information for cross-context behavioral advertising.
- **Thresholds.** CCPA applies to Magpie as a business only above its thresholds (**verify**); Magpie honors the same rights for everyone regardless.
- **Data residency.** All data and processing is in the US (ARCHITECTURE §1). EU transfers rely on the DPA's Standard Contractual Clauses.

### 18.3 DPA and subprocessors

- A Data Processing Addendum is published with the Terms before pilots (BUILD_PLAN M6 checklist): processing instructions, confidentiality, security measures (this file), subprocessors, breach notice within 72 hours, assistance with requests, deletion at the end of service (§7.2), audits through SOC 2 reports once available, and the EU Standard Contractual Clauses.
- Customers get 30 days' notice of a new subprocessor through the subprocessor page and email, and may object.

| Subprocessor | Purpose | Data | Location |
|---|---|---|---|
| Neon | Database | All workspace data | US (**verify** region) |
| Railway | Application hosting (api, worker, scanner) | All workspace data in transit and in memory | US (**verify** region) |
| Cloudflare | File storage (R2), Turnstile | Files; sign-up request metadata | US location hint (**verify**) |
| Anthropic | Model calls | Prompts and outputs for runs | US |
| OpenAI | Model calls and embeddings | Prompts, outputs, text to embed | US |
| Google (Gemini API) | Model calls, only if enabled in `models.json` | Prompts and outputs | US |
| Kontract | Market data, bid text, website reading | Search filters, UEIs, notice ids, URLs, an opaque workspace label | US (**verify** the operating entity and hosting) |
| Stripe | Billing and tax | Billing contact, address, tax ids, payment data | US |
| Twilio | SMS to workspace users | Users' phone numbers and message text | US |
| Telegram | Messages to users who connect Telegram | Telegram chat id and message text | Telegram's infrastructure (**verify**) |
| Postmark (ActiveCampaign) | Email sending and inbound replies | Email addresses and message content | US |
| Sentry | Error tracking | Error metadata with ids, no bodies (§8) | US |
| Traces backend (chosen by ADR) | Traces | Span metadata with ids | US |
| DBOS Conductor | Only if adopted (AGENT_RUNTIME §4.13) | Workflow metadata (**verify** what it receives) | **verify** |

Google (Gmail) and Microsoft (Outlook) are integrations the customer connects, not Magpie subprocessors. Have I Been Pwned receives only a 5-character hash prefix, which is not personal data.

### 18.4 CAN-SPAM

Outreach email (quote requests, follow-ups, Bot emails to outside contacts) is sent for the customer, who is the sender. Magpie supplies the mechanics (FR-SUB-6):

| Requirement | Implementation |
|---|---|
| Accurate header information | From names the owner and their business; sent from the owner's connected mailbox or Magpie's domain naming the owner; `Reply-To` is the tracked address |
| Non-deceptive subject lines | Subjects are shown in the approval preview; the platform prompt forbids misleading subjects |
| Physical postal address | The workspace's `tenant_settings.outreach_footer` postal address is required before any outreach is sent |
| Clear opt-out | Every outreach email has a working unsubscribe link (`/unsubscribe/<token>`) and a `List-Unsubscribe` header |
| Opt-out honored | Immediately (the law allows 10 business days): the address goes into `suppressions` and sending to it is blocked |
| Opt-out works for 30 days after sending | Links stay valid for at least 30 days, including across `LINK_SIGNING_SECRET` rotations (§6.4) |
| No sale or transfer of opted-out addresses | Suppressions are never exported to other workspaces |
| Monitoring | The Terms make customers responsible for their outreach; Magpie limits volume with `emails_sent` and approval of every message |

Bounces and spam complaints from Postmark also add `suppressions` rows (`hard_bounce`, `complaint`). Magpie's own email to its users (digests, notifications) is transactional and still carries an email-preferences link.

### 18.5 TCPA and 10DLC

Magpie texts only its own users: owners and staff of a workspace who verified their own number in the app (PRD §7, ARCHITECTURE §14.7). It never texts contacts, subcontractors or customers of a workspace in v1.

- **Consent.**
  - Connecting SMS shows, next to an unchecked box: "Text me approval requests, deadline reminders and my daily digest from Magpie. Message frequency varies. Message and data rates may apply. Reply STOP to stop, HELP for help. Terms and Privacy." The links go to the Terms and Privacy pages.
  - The 6-digit code confirms the number belongs to the person (FR-CH-1).
  - Consent is recorded as an `audit_log` row `channel.sms_opt_in` with the text version, number, IP, user agent and time.
- **Opt-out.**
  - STOP, and the standard synonyms Twilio recognizes, turn SMS off for that number (`channel_bindings.is_enabled = false`); Twilio's opt-out handling on the messaging service is also on.
  - START re-enables.
  - HELP returns help text with the support address.
  - Every opt-out and opt-in is audited.
- **Timing.** Quiet hours from 9 pm to 7 am in the user's timezone by default (FR-CH-5); only deadline reminders inside 2 hours ignore them.
- **Content.** Account notifications and replies to the user's own messages; no marketing texts.
- **10DLC.** Register Magpie's brand (EIN) and one campaign during M0 (BUILD_PLAN §0.1):
  - use case "Account Notification", or "Mixed" if the carrier review requires it because users chat with the Assistant (**verify** with Twilio during registration);
  - campaign description, message flow (the in-app opt-in above, with a screenshot) and sample messages;
  - the privacy policy and terms URLs, which Twilio requires for new campaigns from June 30, 2026;
  - opt-out and help keywords and replies.

  Twilio blocks messages from unregistered US 10DLC numbers (error 30034), so no SMS ships before approval. The privacy policy states that mobile numbers and SMS consent are not shared with third parties for marketing.
- **Sample messages for registration:**
  1. "Magpie: A7 Sub Finder wants to send a quote request to ABC Cleaning for Fort Lee custodial (due Nov 14). Reply A7 to approve, X A7 to skip. Reply STOP to opt out."
  2. "Magpie: Proposal for Hampton grounds maintenance is due in 2 hours (2:00 PM ET). Open: <link>. Reply STOP to opt out."
  3. "Magpie daily: 3 new matches. 1) Custodial, VA Medical Center, due Dec 3, score 88. Reply 1 to pursue. 2 approvals waiting. Reply ? for the list."

### 18.6 Google API Services User Data Policy

| Scope | Classification | Release | Requirement |
|---|---|---|---|
| `openid`, `email`, `profile` | non-sensitive | MVP sign-in | Brand verification of the OAuth consent screen |
| `gmail.send` | sensitive (Gmail API scopes page, checked 2026-11-10) | MVP sending (FR-SUB-2) | App verification for a sensitive scope; no CASA assessment for sensitive-only access |
| `gmail.readonly` and other Gmail read scopes | restricted | v2 (PRD §11) | Verification plus an annual CASA security assessment by a Google-designated assessor and a Letter of Assessment |

Rules that apply now:
- Limited Use: Gmail data is used only to send the messages a person approved in Magpie; no transfer except as needed to provide that feature or for security and legal reasons; no human reading except with the person's consent, for security, or as the law requires; no use for advertising.
- No Google Workspace API data is used to create, train or improve AI or machine learning models (Workspace API user data policy). Magpie trains no models at all (§18.11).
- An affirmative Limited Use statement is published on the privacy page: "Magpie's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements." (**verify** wording against Google's current guidance.)
- Separate Google Cloud projects and OAuth clients for staging and production. Request only `gmail.send` in the connect flow; never `https://mail.google.com/`, which is restricted.
- Tokens are stored per §6; disconnect revokes them (§6.3).
- Until verification is approved, sending uses Postmark (BUILD_PLAN M6 checklist).

CASA plan for v2 (start when paying customers exceed 50, PRD §12):
1. Confirm the scopes v2 needs and that Google assigns the assessment tier (**verify** the current tier process).
2. Pick an authorized assessor; budget and timeline from quotes (**verify**).
3. Prepare evidence from §15 and §16 and the SOC 2 policies; fix findings.
4. Submit for restricted-scope verification with the Letter of Assessment.
5. Calendar the annual reassessment.

### 18.7 Microsoft

- One multi-tenant Microsoft Entra app for sign-in (`openid`, `email`, `profile`) and sending (`Mail.Send` delegated, `offline_access`, `User.Read`). No mail reading in v1.
- Complete publisher verification before inviting pilots. It is free but needs a verified Microsoft AI Cloud Partner Program account, and without it users in many organizations cannot consent to newly registered multi-tenant apps (Microsoft's risk-based step-up consent).
- Some customer organizations require admin consent; the connect page explains this in plain words.
- Follow the Microsoft APIs Terms of Use and the identity platform terms; store tokens per §6.

### 18.8 Google Places

- From Places results, only `place_id` may be stored indefinitely (`companies.place_id`, PRD FR-SUB-1). Latitude and longitude may be cached for at most 30 days (Google Maps Platform service terms, **verify** the current version).
- Names, addresses, phones, ratings and other Places fields are shown live with Google attribution and are never written to Magpie tables.
- When a person saves a subcontractor first found through Places, its name, phone and address come from the business's website (`web.read_url`, provenance `website`) or from the person (provenance `user`), never from the Places response.
- Kontract performs Places lookups in v1 and must follow the same rule.

### 18.9 FAR and solicitation AI-use rules

There is no government-wide FAR clause banning AI in proposal preparation as of 2026-11-10. Individual solicitations do ban generative AI in any part of a quote or proposal, or require a disclosure form. GSA proposed GSAR 552.239-7001 in June 2026 on safeguarding government data in AI systems; it is not final and concerns contract performance more than proposal writing (**verify** status; a "FAR Case 2026-003" on AI in proposals was reported but not confirmed from a primary source, **verify**).

Product controls (PRD principle 5, FR-BID-6):
1. Bid Reader looks for AI-use rules in every solicitation and amendment (AGENT_RUNTIME §3.8, golden evals at 100% detection).
2. A ban sets the bid to no-AI drafting: drafting and price sheet drafting tools are removed and refused (AGENT_RUNTIME §3.13).
3. Disclosure requirements keep `drafts.ai_disclosure` current and offer a disclosure statement.
4. **AI-use log.** For each bid, an export lists every run, Bot, model, provider and output (brief, requirements, drafts, price sheets) with dates, built from `agent_runs`, `agent_steps` and `drafts.ai_disclosure`. The owner can attach it to a disclosure or keep it for a protest.
5. Magpie never hides AI involvement and never claims a draft was written by a person.
6. The Terms tell customers that compliance with a solicitation remains their responsibility and that they must read the solicitation's own instructions.

### 18.10 Model provider exclusions for defense customers

- The Department of Defense designated Anthropic a supply chain risk on 2026-03-04, and defense contractors were told to certify that they do not use Anthropic models in their DoD work. Anthropic challenged the designation in court; **verify** its current status before launch.
- Magpie's default provider order puts Anthropic first (ARCHITECTURE §8), so exclusions are a launch requirement:

1. Owners and admins set excluded providers in workspace settings (FR-SET-1); stored in `tenant_settings.model_policy.excludedProviders`; audited. PRD §5 lists a "provider exclusion UI" for v1.5; v1 ships this settings control, and v1.5 adds per-bid exclusions and a richer UI.
2. The gateway never calls an excluded provider, not even in failover (ARCHITECTURE §8; BUILD_PLAN M3 test).
3. Every tier has an entry from a second provider so excluded tenants keep working, including `deep` (AGENT_RUNTIME §4.10).
4. Embeddings for a tenant come only from allowed providers; if none is allowed, retrieval is keyword-only (AGENT_RUNTIME §12.2). Shared public-text embeddings (`market_opportunity_texts`) contain no tenant data.
5. When a workspace pursues a bid from a Department of Defense agency and has no exclusions set, the owner sees a one-time notice explaining the setting.
6. The AI-use log (§18.9) shows the provider and model of every step, so a contractor can support its certification.

### 18.11 No training on customer data

- Magpie trains no models on customer data. Evals use public solicitations and synthetic profiles only (AGENT_RUNTIME §13).
- Model providers are used through business API terms that exclude training on inputs and outputs by default:
  - OpenAI API;
  - Anthropic commercial API;
  - Google Gemini API on the paid tier only (unpaid tiers may use data to improve products).
  **Verify** each provider's current terms and retention settings, and request zero data retention where offered and compatible with the models used.
- Provider keys are created under those terms (BUILD_PLAN §0.1).
- Kontract receives no customer documents and is contractually barred from training on Magpie request data (**verify** the agreement).
- The privacy page and DPA state the commitment, and the subprocessor list (§18.3) names every provider.

## 19. Verify before launch

1. Better Auth option names and defaults in §3.1, custom organization roles, the admin plugin's user fields (§20), token storage for login accounts, MCP plugin token lifetimes.
2. Railway's client IP header and proxy addresses (§3.1).
3. DBOS connection requirements (pooler or direct), `DBOS__APPVERSION` and `DBOS__VMID` names (§5.2).
4. R2: enforcing a signed `Content-Length` on presigned `PUT`, object versioning, location hints (§10.2, §16).
5. Neon history retention on the chosen plan, and Neon and Railway regions (§16, §18.3).
6. Postmark: current inbound IP list, policy for outreach on a second stream (§12, §5.5).
7. Google: RISC event verification, Limited Use statement wording, CASA tier process and cost (§12, §18.6).
8. Twilio: campaign use case for chat plus notifications; restricted Stripe key permissions (§18.5, §5.5).
9. Google Places caching terms version (§18.8).
10. GSAR 552.239-7001 status and any FAR case on AI in proposals (§18.9).
11. The DoD designation's current legal status (§18.10).
12. Provider no-training and retention terms; Kontract agreement (§18.11).
13. CCPA thresholds (§18.2); Telegram data location (§18.3).

## 20. Schema additions requested

These are not in DATA_MODEL.md. Do not build them until the data model is updated.

1. **Table `staff_assignments`** (`magpie_ops` pool only, no tenant policy; add to DATA_MODEL §2.1):
   ```sql
   create table staff_assignments (
     staff_user_id uuid not null references users(id) on delete cascade,
     tenant_id uuid not null references tenants(id) on delete cascade,
     role text not null check (role in ('reviewer','support')),
     created_by uuid not null references users(id),
     created_at timestamptz not null default now(),
     primary key (staff_user_id, tenant_id, role)
   );
   ```
   Needed for "reviewers see only their assigned tenants" (FR-OPS-5) and reviewer routing (AGENT_RUNTIME §8.1).
2. **`impersonations.impersonated_user_id uuid not null references users(id)`** and **`impersonations.expires_at timestamptz not null`**: who was impersonated and the 60-minute limit (FR-OPS-2).
3. **Better Auth admin plugin user fields** on `users`, mapped through `fields`: `auth_role text not null default 'user' check (auth_role in ('user','admin'))`, `banned boolean not null default false`, `ban_reason text`, `ban_expires timestamptz`. **Verify** the exact field list of the pinned admin plugin. `auth_role = 'admin'` is set only for staff with `staff_role` in (`support`, `admin`) so the plugin's impersonation endpoint accepts them.
4. **Role `magpie_dbos`**: `create role magpie_dbos nologin;` owning only the DBOS system schema, with no grants on application tables. DBOS then never runs with `magpie_owner` rights.
5. **Role `magpie_backup`**: `create role magpie_backup nologin bypassrls;` with `select` on all tables and sequences, for `pg_dump` (§16). `pg_dump` needs `BYPASSRLS` to read every tenant's rows.
6. **Table `rate_limits`**, already requested in API.md §15 for Better Auth's `rateLimit` model and the API limiter; this file depends on it.
7. **`trial_claims`**, `tenants.status_reason` and `tenants.past_due_since` are requested in BILLING §11; this file depends on them (§3, §5.3).
