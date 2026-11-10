# Magpie: API

**Status:** ready to build. **Last updated:** 2026-11-10.

This file specifies every HTTP surface of `apps/api`: conventions, the endpoint catalog for every MVP and v1 requirement in [PRD.md](PRD.md), the realtime stream, inbound webhooks, the public API and the MCP server. Table, column, module, queue and role names come from [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md). If this file disagrees with those two, they win and this file gets fixed. Provider details (endpoints, limits, credentials) are in [INTEGRATIONS.md](INTEGRATIONS.md). Changes this file needs in the data model are listed in §15, not made silently.

## 1. Surfaces

| Prefix | Caller | Authentication | Tenant comes from | Release |
|---|---|---|---|---|
| `/api/auth/*` | browser | Better Auth (cookie session) | none | MVP |
| `/api/app/*` | the web app | Better Auth session cookie | `sessions.active_tenant_id`, checked against `X-Workspace-Id` | MVP |
| `/api/v1/*` | customer scripts and integrations | `Authorization: Bearer mgp_...` (`api_keys`) | the key's `tenant_id` | v1 |
| `/api/ops/*` | Magpie staff | session cookie, `users.is_staff = true`, `users.staff_role` | the `:tenantId` path parameter | v1 |
| `/mcp` | AI clients (Claude, ChatGPT, others) | OAuth 2.1 bearer access token | the workspace bound to the token | v1 |
| `/webhooks/<provider>` | Stripe, Twilio, Telegram, Postmark | per provider (§11) | resolver functions (DATA_MODEL §2.2) | MVP |
| `/ics/<token>.ics` | calendar apps | token in the path | the token's `api_keys` row | MVP |
| `/unsubscribe/<token>` | outreach recipients | HMAC-signed token | the token payload | MVP |
| `/files/shared/<token>` | quote request recipients | HMAC-signed token | the token payload | MVP |
| `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` | MCP clients | none | none | v1 |
| `/health`, `/ready` | Railway, uptime checks | none | none | MVP |

Rules:
- The web app and the api share one origin (`APP_URL`). The api serves `/api/*`, `/mcp`, `/webhooks/*`, `/ics/*`, `/unsubscribe/*`, `/files/shared/*`, `/.well-known/*`, `/health` and `/ready`; every other path serves the built web app. Record the hosting mechanism in an ADR. Same origin keeps Better Auth cookies first-party and CSRF simple.
- Every `/api/app/*` request carries `X-Workspace-Id: <tenant uuid>`. If it differs from the session's active tenant, the api answers `409 workspace_switched` (another tab switched workspaces) and the web app reloads. Routes marked "no workspace" in §5.1 skip the check.
- `/api/app/*` is internal: it may change in any release. `/api/v1/*` and `/mcp` change additively only; a breaking change means `/api/v2`.

## 2. Conventions

### 2.1 JSON and names

| Rule | Detail |
|---|---|
| Content type | `application/json; charset=utf-8` for requests and responses, except files, CSV, ICS, SSE and problem responses (`application/problem+json`). |
| Property names | camelCase. The database is snake_case; mapping is mechanical (`due_at` becomes `dueAt`, `is_ai_drafting_allowed` becomes `isAiDraftingAllowed`). |
| Not mapped | Keys inside `custom` (record custom fields) are `field_definitions.key` values and stay snake_case. Enumeration values stay exactly as DATA_MODEL's check constraints (`no_bid`, `needs_approval`). |
| jsonb columns | Keys are camelCase, as DATA_MODEL's comments already show (`{singleCents, aggregateCents, surety}`). Every jsonb shape has a zod schema in `packages/shared`. |
| Resource shape | Unless a row in §5 says otherwise, a resource's JSON is the camelCase projection of its table row without `tenant_id`, `search` and secret columns (`key_hash`, `ciphertext`, `nonce`, `wrapped_data_key`, `password`, OAuth tokens), plus the expansions named in the row. |
| Unknown properties | Request bodies are `z.strictObject`: unknown properties fail with `validation_failed`. Clients must ignore unknown response properties. |

### 2.2 Ids, time and money

| Kind | Format |
|---|---|
| Ids | uuid strings (UUIDv7, lowercase, with dashes). Path parameters that are not uuids return `404 not_found`, never `400`. |
| Timestamps | ISO 8601 in UTC with `Z` and milliseconds: `2026-11-10T14:05:09.123Z`. Requests may send any offset; the server stores UTC. |
| Dates | `YYYY-MM-DD` for `date` columns (`expires_on`, `close_date`, `valid_until`). |
| Local times | `HH:MM` 24-hour strings, interpreted in the workspace timezone (`tenants.timezone`) unless the field says user timezone (`users.timezone`). |
| Time zones | IANA names (`America/New_York`). |
| Money | Integer cents in `*Cents` properties plus `currency` (ISO 4217, `USD` in v1) on the same object. No floats for money anywhere. |
| Percent | Basis points in `*Bps` integers (`marginBps: 1250` is 12.5%). Quantities on price lines are decimal strings with up to 4 places (`"12.5000"`), matching `numeric(14,4)`. |
| AI and vendor cost | Integer millionths of a US dollar in `costMicros`. |
| Large integers | All integers fit in `Number.MAX_SAFE_INTEGER`; the server rejects larger inputs with `validation_failed`. |

### 2.3 Nulls, absence and PATCH

- Responses include every documented property. A property with no value is `null`, never omitted.
- `PATCH` bodies are partial: an omitted property is unchanged, `null` clears it (when the column is nullable), an array replaces the whole array.
- `PUT` is used only where the whole sub-resource is replaced (for example a tool policy).
- Changes to `custom` merge by key: `{"custom": {"crew_size": 4, "old_key": null}}` sets one key and removes another.

### 2.4 Pagination

All list endpoints use cursor pagination.

| Parameter | Rule |
|---|---|
| `limit` | 1 to 100. Default 25. |
| `cursor` | Opaque string from the previous page's `nextCursor`. A cursor encodes the sort values and id of the last row (base64url JSON, HMAC-signed so clients cannot forge it). A cursor from another sort or filter returns `validation_failed`. |

Response envelope (`Page<T>`):

```json
{ "data": [], "nextCursor": "eyJ...", "total": null }
```

`total` is `null` unless the endpoint documents `includeTotal=true`, which returns a count capped at 10,000 (`totalIsCapped: true` when capped). Lists that are always small (pipelines, bots, tags, field definitions, channels) return `{ "data": [] }` without paging and say so.

### 2.5 Filtering and sorting

Simple lists filter with query parameters in bracket form, combined with AND:

```
GET /api/app/deals?filter[stageId][in]=<uuid>,<uuid>&filter[dueAt][lte]=2026-12-01T00:00:00Z&filter[custom.crew_size][gte]=3&sort=-dueAt,name
```

| Operator | Meaning | Value |
|---|---|---|
| `eq`, `ne` | equals, not equals | one value |
| `in`, `nin` | in list, not in list | comma-separated, max 100 values |
| `lt`, `lte`, `gt`, `gte` | comparisons | number, date or timestamp |
| `contains` | case-insensitive substring | text, 1 to 200 characters |
| `startsWith` | case-insensitive prefix | text |
| `isNull` | is or is not null | `true` or `false` |
| `hasAny`, `hasAll` | array overlaps or contains | comma-separated (for `kinds`, `naicsCodes`, `tagIds`) |
| `withinDays` | between now and now plus N days (negative N looks back) | integer -365 to 365 |

- Field names are the API property names. Custom fields are `custom.<key>`. Tags filter on `tagIds`. The value `me` stands for the current user id on user fields (`ownerUserId`, `assigneeUserId`, `requestedForUserId`).
- Each list endpoint declares its filterable and sortable fields in its `*ListQuery` schema. An unknown field or an operator the field's type doesn't support returns `validation_failed`.
- `sort` is a comma-separated list of up to 3 fields, `-` prefix for descending. Every sort gets `id` appended as a tiebreaker. Archived records are excluded unless `filter[archived][eq]=true` or `includeArchived=true`.
- Record lists also accept `POST /api/app/<records>/query` with a JSON body `{ filters: [{field, op, value}], sort: [{field, direction}], limit, cursor }`. This is the same shape as `saved_views.filters` and `saved_views.sort`, so a saved view runs without translation. Both forms compile to the same query builder in `packages/core/crm`.

### 2.6 Concurrency

- Records with `updated_at` return `ETag: W/"<updated_at in epoch ms>"` on GET, POST and PATCH.
- PATCH accepts `If-Match`. A mismatch returns `409 conflict` with `reason: "stale"` and the current resource in `current`. PATCH without `If-Match` is last-write-wins, except draft content (§5.12), which requires `If-Match`.

### 2.7 Idempotency

- Every POST that creates a resource, starts work, sends something or charges money accepts `Idempotency-Key` (1 to 255 visible ASCII characters; send a UUID). The web app always sends one. `/api/v1` clients should.
- The server stores the key with the actor, method, path and a SHA-256 of the body for 24 hours (`idempotency_keys`, §15).
  - Same key, same body, finished: replay the stored status and body with `Idempotent-Replayed: true`.
  - Same key, same body, still running: `409 idempotency_conflict` with `Retry-After: 1`.
  - Same key, different body or path: `409 idempotency_conflict`.
- Responses with status 5xx are not stored, so a retry runs again.
- Natural uniqueness still applies without a key: pursuing the same match twice returns the same deal (unique `(tenant_id, opportunity_id)` on `deals`).

### 2.8 Rate limits

Counters live in Postgres (`rate_limits`, §15), shared by every api replica and by Better Auth. No Redis in v1.

| Bucket | Limit | Key |
|---|---|---|
| `/api/app/*` general | 600 requests a minute | session |
| `/api/app/threads/:id/chat` | 20 a minute | user and tenant |
| `/api/app/market/search` | 60 a minute | tenant |
| `/api/app/channels/sms/start` | 5 an hour per user, 10 a day per phone number | user, phone |
| `/api/app/channels/telegram/link` | 10 an hour | user |
| `/api/app/imports`, `/api/app/exports`, `/api/app/workspace/exports` | 10 an hour; 1 workspace export running at a time | tenant |
| `/api/auth/*` | Better Auth defaults, plus sign-in and magic link 10 a minute per IP | IP |
| `/api/v1/*` | 600 a minute (FR-API-1) | API key |
| `/mcp` | 600 a minute | OAuth grant |
| `/ics/*` | 60 an hour | token |
| `/webhooks/*` | none (provider controlled); body size limits in §11 | |

Every limited response carries `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` (seconds). A 429 adds `Retry-After` (seconds) and the `rate_limited` problem.

### 2.9 Errors

Every error is RFC 9457 `application/problem+json`:

```json
{
  "type": "https://app.example.com/problems/validation_failed",
  "title": "Check the highlighted fields.",
  "status": 400,
  "code": "validation_failed",
  "detail": "The NAICS code 99999 doesn't exist. Pick a code from the list.",
  "instance": "/api/app/profile",
  "requestId": "01J...",
  "errors": [{ "path": "naicsCodes.2", "code": "unknown_naics", "message": "The NAICS code 99999 doesn't exist." }]
}
```

- `type` is `<APP_URL>/problems/<code>`; that page explains the code. `title` is fixed per code; `detail` is specific. Both follow PRD §9 wording: plain, second person, what happened then what to do, no internals ("token", "RLS", "webhook") outside admin and ops screens.
- `errors` appears only on `validation_failed` and lists each failing path.
- Extension members used by specific codes: `reason` (on `conflict`), `current` (on stale `conflict`), `limitKey`, `used`, `limit` (on `limit_reached`), `retryAfterSeconds` (on `rate_limited` and `external_unavailable`), `attemptsLeft` (on SMS verification), `provider` (on `external_unavailable` and `model_unavailable`).
- The client switches on `code`, never on `status` or text.
- Unexpected errors return `500 internal_error` with only `requestId`; details go to Sentry.

The fixed list of `code` values (`packages/shared/src/problems.ts` exports them as a string literal union):

| code | Status | When |
|---|---|---|
| `validation_failed` | 400 | malformed JSON, schema failure, unknown filter, bad cursor, business rule on input (unknown NAICS, end before start) |
| `unauthorized` | 401 | no or expired session, bad API key, bad or expired OAuth token, bad webhook signature |
| `forbidden` | 403 | the role or API key scope doesn't allow it (FR-ACC-4); staff route for a non-staff user |
| `not_found` | 404 | no such id in this workspace, including ids that exist in another workspace |
| `conflict` | 409 | state does not allow it; `reason` is one of `stale`, `duplicate`, `state`, `in_use`, `suppressed_address`, `do_not_contact` |
| `idempotency_conflict` | 409 | §2.7 |
| `workspace_switched` | 409 | `X-Workspace-Id` differs from the session's active workspace |
| `approval_expired` | 409 | deciding an approval past `expires_at` (FR-APR-4) |
| `approval_already_decided` | 409 | deciding an approval whose status is not `pending` |
| `file_not_ready` | 409 | downloading or reading a file whose `scan_status` is `pending` |
| `limit_reached` | 402 | a plan entitlement or a per-run cap is used up (FR-BIL-4, FR-BOT-9); includes `limitKey`, `used`, `limit` |
| `payment_required` | 402 | the workspace is read-only for non-payment (FR-BIL-6); writes are refused |
| `workspace_suspended` | 403 | `tenants.status = 'suspended'`; only `/me`, `/workspaces`, `/billing` and data export answer |
| `workspace_read_only` | 403 | `tenants.status = 'deleting'` or `canceled` after the period end; reads and export still work |
| `ai_drafting_not_allowed` | 403 | a drafting action on a bid whose solicitation bans AI, or with `aiDraftingAllowed = false` (FR-BID-6) |
| `impersonation_blocked` | 403 | an external action while a staff member impersonates (FR-OPS-2) |
| `feature_not_available` | 403 | a feature flag or plan feature is off (for example Managed review, API access) |
| `payload_too_large` | 413 | body or file over its limit |
| `unsupported_media_type` | 415 | file type not on the allowed list, or wrong request content type |
| `rate_limited` | 429 | §2.8 |
| `internal_error` | 500 | unexpected |
| `external_unavailable` | 502 | a provider (Kontract, SAM.gov, Stripe, Twilio, Postmark, Google, Microsoft) failed or timed out after retries; `provider` names it |
| `model_unavailable` | 503 | no allowed LLM provider can serve the tier (ARCHITECTURE §8) |
| `service_unavailable` | 503 | planned maintenance or the database is unreachable |

### 2.10 Authentication, roles and permissions

- **Sessions.** Better Auth session cookie, `HttpOnly`, `Secure`, `SameSite=Lax`, cookie prefix `magpie`. Sessions expire after 30 days without use (`expiresIn` 30 days, `updateAge` 1 day) (FR-ACC-6).
- **CSRF.** Every non-GET `/api/app/*` and `/api/ops/*` request must carry an `Origin` header equal to `APP_URL`; otherwise `403 forbidden`. Better Auth applies its own origin check to `/api/auth/*`.
- **Workspace roles** (`memberships.role`): `owner` > `admin` > `member` > `viewer`. "Min role" in §5 means that role or higher. The Role column of §5 is what the route guards enforce. SECURITY.md's matrix must match it; if they differ, raise it rather than pick one.
- **Approval deciders.** A person may decide an approval when `requested_for_user_id` is them, or when their role is `admin` or higher. Viewers never decide.
- **Bots** act with the permissions of `agent_runs.acting_user_id` (FR-BOT-2); that is enforced in core, not in routes.
- **API keys** act as `api_keys.user_id` with that person's current role, narrowed by `scopes`: `read` allows GET only; `write` adds writes. A key stops working when it is revoked, expires, or the person leaves the workspace.
- **Staff** (`users.is_staff`) have `staff_role`: `support` (tenant views, impersonation), `reviewer` (review queue for assigned tenants), `admin` (everything in `/api/ops`). Staff have no access to `/api/app/*` data of a workspace they are not a member of, except through impersonation.
- **Impersonation.** While `sessions.impersonated_by` is set, every write is tagged `impersonated_by` in `audit_log`, the web app shows a banner from `GET /me`, and external actions (sending email or SMS, deciding external approvals, submitting) return `impersonation_blocked`.

### 2.11 Schemas, validation and OpenAPI

- Routes are defined with `@hono/zod-openapi` (`createRoute`) so validation and the OpenAPI document come from the same zod schemas.
- Schemas live in `packages/shared/src/schemas/<module>.ts` with named exports only: `export const DealSchema = z.object(...)` and `export type Deal = z.infer<typeof DealSchema>`. §5 tables name schemas without the `Schema` suffix.
- Naming: `<Resource>` (read model), `<Resource>Create`, `<Resource>Update`, `<Resource>ListQuery`, `<Action>Request`, `<Action>Response`. Lists respond with `Page<Resource>`.
- Problem codes are a zod enum in `packages/shared/src/problems.ts`. Domain event types are a zod enum in `packages/shared/src/events.ts` (§9).
- OpenAPI 3.1 documents: `GET /api/v1/openapi.json` (public, v1), `GET /api/app/openapi.json` (internal; served only outside production or to staff). The public docs page renders `/api/v1/openapi.json` at `<APP_URL>/docs/api`.
- The web app's API client is generated from `/api/app/openapi.json` in CI so the front end and the api cannot drift.

### 2.12 Other headers and limits

| Concern | Rule |
|---|---|
| Request id | The api accepts `X-Request-Id` (1 to 64 `[A-Za-z0-9-]`) or generates a UUIDv7, echoes it in `X-Request-Id`, and logs it. |
| Body size | 1 MB default; 256 KB for `/api/app/threads/:id/chat`; 5 MB for draft content PATCH; webhook limits in §11. Files never pass through the api (presigned upload, §5.17), except the market document proxy. |
| Compression | gzip or brotli for JSON over 1 KB. Not for SSE. |
| CORS | `/api/app` and `/api/ops`: none (same origin). `/api/v1` and `/mcp`: `Access-Control-Allow-Origin: *` without credentials, since they use bearer tokens. |
| Caching | `Cache-Control: no-store` on every authenticated response. |
| Time limits | 30 seconds per request, except SSE and chat streams. |

### 2.13 Asynchronous work (`Job`)

Work that takes longer than a request (imports, exports, bid packages, draft exports, scans) returns `202 Accepted` with a `Job` and `Location: /api/app/jobs/<id>`. A job is a DBOS workflow started by the api; its id is the workflow id, which always starts with `<kind>:<tenant_id>:`, so the api can check the tenant before reading DBOS status. No extra table.

```json
{ "id": "export:0193...:0193...", "kind": "export", "status": "running", "progress": { "done": 1200, "total": 10000 }, "result": null, "error": null, "createdAt": "...", "finishedAt": null }
```

`status` is `queued`, `running`, `succeeded` or `failed`. `result` is kind-specific (for example `{ fileId, rowCount, errorFileId }`). `error` is a problem object. Completion also emits `job.updated` over SSE.

## 3. Shared schemas

| Schema | Shape |
|---|---|
| `Page<T>` | `{ data: T[], nextCursor: string \| null, total: number \| null }` |
| `Problem` | §2.9 |
| `Citation` | `{ documentId: uuid, page: number \| null, quote: string }`. `documentId` is a `bid_documents.id`. `quote` is at most 300 characters. Same shape as `bid_requirements.citation`. |
| `SourceCitation` | `{ kind: 'bid_document' \| 'market_text' \| 'website' \| 'sam' \| 'usaspending' \| 'kontract' \| 'wage_determination' \| 'profile' \| 'library' \| 'past_performance', ref: string, page: number \| null, quote: string \| null, url: string \| null }`. Used in `field_suggestions.citations`, approval sources and brief facts. |
| `Actor` | `{ type: 'user' \| 'bot' \| 'system' \| 'staff' \| 'api_key' \| 'automation' \| 'contact', id: uuid \| null, name: string }` |
| `RecordRef` | `{ recordType: 'company' \| 'contact' \| 'deal' \| 'task' \| 'quote_request' \| 'draft' \| 'opportunity_match', recordId: uuid }` |
| `Job` | §2.13 |
| `Warning` | `{ code: string, message: string, data: object }`. Non-blocking notices returned next to a resource (price outside range, page limit exceeded). |
| `BulkResult` | `{ succeeded: uuid[], failed: { id: uuid, code: string, message: string }[] }` |
| `UserSummary` | `{ id, name, image }` |
| `BotSummary` | `{ id, key, name }` |

## 4. Authentication routes (`/api/auth/*`)

Better Auth owns these. Configure it with the email and password, magic link, Google and Microsoft social providers, `organization`, `admin` and (v1) `mcp` plus `cimd` plugins, with `basePath: "/api/auth"` and the model mappings in DATA_MODEL §3. Do not wrap or re-document Better Auth's request bodies; pin the version and read its docs. Paths below are Better Auth 1.7 defaults: verify each against the pinned version before the web app calls it.

| Purpose | Better Auth path | Notes |
|---|---|---|
| Sign up with email and password | `POST /api/auth/sign-up/email` | An `after` hook calls `tenants.createTenant()` (DATA_MODEL §17) in the same request, then sets the active organization. FR-ACC-1. |
| Sign in with email and password | `POST /api/auth/sign-in/email` | |
| Magic link | `POST /api/auth/sign-in/magic-link`, then `GET /api/auth/magic-link/verify` | Link email sent through Postmark (INTEGRATIONS §9). |
| Google or Microsoft sign-in | `POST /api/auth/sign-in/social` with `provider: "google" \| "microsoft"`; callback `GET /api/auth/callback/:provider` | Login scopes only (`openid email profile`). Sending scopes are separate (§5.22). |
| Verify email, reset password | `POST /api/auth/send-verification-email`, `GET /api/auth/verify-email`, `POST /api/auth/request-password-reset`, `POST /api/auth/reset-password` | |
| Current session | `GET /api/auth/get-session` | The web app prefers `GET /api/app/me`. |
| Sign out, sign out everywhere | `POST /api/auth/sign-out`, `POST /api/auth/revoke-sessions` | FR-ACC-6. |
| Impersonation | `POST /api/auth/admin/impersonate-user`, `POST /api/auth/admin/stop-impersonating` | Never called by the web app directly. `/api/ops` wraps them (§6) to add the reason, the 60-minute limit and the audit row. |
| MCP OAuth (v1) | `GET /api/auth/oauth2/authorize`, `POST /api/auth/oauth2/token`, `GET /api/auth/oauth2/userinfo`, `POST /api/auth/oauth2/register` (only when dynamic client registration is on) | §13. |

Organization plugin endpoints (`/api/auth/organization/*`) exist but the web app does not call them: membership changes go through `/api/app` (§5.1) so role rules, seat limits, audit and emails stay in `packages/core/tenants`.

## 5. Endpoint catalog (`/api/app`)

Paths are relative to `/api/app`. Columns: method, path, purpose, minimum role, request schema, response schema, requirement ids, notable errors. Every route can also return `unauthorized`, `forbidden`, `validation_failed`, `rate_limited`, `internal_error` and `workspace_switched`; routes with a path id can return `not_found`; writes can return `payment_required`, `workspace_suspended` and `workspace_read_only`. Those are not repeated per row. "Job" means `202` with a `Job` (§2.13). Writes that change records write `record_history`, `activities`, `audit_log` and `domain_events` rows in the same transaction, as ARCHITECTURE §5.4 and DATA_MODEL describe; rows below mention only extra effects.

### 5.1 Me, workspaces, members and invitations (`tenants`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/me` | Current user, memberships, active workspace, role, permissions, plan and billing state banner, feature flags, impersonation banner. No workspace. | signed in | | `Me` | ACC-3, BIL-6, OPS-2 | |
| PATCH | `/me` | Name, image file, timezone. No workspace. | signed in | `MeUpdate` | `Me` | | |
| GET | `/me/preferences` | My notification choices in this workspace: whether I get the digest, by email too, and my preferred phone channel (`memberships.notification_prefs`, AGENT_RUNTIME §15 item 5) | viewer | | `MemberPreferences` `{ digest: boolean, emailDigest: boolean, phoneChannel: 'telegram' \| 'sms' \| null }` | CH-3 | |
| PATCH | `/me/preferences` | Change them; `phoneChannel` must name a verified binding | viewer | `MemberPreferencesUpdate` | `MemberPreferences` | CH-3 | `validation_failed` (channel not connected) |
| GET | `/workspaces` | My memberships (not paged, max 50). No workspace. | signed in | | `{ data: WorkspaceSummary[] }` | ACC-3 | |
| POST | `/workspaces` | Create another workspace with me as owner; runs the DATA_MODEL §17 seed | signed in | `WorkspaceCreate` | `Workspace` (201) | ACC-1 | `conflict` (`duplicate` slug) |
| POST | `/workspaces/:tenantId/activate` | Switch the session's active workspace. No workspace. | member of it | | `Me` | ACC-3 | `not_found` if not a member |
| GET | `/workspace` | The active workspace | viewer | | `Workspace` | | |
| PATCH | `/workspace` | Name, logo (`logoFileId`), timezone | admin | `WorkspaceUpdate` | `Workspace` | SET-1 | |
| POST | `/workspace/ownership-transfer` | Make another member the owner; the old owner becomes admin | owner | `OwnershipTransferRequest` `{ userId }` | `Workspace` | ACC-5 | `conflict` (`state`: not a member) |
| POST | `/workspace/exports` | Export all data: ZIP of CSV and JSON per table plus files (`data_exports`, queue `sync`) | owner | | `DataExport` (202) | ACC-5 | `rate_limited` (one running) |
| GET | `/workspace/exports` | Past exports | owner | | `Page<DataExport>` | ACC-5 | |
| GET | `/workspace/exports/:id` | One export; `fileId` when `ready` (download through §5.17) | owner | | `DataExport` | ACC-5 | |
| GET | `/workspace/deletion` | Scheduled deletion, if any | owner | | `TenantDeletion` | ACC-5 | `not_found` when none |
| POST | `/workspace/deletion` | Schedule deletion 30 days out; sets `tenants.status = 'deleting'`, cancels the Stripe subscription at period end | owner | `DeletionRequest` `{ confirmName, reason? }` | `TenantDeletion` (202) | ACC-5 | `validation_failed` (name mismatch) |
| DELETE | `/workspace/deletion` | Cancel a scheduled deletion | owner | | 204 | ACC-5 | `conflict` (`state`: already completed) |
| GET | `/members` | People in the workspace with role, title and connected channels | viewer | `MemberListQuery` | `Page<Member>` | ACC-4, SET-3 | |
| PATCH | `/members/:userId` | Change role or title. Only the owner grants or removes `admin`. The owner role moves only by transfer. | admin | `MemberUpdate` | `Member` | ACC-4 | `forbidden`, `conflict` (`state`: owner) |
| DELETE | `/members/:userId` | Remove a member, or leave (own id). Their sessions for this workspace end; their API keys are revoked. | admin, or self | | 204 | ACC-4 | `conflict` (`state`: the owner cannot leave) |
| GET | `/invitations` | Pending and recent invitations | admin | | `Page<Invitation>` | ACC-2 | |
| POST | `/invitations` | Invite by email with role `admin`, `member` or `viewer`; expires in 7 days; email through Postmark | admin | `InvitationCreate` | `Invitation` (201) | ACC-2 | `conflict` (`duplicate`: member or pending), `limit_reached` (plan users) |
| POST | `/invitations/:id/resend` | New email, expiry reset to 7 days | admin | | `Invitation` | ACC-2 | `conflict` (`state`) |
| DELETE | `/invitations/:id` | Cancel (`status = 'canceled'`) | admin | | 204 | ACC-2 | |
| GET | `/invitations/:id/preview` | Workspace name, inviter, role, for the accept page. No workspace. | signed in, email matches | | `InvitationPreview` | ACC-2 | `forbidden` (other email) |
| POST | `/invitations/:id/accept` | Join with the invited role; sets the active workspace. No workspace. | signed in, email matches | | `Me` | ACC-2 | `conflict` (`state`: expired, canceled, accepted) |
| POST | `/invitations/:id/decline` | No workspace. | signed in, email matches | | 204 | ACC-2 | |

`Me` is `{ user, memberships: WorkspaceSummary[], activeWorkspace: Workspace | null, role, permissions: string[], billing: { planKey, status, trialEndsAt, banner: 'trial_ending' | 'past_due' | 'read_only' | 'jobs_paused' | null }, flags: Record<string, boolean | object>, impersonation: { staffName, reason, endsAt } | null }`. `permissions` are strings such as `billing.manage`, `bots.configure`, `members.manage`, derived from the role so the web app can hide controls.

### 5.2 Settings (`tenants`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/settings` | Workspace settings | viewer | | `WorkspaceSettings` | SET-1 | |
| PATCH | `/settings` | Change settings; each change audited with old and new values | admin | `WorkspaceSettingsUpdate` | `WorkspaceSettings` | SET-1, CH-5, BID-6, PRC-4 | |

`WorkspaceSettings` maps `tenant_settings` columns plus keys of `tenant_settings.settings`:

| Property | Source | Rule |
|---|---|---|
| `digestHour` | `digest_hour` | 0 to 23; each recipient gets the digest at this hour in their own timezone (`users.timezone`) |
| `quietHours` | `quiet_hours` | `{ start: "HH:MM", end: "HH:MM" }`, default 21:00 to 07:00 |
| `modelPolicy` | `model_policy` | `{ excludedProviders: ('anthropic' \| 'openai' \| 'google')[] }`; excluding every provider of a tier is refused with `validation_failed` naming the tier |
| `outreachFooter` | `outreach_footer` | text appended to outreach email, 1 to 1,000 characters |
| `postalAddress` | `settings.postalAddress` | `{ line1, line2, city, state, zip }`; required before any outreach email can send (CAN-SPAM, FR-SUB-6) |
| `approvalExpiryHours` | `approval_expiry_hours` | 1 to 720 |
| `aiDraftingAllowed` | `ai_drafting_allowed` | tenant-wide switch; per bid in §5.9 |
| `defaultPipelineId` | `default_pipeline_id` | a pipeline of this workspace |
| `marginFloorBps` | `settings.marginFloorBps` | 0 to 10,000, default 800 (FR-PRC-4) |
| `pricingDefaults` | `settings.pricingDefaults` | `{ overheadBps: 0..5000 (default 1000), profitBps: 0..5000 (default 1000) }`, used by the Estimator and new price sheets (§5.10) |
| `quoteFollowups` | `settings.quoteFollowups` | `{ count: 0..3 (default 2), minHoursBetween: 24..168 (default 48) }` (FR-SUB-4) |

### 5.3 Company profile, past performance, library (`profile`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/profile` | The company profile with `fieldProvenance` per field | viewer | | `CompanyProfile` | PRO-3 | |
| PATCH | `/profile` | Edit the profile. NAICS codes validated against the NAICS list (INTEGRATIONS §8), PSC codes against `^[A-Z0-9]{4}$`, certifications against DATA_MODEL's list. Edited fields get provenance `user`. | member | `CompanyProfileUpdate` | `CompanyProfile` | PRO-3 | `validation_failed` (`unknown_naics`) |
| POST | `/profile/lookup` | Find the business by UEI or name in SAM.gov entity data | member | `ProfileLookupRequest` `{ uei? , name?, state? }` (one of `uei`, `name`) | `ProfileLookupResponse` `{ candidates: EntityCandidate[] }` (max 10) | PRO-2 | `external_unavailable` |
| POST | `/profile/apply-lookup` | Prefill chosen fields from one candidate; writes `field_provenance` source `sam` with the UEI as `source_ref` | member | `ApplyLookupRequest` `{ uei, fields: ('legalName' \| 'dba' \| 'cage' \| 'samStatus' \| 'samExpiresOn' \| 'baseAddress' \| 'naicsCodes' \| 'pscCodes' \| 'certifications')[] }` | `CompanyProfile` | PRO-2 | `external_unavailable` |
| GET | `/profile/onboarding` | Setup progress (stored in `tenant_settings.settings.onboarding`) | viewer | | `OnboardingState` | PRO-1 | |
| PATCH | `/profile/onboarding` | Mark a step done or skipped | member | `OnboardingStepUpdate` `{ step: 'business_lookup' \| 'what_you_do' \| 'where_you_work' \| 'certifications_limits' \| 'phone', status: 'done' \| 'skipped' }` | `OnboardingState` | PRO-1 | |
| GET | `/profile/sam-status` | Registration status and warning (`expiring` within 60 days, `lapsed`) | viewer | | `SamStatus` | PRO-6 | |
| POST | `/profile/suggested-searches` | 2 or 3 saved-search drafts built from the profile (not saved) | member | | `{ data: SavedSearchDraft[] }` | PRO-5 | |
| GET | `/reference/naics` | Search the NAICS list by code prefix or words | viewer | `?q=&limit=` (limit 1 to 50) | `{ data: NaicsCode[] }` | PRO-3 | |
| GET | `/past-performance` | List | viewer | `PastPerformanceListQuery` | `Page<PastPerformance>` | PRO-4 | |
| POST | `/past-performance` | Add an entry | member | `PastPerformanceCreate` | `PastPerformance` (201) | PRO-4 | |
| GET, PATCH, DELETE | `/past-performance/:id` | Read, edit, delete | viewer, member, member | `PastPerformanceUpdate` | `PastPerformance`, 204 | PRO-4 | |
| GET | `/library-items` | List; filter by `kind`, `expiresOn` | viewer | `LibraryItemListQuery` | `Page<LibraryItem>` | PRO-4 | |
| POST | `/library-items` | Add boilerplate or a file (`fileId` from §5.17, linked with purpose `library`) | member | `LibraryItemCreate` | `LibraryItem` (201) | PRO-4 | `file_not_ready` |
| GET, PATCH, DELETE | `/library-items/:id` | Read, edit, delete | viewer, member, member | `LibraryItemUpdate` | `LibraryItem`, 204 | PRO-4 | |

`CompanyProfile` adds `fieldProvenance: Record<field, { source, sourceRef, capturedAt }>` read from `field_provenance` rows with `record_type` `company_profile`. That `record_type` value is not in DATA_MODEL's polymorphic list; see §15.

### 5.4 Today

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/today` | Top 5 new matches, deadlines in the next 7 days, approvals waiting for me, quotes received in the last 7 days, library items expiring within 30 days, SAM warning, usage alerts, one-line Bot news | viewer | | `TodaySummary` | PRO-4, PRO-6, BID-4, APR-3, BIL-4 | |

### 5.5 Market data (`market`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| POST | `/market/search` | Search federal and state and local notices through the `OpportunitySource` port, scored against the profile. A read; POST because the filter is large. p95 under 3 s. | viewer | `MarketSearchRequest` | `MarketSearchResponse` | DIS-1, DIS-3 | `external_unavailable` (both adapters failed) |
| GET | `/market/sources` | Source health for the Bids screen: Kontract health, `samAsOf`, fallback in use, state coverage. Global data, so no SSE event: the web app refetches it every 5 minutes. | viewer | | `MarketSourceHealth` | DIS-1 | |
| GET | `/market/notices/:source/:sourceId` | A notice by source id, live from the source, whether or not cached (`source` is `sam` or `sled`) | viewer | | `OpportunityDetail` | DIS-4 | `external_unavailable` |
| GET | `/market/opportunities/:opportunityId` | A cached notice (`market_opportunities`), refreshed from the source when older than 6 hours | viewer | | `OpportunityDetail` | DIS-4 | |
| GET | `/market/opportunities/:opportunityId/documents` | The notice's documents with read status | viewer | | `{ data: MarketDocument[] }` | DIS-4 | `external_unavailable` |
| GET | `/market/opportunities/:opportunityId/documents/:documentRef/content` | Stream the original file from the source through the api (max 100 MB, `Content-Disposition: inline`) so the viewer can render it | viewer | | file bytes | DIS-4, BID-2 | `external_unavailable`, `payload_too_large` |
| GET | `/market/opportunities/:opportunityId/text` | Shared text of one document page from `market_opportunity_texts` | viewer | `?documentRef=&page=` | `MarketTextPage` | DIS-4, BID-2 | |

`MarketSearchRequest`: `{ keywords: string[], excludeKeywords: string[], naics: string[], psc: string[], setAsides: string[], states: string[], agencies: string[], valueMinCents?, valueMaxCents?, dueWithinDays?, noticeTypes: string[], sources: ('sam' | 'sled')[], sort: 'fit' | 'due' | 'posted', limit, cursor }`; the same keys as `opportunity_searches.filters`. `MarketSearchResponse`: `Page<OpportunitySummary> & { dataAsOf, fallbackInUse: boolean, notices: string[] }`. `OpportunitySummary`: `{ opportunityId: uuid | null, source, sourceId, title, agency, office, placeOfPerformance, setAside, noticeType, postedAt, responseDueAt, estimatedValueLowCents, estimatedValueHighCents, url, score, reasons, matchId: uuid | null, dealId: uuid | null }`. `opportunityId` is null when the notice is not cached yet; act on it through `POST /matches` (§5.7). This web search does not write `market_opportunities` (the api has no write access to global tables); scans and Bot searches, which run in `worker`, do (AGENT_RUNTIME `market.search_opportunities`).

### 5.6 Saved searches (`matching`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/saved-searches` | List | viewer | | `Page<SavedSearch>` | DIS-2 | |
| POST | `/saved-searches` | Create; `runFirstScan: true` starts a scan now (FR-PRO-5: within 2 minutes) | member | `SavedSearchCreate` | `SavedSearch` (201) | DIS-2, PRO-5 | `limit_reached` (`saved_searches`) |
| POST | `/saved-searches/preview` | Score the current notices for a filter without saving (sample matches during onboarding) | member | `SavedSearchPreviewRequest` `{ filters }` | `{ data: OpportunitySummary[] }` (top 10) | PRO-5, DIS-3 | `external_unavailable` |
| GET, PATCH, DELETE | `/saved-searches/:id` | Read, edit (`name`, `filters`, `isActive`), delete | viewer, member, member | `SavedSearchUpdate` | `SavedSearch`, 204 | DIS-2 | |
| POST | `/saved-searches/:id/scan` | Scan now (workflow id `scan:<tenant>:<search>:<yyyy-mm-ddThh>` on queue `sync`; one per search per 10 minutes) | member | | Job | DIS-2 | `rate_limited` |

`SavedSearch` is `opportunity_searches` plus `{ newMatchCount, lastScannedAt, nextScanAt }`.

### 5.7 Matches (`matching`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/matches` | List. Default: status `new`, `shown`, `saved`, score above 0, sorted `-score`. `includeIneligible=true` adds score-0 matches (FR-DIS-3). | viewer | `MatchListQuery` | `Page<Match>` | DIS-2, DIS-3 | |
| GET | `/matches/:id` | One match with its notice | viewer | | `MatchDetail` | DIS-3, DIS-4 | |
| POST | `/matches` | Act on a search result that has no match yet: caches the notice (workflow `ensureOpportunity` on queue `docs`, id `opp:<source>:<sourceId>`, writes through the `magpie_ops` pool in `worker`), creates the match, then saves or pursues it. Returns the existing match if one exists. The api waits up to 5 s; if caching takes longer it answers `202` with `{ match: null, deal: null, jobId }` and `match.created` follows over SSE. | member | `MatchCreate` `{ source, sourceId, action: 'save' \| 'pursue' }` | `MatchActionResult` (201 or 200) | DIS-5 | `external_unavailable` |
| POST | `/matches/:id/pursue` | Create the bid: a `kind='bid'` deal in the default bid pipeline at its first `open` stage, linked to the notice; status `pursuing`; starts the document fetch and Bid Reader. Exactly one deal per notice per workspace. | member | | `MatchActionResult` | DIS-5 | |
| POST | `/matches/:id/save` | Status `saved` | member | | `Match` | DIS-5 | |
| POST | `/matches/:id/dismiss` | Status `dismissed` with a reason code in `dismiss_reason`; an optional note is stored as a `notes` row on the match. Feeds the 90-day scorer penalty. | member | `MatchDismissRequest` `{ reason: 'not_our_work' \| 'too_far' \| 'too_small' \| 'too_big' \| 'not_eligible' \| 'bad_timing' \| 'other', note? }` | `Match` | DIS-5 | |
| POST | `/matches/:id/restore` | Undo a dismissal (status `shown`) | member | | `Match` | DIS-5 | `conflict` (`state`) |
| POST | `/matches/mark-shown` | Mark `new` matches as `shown` | member | `{ ids: uuid[] }` (max 100) | 204 | DIS-2 | |
| POST | `/matches/bulk` | Save or dismiss up to 100 | member | `MatchBulkRequest` `{ ids, action: 'save' \| 'dismiss', reason? }` | `BulkResult` | DIS-5 | |

`Match` is `opportunity_matches` plus `opportunity: OpportunitySummary`. `MatchActionResult`: `{ match: Match, deal: Deal | null }`.

### 5.8 Pipelines and deals (`crm`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/pipelines` | Pipelines with their stages (not paged) | viewer | | `{ data: Pipeline[] }` | CRM-2 | |
| POST | `/pipelines` | Create a pipeline (`kind` `bid` or `sale`) with stages | admin | `PipelineCreate` | `Pipeline` (201) | CRM-2 | |
| PATCH | `/pipelines/:id` | Rename, set default, reorder | admin | `PipelineUpdate` | `Pipeline` | CRM-2 | |
| DELETE | `/pipelines/:id` | Delete an empty pipeline | admin | | 204 | CRM-2 | `conflict` (`in_use`) |
| POST | `/pipelines/:id/stages` | Add a stage | admin | `StageCreate` | `PipelineStage` (201) | CRM-2 | |
| PATCH | `/pipeline-stages/:id` | Rename, category, probability | admin | `StageUpdate` | `PipelineStage` | CRM-2 | `conflict` (`state`: last stage of a required category in a bid pipeline) |
| DELETE | `/pipeline-stages/:id` | Delete; moves its deals to `moveDealsToStageId` | admin | `?moveDealsToStageId=` | 204 | CRM-2 | `conflict` (`in_use` without a target) |
| PUT | `/pipelines/:id/stage-order` | Reorder stages | admin | `{ stageIds: uuid[] }` | `Pipeline` | CRM-2 | |
| GET | `/deals` | List; filters include `pipelineId`, `stageId`, `kind`, `ownerUserId`, `companyId`, `dueAt`, `amountCents`, `tagIds`, `custom.*` | viewer | `DealListQuery` | `Page<Deal>` | CRM-1, CRM-5 | |
| POST | `/deals/query` | Same with a JSON filter body (§2.5) | viewer | `RecordQuery` | `Page<Deal>` | CRM-5 | |
| GET | `/deals/board` | Kanban: per stage, count, sum of `amountCents`, first 50 deals and a cursor | viewer | `?pipelineId=` plus filters | `DealBoard` | CRM-2 | |
| POST | `/deals` | Create a deal (`source: 'manual'`) | member | `DealCreate` | `Deal` (201) | CRM-1 | |
| GET | `/deals/:id` | Deal with stage, company, primary contact, owner, tags, and for bids a `bid` summary | viewer | | `DealDetail` | CRM-1, BID-8 | |
| PATCH | `/deals/:id` | Edit fields (not stage) | member | `DealUpdate` | `Deal` | CRM-1, CRM-10 | `conflict` (`stale`) |
| POST | `/deals/:id/move` | Change stage (drag on the board). Moving to a `no_bid` stage requires `noBidReason`; to a `submitted` stage requires an existing `submissions` row; to `lost` accepts `lostReason`. Sets `submitted_at`, `won_at`, `lost_at`. | member | `DealMoveRequest` `{ stageId, position?, noBidReason?, lostReason? }` | `Deal` | CRM-2, BID-5, BID-7 | `conflict` (`state`) |
| POST | `/deals/:id/archive`, `/deals/:id/unarchive` | Archive or restore | member | | `Deal` | CRM-1 | |
| GET | `/deals/:id/contacts` | People on the deal with role | viewer | | `{ data: DealContact[] }` | CRM-1 | |
| PUT | `/deals/:id/contacts/:contactId` | Add or change role | member | `{ role }` | `DealContact` | CRM-1 | |
| DELETE | `/deals/:id/contacts/:contactId` | Remove | member | | 204 | CRM-1 | |

`Deal` adds `{ stage: PipelineStage, company: { id, name } | null, owner: UserSummary | null, tagIds: uuid[] }`. `DealDetail` adds `{ primaryContact, bid: BidSummary | null }`.

### 5.9 Bid workspace (`bids`)

All paths need a deal with `kind = 'bid'`; other deals return `404 not_found`.

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/deals/:id/bid` | Bid summary: brief status, decision, AI-use status and banner text, counts of requirements by status, next deadline, document read status, price sheet and quote counts | viewer | | `BidSummary` | BID-2, BID-6 | |
| GET | `/deals/:id/brief` | The current bid brief (`bid_briefs` row with `status = 'current'`, AGENT_RUNTIME §15 item 1): plain-language scope and cited facts | viewer | | `BidBrief` | BID-2 | `not_found` before the first read |
| GET | `/deals/:id/brief/versions` | Earlier versions (after amendments) | viewer | | `{ data: BidBrief[] }` | BID-2, DIS-7 | |
| POST | `/deals/:id/brief/refresh` | Run Bid Reader again (agent run, trigger `api`) | member | | `AgentRun` (202) | BID-2, DIS-7 | `limit_reached`, `model_unavailable` |
| GET | `/deals/:id/documents` | Bid documents with `textStatus`, `pageCount`, scan status | viewer | | `{ data: BidDocument[] }` | BID-1 | |
| POST | `/deals/:id/documents` | Attach an uploaded file (PDF, DOCX, XLSX, PNG, JPEG, TIFF) as `our_upload` or another kind; it is scanned, then read | member | `BidDocumentCreate` `{ fileId, kind, title }` | `BidDocument` (201) | BID-1 | `unsupported_media_type` |
| PATCH | `/deals/:id/documents/:documentId` | Change `kind` or `title` | member | `BidDocumentUpdate` | `BidDocument` | BID-1 | |
| DELETE | `/deals/:id/documents/:documentId` | Remove an upload (`our_upload` only) | member | | 204 | BID-1 | `conflict` (`state`: public document) |
| POST | `/deals/:id/documents/sync` | Re-check the notice for amendments and new attachments now | member | | Job | BID-1, DIS-7 | `external_unavailable` |
| GET | `/deals/:id/documents/:documentId/pages/:page` | Text of one page, with an optional highlight range for a quote | viewer | `?highlight=<quote>` | `DocumentPage` `{ page, text, highlights: [{ start, end }] }` | BID-2, BID-3 | `file_not_ready` |
| GET | `/deals/:id/documents/:documentId/file` | Presigned download of the stored copy (§5.17) | viewer | | `FileDownload` | BID-2 | `file_not_ready` |
| GET | `/deals/:id/requirements` | Compliance matrix rows, ordered by `position` | viewer | `?filter[status]&filter[category]&filter[isMandatory]` | `{ data: BidRequirement[] }` | BID-3 | |
| POST | `/deals/:id/requirements` | Add a row. `citation` is required (DATA_MODEL: no citation, no row); the web app fills it from a text selection in the viewer. | member | `BidRequirementCreate` | `BidRequirement` (201) | BID-3 | `validation_failed` (citation not found in document) |
| PATCH | `/deals/:id/requirements/:requirementId` | Edit, assign (`ownerUserId`), mark `met`, `not_met`, `not_applicable` | member | `BidRequirementUpdate` | `BidRequirement` | BID-3 | |
| DELETE | `/deals/:id/requirements/:requirementId` | Delete | member | | 204 | BID-3 | |
| PUT | `/deals/:id/requirements/order` | Reorder | member | `{ requirementIds: uuid[] }` | 204 | BID-3 | |
| GET | `/deals/:id/requirements/export` | Compliance matrix as CSV or XLSX | viewer | `?format=csv\|xlsx` | file | BID-3 | |
| GET | `/deals/:id/deadlines` | Deadlines with citation, local label and reminders sent | viewer | | `{ data: BidDeadline[] }` | BID-4 | |
| POST | `/deals/:id/deadlines` | Add a deadline (`at` with offset; shown in the solicitation's timezone) | member | `BidDeadlineCreate` | `BidDeadline` (201) | BID-4 | |
| PATCH, DELETE | `/deals/:id/deadlines/:deadlineId` | Edit or delete; editing `at` clears `reminders_sent` entries that are now in the future | member | `BidDeadlineUpdate` | `BidDeadline`, 204 | BID-4 | |
| GET | `/deadlines` | Deadlines across bids for Today and the calendar view | viewer | `?from=&to=&filter[kind]` (range max 92 days) | `{ data: BidDeadlineWithDeal[] }` | BID-4 | |
| GET | `/deals/:id/decision` | Bid or no-bid recommendation (score, reasons) and the recorded decision (`deals.bid_decision`) | viewer | | `BidDecision` | BID-5 | |
| POST | `/deals/:id/decision/recommend` | Compute a fresh recommendation (agent run) | member | | `AgentRun` (202) | BID-5 | `limit_reached`, `model_unavailable` |
| PUT | `/deals/:id/decision` | Accept or override: `bid`, `no_bid` (moves the deal to the pipeline's `no_bid` stage with `noBidReason`) or `undecided` | member | `BidDecisionRequest` `{ decision, reasons: string[], note?, noBidReason? }` | `BidDecision` | BID-5 | `validation_failed` (`no_bid` without reason) |
| PUT | `/deals/:id/ai-drafting` | Set `deals.is_ai_drafting_allowed` (`null` follows the workspace). Setting `true` on a bid where a ban clause was detected requires `reason` and is audited. | admin | `AiDraftingRequest` `{ allowed: boolean \| null, reason? }` | `BidSummary` | BID-6 | |
| GET | `/deals/:id/ai-disclosure` | What AI produced on this bid: models, run ids, sections (merged from `drafts.ai_disclosure`) | viewer | | `AiDisclosure` | BID-6 | |
| POST | `/deals/:id/ai-disclosure/statement` | Create a disclosure statement draft (`drafts.kind = 'other'`, written from the disclosure data by a template, no model call) | member | | `Draft` (201) | BID-6 | |
| GET | `/deals/:id/submissions` | Submission records | viewer | | `{ data: Submission[] }` | BID-7 | |
| POST | `/deals/:id/submissions` | Record a submission (method, time, confirmation, `fileIds` linked with purpose `submission`); moves the deal to the `submitted` stage and enables the award watch | member | `SubmissionCreate` | `Submission` (201) | BID-7 | `impersonation_blocked` |
| POST | `/deals/:id/package` | Build the bid package: approved draft versions as DOCX and PDF, the approved price sheet, the compliance checklist, attachments, and a ZIP of everything | member | `PackageRequest` `{ draftIds?, priceSheetId?, include: { checklist, compliance, attachments }, formats: ('docx' \| 'pdf' \| 'zip')[] }` | Job (`result: { fileIds, warnings: Warning[] }`) | BID-9, DRF-3, PRC-3 | `conflict` (`state`: no approved price sheet or draft) |
| GET | `/deals/:id/packages` | Past package exports (files linked with purpose `export`, §15) | viewer | | `{ data: PackageExport[] }` | BID-9 | |

`BidBrief` (zod schema `BidBriefSchema` in `packages/shared/src/schemas/bids.ts`):

```ts
{
  id: uuid,
  dealId: uuid,
  version: number,
  status: 'current' | 'superseded',
  summary: string,
  facts: Array<{
    key: 'scope_summary' | 'place_of_performance' | 'period_of_performance' | 'contract_type'
       | 'evaluation_method' | 'set_aside' | 'bonding' | 'insurance' | 'wage_determination'
       | 'site_visit' | 'questions_due' | 'proposal_due' | 'submission_method'
       | 'page_and_format_limits' | 'ai_use',
    label: string,
    value: string | null,
    status: 'found' | 'not_found',
    citations: Citation[]
  }>,
  redFlags: Array<{ text: string, citations: Citation[] }>,
  runId: uuid | null,
  createdAt: string
}
```

The fact keys are the fixed list of AGENT_RUNTIME's `bids.build_brief`; if that list changes there, this schema follows. A fact's `citations` is empty only when its `status` is `not_found`.

### 5.10 Pricing (`pricing`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/deals/:id/price-sheets` | Versions, newest first | viewer | | `{ data: PriceSheetSummary[] }` | PRC-3 | |
| POST | `/deals/:id/price-sheets` | New draft version, empty or copied from `fromPriceSheetId` | member | `PriceSheetCreate` | `PriceSheet` (201) | PRC-3 | |
| POST | `/deals/:id/price-sheets/draft` | Ask the Estimator to draft a new version (agent run) | member | `{ instructions? }` | `AgentRun` (202) | PRC-1, PRC-3 | `limit_reached`, `model_unavailable` |
| GET | `/price-sheets/:id` | Sheet with lines, computed totals and `warnings` | viewer | | `PriceSheet` | PRC-3, PRC-4, PRC-5 | |
| PATCH | `/price-sheets/:id` | Edit `assumptions` (draft only) | member | `PriceSheetUpdate` | `PriceSheet` | PRC-3 | `conflict` (`state`: not draft) |
| POST | `/price-sheets/:id/lines` | Add a line | member | `PriceLineCreate` | `PriceSheet` | PRC-3 | `conflict` (`state`) |
| PATCH, DELETE | `/price-sheets/:id/lines/:lineId` | Edit or delete a line | member | `PriceLineUpdate` | `PriceSheet` | PRC-3 | `conflict` (`state`) |
| PUT | `/price-sheets/:id/lines/order` | Reorder | member | `{ lineIds }` | `PriceSheet` | PRC-3 | |
| POST | `/price-sheets/:id/approve` | Approve this version (`status = 'approved'`, earlier approved version becomes `superseded`) | member | | `PriceSheet` | PRC-3 | `conflict` (`state`) |
| GET | `/price-sheets/:id/export` | CSV or XLSX | viewer | `?format=csv\|xlsx` | file | PRC-3 | |
| GET | `/deals/:id/comparables` | Past awards for this bid with range stats `{ count, lowCents, medianCents, highCents, annual: {...} }` | viewer | | `ComparablesResponse` | PRC-2 | |
| POST | `/deals/:id/comparables/refresh` | Fetch comparables now (Kontract `/pricing`, USAspending fallback) and replace rows not pinned by a person | member | `ComparablesQuery` `{ keywords?, naics?, state?, agency?, yearsBack? }` | `ComparablesResponse` | PRC-2 | `external_unavailable` |
| DELETE | `/deals/:id/comparables/:comparableId` | Drop a comparable | member | | 204 | PRC-2 | |
| GET | `/wage-determinations/search` | Search SCA or Davis-Bacon wage determinations on SAM.gov | viewer | `?type=sca\|dbra&state=&county=&q=` | `{ data: WageDeterminationSummary[] }` | PRC-1 | `external_unavailable` |
| GET | `/wage-determinations/:wdNumber` | One wage determination, parsed rates and the source text link; latest revision unless `revision` given | viewer | `?revision=` | `WageDetermination` | PRC-1 | `external_unavailable` |
| POST | `/deals/:id/wage-determinations` | Attach a wage determination revision to the bid as a `bid_documents` row of kind `wage_determination` (text stored as a file) so rates can be cited | member | `{ wdNumber, revision }` | `BidDocument` (201) | PRC-1 | `external_unavailable` |

Price computation (in `packages/core/pricing`, never by a model):
- Lines with `unit = 'percent'` (`kind` `overhead` or `profit`) take `quantity` as the percentage. Overhead base = sum of `total_cents` of `labor`, `material`, `subcontract`, `equipment`, `travel`, `other` lines. Profit base = that sum plus overhead lines. The base is stored in `unit_cost_cents`; `total_cents = round_half_even(base * quantity / 100)`.
- Other lines: `total_cents = round_half_even(quantity * unit_cost_cents)`.
- `price_sheets.total_cents` = sum of line totals. `margin_bps` = profit lines total * 10,000 / `total_cents`.
- Labor lines store `wage_ref` `{ wdNumber, revision, occupationCode, rateCents, fringeCents }` and a `citation` when a wage determination applies; `unit_cost_cents` = the higher of the profile's hourly rate (`labor_rates`) and wage rate plus fringe, times (1 + the role's `burdenPct`), as AGENT_RUNTIME's `pricing.draft_price_sheet` computes it.
- Overhead and profit percentages default from `tenant_settings.settings.pricingDefaults` (`{ overheadBps, profitBps }`); a line stores the percentage as `quantity` = bps / 100.

`PriceSheet.warnings` codes:
- `outside_comparable_range` (`data: { totalCents, lowCents, highCents }`) when the total is below the comparables' low or above their high (FR-PRC-4).
- `margin_below_floor` (`data: { marginBps, floorBps }`) (FR-PRC-4).
- `subcontracting_cap` (`data: { sharePct, capPct, category }`) when the bid's set-aside is not `none` and subcontract total / (total minus material total) exceeds 50% (`services`), 85% (`general_construction`) or 75% (`special_trade`), by category from the notice's primary NAICS code: `236` or `237` general construction, `238` special trade, `31` to `33` and `42` supplies (cap not checked; warning `subcontracting_not_checked`), anything else services (FR-PRC-5).
- `unconfirmed_quote` when a subcontract line references a quote with `is_confirmed = false`.

### 5.11 Quotes and subcontractors (`quotes`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| POST | `/deals/:id/sub-search` | Suggest subcontractors near the place of performance: the CRM first, then Kontract's sub search and SAM entities. Not stored. | member | `SubSearchRequest` `{ trade, query?, radiusMiles? (default 50, max 200) }` | `{ data: SubSuggestion[] }` | SUB-1 | `external_unavailable` |
| POST | `/deals/:id/sub-suggestions/accept` | Turn a suggestion into a company (`kinds` includes `subcontractor`) and contact, or link the existing one; reads the business website for contact facts (provenance `website`); stores only `place_id` from Places | member | `SubSuggestionAccept` `{ suggestion: SubSuggestion }` | `{ company: Company, contact: Contact \| null }` | SUB-1 | `external_unavailable` |
| GET | `/deals/:id/quote-requests` | Quote requests on the bid | viewer | | `{ data: QuoteRequest[] }` | SUB-2 | |
| POST | `/deals/:id/quote-requests` | Draft a request: scope, due date, attachments; generates `reply_token` | member | `QuoteRequestCreate` `{ companyId, contactId?, scope, dueAt, attachmentFileIds: uuid[] }` | `QuoteRequest` (201) | SUB-2 | |
| GET | `/quote-requests/:id` | With its messages, quotes and the email preview | viewer | | `QuoteRequestDetail` | SUB-2, SUB-3 | |
| PATCH | `/quote-requests/:id` | Edit while `draft` | member | `QuoteRequestUpdate` | `QuoteRequest` | SUB-2 | `conflict` (`state`) |
| POST | `/quote-requests/:id/send` | A person sends their own request now: the click is the person's approval, recorded in `audit_log`; queued on `messaging`. Bot-drafted requests arrive as approvals instead (§5.20). | member | `{ sendVia?: 'connected_mailbox' \| 'magpie' }` | `QuoteRequest` (202) | SUB-2 | `conflict` (`suppressed_address`, `do_not_contact`, `state`), `validation_failed` (no postal address), `impersonation_blocked` |
| POST | `/quote-requests/:id/followup` | Send a follow-up now (same rules as send) | member | | `QuoteRequest` (202) | SUB-4 | same as send |
| POST | `/quote-requests/:id/cancel` | Stop follow-ups (`status = 'canceled'`) | member | | `QuoteRequest` | SUB-4 | |
| GET | `/deals/:id/quotes` | Quotes received | viewer | | `{ data: Quote[] }` | SUB-3 | |
| POST | `/deals/:id/quotes` | Enter a quote by hand (confirmed on creation) | member | `QuoteCreate` | `Quote` (201) | SUB-3 | |
| PATCH | `/quotes/:id` | Correct parsed numbers | member | `QuoteUpdate` | `Quote` | SUB-3 | |
| POST | `/quotes/:id/confirm` | A person checked the numbers (`is_confirmed = true`) | member | | `Quote` | SUB-3 | |
| GET | `/deals/:id/quotes/compare` | Side-by-side comparison by line and total | viewer | | `QuoteComparison` | SUB-5 | |
| POST | `/quotes/:id/use` | Add the quote as a `subcontract` line on a draft price sheet with its citation | member | `{ priceSheetId }` | `PriceSheet` | SUB-5 | `conflict` (`state`: not confirmed, sheet not draft) |

`SubSuggestion`: `{ source: 'crm' | 'kontract' | 'sam' | 'web', name, distanceMiles: number | null, contactPath: ('email' | 'phone' | 'website')[], companyId: uuid | null, placeId: string | null, website: string | null, uei: string | null, reasons: string[] }`. Fields that came from Google Places other than `placeId` are display-only and never persisted (INTEGRATIONS §20).

### 5.12 Drafts (`drafts`)

A draft document is a chain of `drafts` rows. The first row (version 1, `parent_draft_id` null) is the document's id. Each later version is a new row with `parent_draft_id` = that first row's id and `version` = previous plus 1 (§15 records this rule). The highest version is the current one and the only editable one; older versions are read-only.

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/drafts` | List current versions; filter by `dealId`, `kind`, `status` | viewer | `DraftListQuery` | `Page<DraftSummary>` | DRF-1 | |
| POST | `/drafts` | Create a draft by hand | member | `DraftCreate` `{ dealId?, kind, title, content? }` | `Draft` (201) | DRF-2 | |
| GET | `/drafts/:id` | Current version with content, requirements answered and gaps | viewer | | `Draft` | DRF-1, DRF-2 | |
| PATCH | `/drafts/:id` | Autosave the current version (`content` TipTap JSON, `contentText`, `title`). `If-Match` required. Autosave updates in place; it does not create a version. | member | `DraftUpdate` | `Draft` | DRF-2 | `conflict` (`stale`, `state`: approved or sent) |
| POST | `/drafts/:id/generate` | Proposal Writer drafts or redrafts sections (agent run) | member | `DraftGenerateRequest` `{ sections?: string[], instructions? }` | `AgentRun` (202) | DRF-1, DRF-4 | `ai_drafting_not_allowed`, `limit_reached`, `model_unavailable` |
| GET | `/drafts/:id/versions` | All versions (metadata) | viewer | | `{ data: DraftVersionSummary[] }` | DRF-2 | |
| POST | `/drafts/:id/versions` | Save a version: freezes the current row and creates the next one with the same content | member | `{ label? }` | `Draft` (201) | DRF-2 | |
| GET | `/drafts/:id/versions/:version` | One version's content (compare happens in the browser between two of these) | viewer | | `Draft` | DRF-2 | |
| POST | `/drafts/:id/versions/:version/restore` | New current version with that version's content | member | | `Draft` (201) | DRF-2 | |
| POST | `/drafts/:id/approve` | Approve the current version for packages (`status = 'approved'`) | member | `{ version }` | `Draft` | DRF-2, BID-9 | `conflict` (`stale` when `version` is not current) |
| POST | `/drafts/:id/exports` | DOCX or PDF of a version, with page-limit, font and file-name checks from the brief | member | `{ format: 'docx' \| 'pdf', version? }` | Job (`result: { fileId, pageCount, warnings }`) | DRF-3, BID-9 | |
| GET | `/drafts/:id/comments` | Comments: `notes` rows with `record_type = 'draft'`, `body` holding `{ doc, anchor: { from, to, version }, resolved }` | viewer | | `{ data: DraftComment[] }` | DRF-2 | |
| POST | `/drafts/:id/comments` | Add a comment | member | `DraftCommentCreate` | `DraftComment` (201) | DRF-2 | |
| PATCH, DELETE | `/drafts/:id/comments/:noteId` | Edit, resolve, delete (author or admin) | member | `DraftCommentUpdate` | `DraftComment`, 204 | DRF-2 | |

`Draft` adds `{ coverage: { answers: uuid[], gaps: uuid[], unsupportedClaims: { text, reason }[] }, aiDisclosure, versions: number }` from `drafts.coverage` (AGENT_RUNTIME §15 item 2). `gaps` are mandatory `bid_requirements` of the deal that no current draft answers (FR-DRF-1); `unsupportedClaims` come from the drafting fact check (FR-DRF-4).

### 5.13 Companies and contacts (`crm`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/companies` | List; filters include `kinds`, `ownerUserId`, `naicsCodes`, `uei`, `domain`, `tagIds`, `custom.*` | viewer | `CompanyListQuery` | `Page<Company>` | CRM-1, CRM-5 | |
| POST | `/companies/query` | JSON filter form | viewer | `RecordQuery` | `Page<Company>` | CRM-5 | |
| POST | `/companies` | Create | member | `CompanyCreate` | `Company` (201) | CRM-1 | `conflict` (`duplicate`: active company with the same UEI, `existingId` in the problem) |
| GET | `/companies/:id` | With counts of contacts, deals, open tasks | viewer | | `CompanyDetail` | CRM-1 | |
| PATCH | `/companies/:id` | Edit | member | `CompanyUpdate` | `Company` | CRM-1, CRM-10 | `conflict` (`stale`, `duplicate`) |
| POST | `/companies/:id/archive`, `/companies/:id/unarchive` | Archive or restore | member | | `Company` | CRM-1 | |
| GET | `/contacts` | List; filters include `companyId`, `ownerUserId`, `isDoNotContact`, `email`, `tagIds`, `custom.*` | viewer | `ContactListQuery` | `Page<Contact>` | CRM-1, CRM-5 | |
| POST | `/contacts/query` | JSON filter form | viewer | `RecordQuery` | `Page<Contact>` | CRM-5 | |
| POST | `/contacts` | Create | member | `ContactCreate` | `Contact` (201) | CRM-1 | |
| GET | `/contacts/:id` | With company and email verification status | viewer | | `ContactDetail` | CRM-1 | |
| PATCH | `/contacts/:id` | Edit; setting `isDoNotContact = true` also adds every email and phone to `suppressions` with reason `do_not_contact` | member | `ContactUpdate` | `Contact` | CRM-1, SUB-6 | `conflict` (`stale`) |
| POST | `/contacts/:id/archive`, `/contacts/:id/unarchive` | Archive or restore | member | | `Contact` | CRM-1 | |
| POST | `/contacts/:id/verify-emails` | Verify the contact's emails now (INTEGRATIONS §19) | member | | `Contact` | SUB-6 | `external_unavailable`, `limit_reached` |

### 5.14 Tasks, notes, tags (`crm`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/tasks` | List; filters `status`, `assigneeUserId`, `assigneeBotId`, `dueAt`, `recordType`, `recordId`, `priority` | viewer | `TaskListQuery` | `Page<Task>` | CRM-1 | |
| POST | `/tasks` | Create | member | `TaskCreate` | `Task` (201) | CRM-1 | |
| GET, PATCH | `/tasks/:id` | Read, edit; `status: 'done'` sets `completed_at` | viewer, member | `TaskUpdate` | `Task` | CRM-1 | `conflict` (`stale`) |
| DELETE | `/tasks/:id` | Delete (tasks have no archive; use `status: 'canceled'` to keep history) | member | | 204 | CRM-1 | |
| GET | `/records/:recordType/:recordId/notes` | Notes on a record, newest first | viewer | | `Page<Note>` | CRM-1, CRM-3 | |
| POST | `/records/:recordType/:recordId/notes` | Add a note (`body` TipTap JSON; the server derives `body_text`) | member | `NoteCreate` | `Note` (201) | CRM-1 | |
| PATCH, DELETE | `/notes/:id` | Edit or delete (author, or admin) | member | `NoteUpdate` | `Note`, 204 | CRM-1 | `forbidden` |
| GET | `/tags` | All tags (not paged) | viewer | | `{ data: Tag[] }` | CRM-7 | |
| POST | `/tags` | Create | member | `TagCreate` | `Tag` (201) | CRM-7 | `conflict` (`duplicate`) |
| PATCH, DELETE | `/tags/:id` | Rename, recolor, delete (removes `record_tags`) | admin | `TagUpdate` | `Tag`, 204 | CRM-7 | |
| PUT | `/records/:recordType/:recordId/tags/:tagId` | Tag a record | member | | 204 | CRM-7 | |
| DELETE | `/records/:recordType/:recordId/tags/:tagId` | Untag | member | | 204 | CRM-7 | |

`:recordType` in paths is one of DATA_MODEL's polymorphic values (`company`, `contact`, `deal`, `task`, `quote_request`, `draft`, `opportunity_match`); others return `not_found`.

### 5.15 Custom fields and field suggestions (`crm`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/field-definitions` | Definitions for an object (not paged) | viewer | `?object=company\|contact\|deal&includeArchived=` | `{ data: FieldDefinition[] }` | CRM-4 | |
| POST | `/field-definitions` | Create one of the 14 types with `aiFill` (`off`, `suggest`, `auto`) and `aiInstructions` | admin | `FieldDefinitionCreate` | `FieldDefinition` (201) | CRM-4 | `conflict` (`duplicate` key) |
| PATCH | `/field-definitions/:id` | Label, options, position, required, `aiFill`, `aiInstructions`. `key`, `object` and `type` are immutable. | admin | `FieldDefinitionUpdate` | `FieldDefinition` | CRM-4 | |
| POST | `/field-definitions/:id/archive` | Hide the field; values stay in `custom` | admin | | `FieldDefinition` | CRM-4 | |
| GET | `/field-suggestions` | Pending Bot suggestions; filter by `recordType`, `recordId`, `status` | viewer | `FieldSuggestionListQuery` | `Page<FieldSuggestion>` | CRM-4 | |
| POST | `/field-suggestions/:id/accept` | Write the value (or an edited value) with provenance from the suggestion; other pending suggestions for the same field become `superseded` | member | `{ value? }` | `FieldSuggestion` | CRM-4 | `conflict` (`state`) |
| POST | `/field-suggestions/:id/reject` | Reject | member | | `FieldSuggestion` | CRM-4 | `conflict` (`state`) |

### 5.16 Views, search, timeline, history, bulk, merge, import and export (`crm`, `search`, `activity`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/saved-views` | Personal and shared views for an object | viewer | `?object=` | `{ data: SavedView[] }` | CRM-5 | |
| POST | `/saved-views` | Create. `shared: true` (owner null) needs admin. | member | `SavedViewCreate` | `SavedView` (201) | CRM-5 | `forbidden` |
| PATCH, DELETE | `/saved-views/:id` | Edit or delete: own personal views, or shared views as admin | member | `SavedViewUpdate` | `SavedView`, 204 | CRM-5 | `forbidden` |
| GET | `/search` | Global fuzzy search across companies, contacts, deals and matches (tsvector plus trigram); p95 under 300 ms | viewer | `?q=` (1 to 200 chars) `&types=&limit=` (max 25 per type) | `SearchResults` `{ groups: { type, items: { recordType, recordId, title, subtitle, score }[] }[] }` | CRM-6 | |
| GET | `/records/:recordType/:recordId/activities` | Timeline, newest first; filter by `type` | viewer | `?filter[type][in]=` | `Page<Activity>` | CRM-3, BID-8 | |
| POST | `/records/:recordType/:recordId/activities` | Log a call or meeting by hand | member | `ActivityCreate` `{ type: 'call' \| 'meeting', summary, occurredAt, payload?, alsoLink?: RecordRef[] }` | `Activity` (201) | CRM-3 | |
| GET | `/records/:recordType/:recordId/history` | Field history from `record_history` | viewer | | `Page<RecordHistoryEntry>` | CRM-10 | |
| POST | `/records/bulk` | Tag, untag, assign owner, change stage, archive. Up to 1,000 ids synchronously (under 10 s); a `query` instead of ids runs as a Job up to 10,000 records. | member | `BulkActionRequest` `{ recordType, ids? , query?: RecordQuery, action: 'tag' \| 'untag' \| 'assign' \| 'move_stage' \| 'archive', params }` | `BulkResult` or Job | CRM-7 | `payload_too_large` (over limits) |
| POST | `/records/merge` | Merge duplicate companies or contacts into `keepId` in one transaction; moves links, notes, tasks, activities, deals, tags, quotes; `fieldChoices` picks values per field | member | `MergeRequest` `{ recordType: 'company' \| 'contact', keepId, mergeIds: uuid[] (1 to 10), fieldChoices: Record<field, uuid> }` | `Company` or `Contact` | CRM-9 | `conflict` (`state`: archived or same id) |
| POST | `/imports/preview` | Read the header and 20 rows of an uploaded CSV, suggest a mapping | member | `{ fileId, recordType: 'company' \| 'contact' \| 'deal' }` | `ImportPreview` `{ columns, sampleRows, suggestedMapping, rowCount }` | CRM-8 | `unsupported_media_type`, `file_not_ready` |
| POST | `/imports` | Import with mapping and dedupe (contacts by email, companies by UEI or domain); per-row errors go to an error CSV. 10,000 rows within 2 minutes. | member | `ImportRequest` `{ fileId, recordType, mapping: Record<column, field>, dedupe: { mode: 'skip' \| 'update' }, tagIds? }` | Job (`result: { created, updated, skipped, failed, errorFileId }`) | CRM-8 | `limit_reached` |
| POST | `/exports` | CSV export of any view or query; columns as in the view | viewer | `ExportRequest` `{ recordType, viewId? , query?, columns? }` | Job (`result: { fileId, rowCount }`) | CRM-8 | |

Import file rules: UTF-8 CSV (BOM allowed), comma or semicolon separated, max 50,000 rows and 20 MB. Imported values get provenance `import`; record history actor `import`.

### 5.17 Files (`files`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| POST | `/files/uploads` | Reserve a file and get a presigned R2 `PUT` URL (15 minutes) | member | `UploadRequest` `{ filename, contentType, sizeBytes, purpose?, link?: RecordRef }` | `UploadTicket` `{ fileId, uploadUrl, method: 'PUT', headers: { 'Content-Type' }, expiresAt }` | BID-1 | `payload_too_large`, `unsupported_media_type`, `limit_reached` (storage) |
| POST | `/files/:id/complete` | Confirm the upload: the api checks the object's size and type with `HEAD`, records it, links it, and queues the malware scan (queue `docs`) | member (uploader) | | `File` | BID-1 | `conflict` (`state`: object missing or size differs) |
| GET | `/files/:id` | Metadata and scan status | viewer | | `File` | | |
| GET | `/files/:id/download` | Presigned `GET` (5 minutes, `Content-Disposition: attachment`) | viewer | | `FileDownload` `{ url, expiresAt }` | | `file_not_ready`, `forbidden` (`scan_status = 'infected'`) |
| PUT | `/files/:id/links` | Link to a record with a purpose | member | `FileLinkRequest` `{ recordType, recordId, purpose }` | `File` | | |
| DELETE | `/files/:id/links/:recordType/:recordId` | Unlink | member | | 204 | | |
| GET | `/records/:recordType/:recordId/files` | Files linked to a record | viewer | | `{ data: File[] }` | CRM-3 | |
| DELETE | `/files/:id` | Delete the object and row (uploader or admin); refused while linked as `submission` | member | | 204 | | `conflict` (`in_use`) |

Allowed types: PDF, DOCX, XLSX, CSV, TXT, PNG, JPEG, TIFF, HEIC. Max size 100 MB for `bid_document` purpose, 25 MB otherwise. The browser uploads straight to R2; bytes never pass through the api.

### 5.18 Bots, jobs, tool policies, runs and memory (`bots`, `agentRuns`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/bots` | The Bot team (not paged) | viewer | | `{ data: Bot[] }` | BOT-1 | |
| GET | `/bots/:id` | One Bot with jobs and this month's run count | viewer | | `BotDetail` | BOT-1 | |
| PATCH | `/bots/:id` | Rename, instructions, `isEnabled` (off stops its jobs), `modelTier` | admin | `BotUpdate` | `Bot` | BOT-1 | |
| POST | `/bots/:id/runs` | Start a task for a Bot, optionally about a record, optionally in learning mode (trigger `api`) | member | `BotTaskRequest` `{ instructions, record?: RecordRef, isLearningMode? }` | `AgentRun` (202) | CH-6, CH-7, BOT-5 | `conflict` (`state`: Bot off), `limit_reached`, `model_unavailable` |
| GET | `/bots/:id/jobs` | Jobs | viewer | | `{ data: BotJob[] }` | BOT-6 | |
| POST | `/bots/:id/jobs` | Create a `custom` job | admin | `BotJobCreate` `{ name, scheduleCron?, config }` | `BotJob` (201) | BOT-6 | |
| PATCH | `/bot-jobs/:id` | Change time (`scheduleCron` in the workspace timezone), `config` (including `learningMode`), `isEnabled` | admin | `BotJobUpdate` | `BotJob` | BOT-5, BOT-6 | `validation_failed` (cron more often than hourly) |
| DELETE | `/bot-jobs/:id` | Delete a `custom` job | admin | | 204 | BOT-6 | `conflict` (`state`: built-in job) |
| POST | `/bot-jobs/:id/run` | Run now | member | | `AgentRun` (202) | BOT-6 | `limit_reached` |
| GET | `/tools` | The tool catalog for the UI: key, label, effect, default policy, promotable, which Bots use it (from AGENT_RUNTIME §3.3) | viewer | | `{ data: ToolCatalogEntry[] }` | BOT-3 | |
| GET | `/bots/:id/tool-policies` | Every tool this Bot can use with effect, effective policy (Bot override, else workspace default), counters and promotion suggestion | viewer | | `{ data: ToolPolicyView[] }` | BOT-3, BOT-4 | |
| PUT | `/bots/:id/tool-policies/:toolKey` | Set the Bot's policy for a tool | admin | `{ policy: 'always_allow' \| 'needs_approval' \| 'off' }` | `ToolPolicyView` | BOT-3 | `validation_failed` (external tools only accept `needs_approval` or `off`) |
| DELETE | `/bots/:id/tool-policies/:toolKey` | Remove the override (fall back to the workspace default) | admin | | `ToolPolicyView` | BOT-3 | |
| GET | `/tool-policies` | Workspace defaults (`bot_id` null) | viewer | | `{ data: ToolPolicyView[] }` | BOT-3 | |
| PUT | `/tool-policies/:toolKey` | Set a workspace default | admin | `{ policy }` | `ToolPolicyView` | BOT-3 | `validation_failed` |
| POST | `/bots/:id/tool-policies/:toolKey/promotion` | Answer the earned-autonomy suggestion: `accept: true` sets `always_allow` and audits it; either answer stops the suggestion | admin | `{ accept: boolean }` | `ToolPolicyView` | BOT-4 | `conflict` (`state`: no suggestion) |
| GET | `/runs` | Runs log; filters `botId`, `status`, `trigger`, `createdAt`, `record` | viewer | `RunListQuery` | `Page<AgentRun>` | BOT-7 | |
| GET | `/runs/:id` | Run with trigger, outcome, approvals, tools used | viewer | | `AgentRunDetail` | BOT-7 | |
| GET | `/runs/:id/steps` | Steps in order (`agent_steps`; args and results truncated to 32 KB) | viewer | | `Page<AgentStep>` | BOT-7 | |
| POST | `/runs/:id/cancel` | Cancel a queued, running or waiting run (DBOS cancel; pending approvals become `canceled`) | member | | `AgentRun` | BOT-7 | `conflict` (`state`: finished) |
| GET | `/bots/costs` | Cost per Bot per month from `usage_events` | admin | `?month=YYYY-MM` | `BotCostReport` | BOT-7, BIL-3 | |
| GET | `/memories` | Business memories and my own | viewer | `?filter[kind]&filter[scope]=business\|me` | `Page<Memory>` | BOT-8 | |
| POST | `/memories` | Add a memory; `scope: 'business'` (user_id null) needs admin | member | `MemoryCreate` `{ kind, text, scope }` | `Memory` (201) | BOT-8 | `forbidden` |
| PATCH, DELETE | `/memories/:id` | Edit text, confirm (`isConfirmed`), delete. Own memories, or business memories as admin. | member | `MemoryUpdate` | `Memory`, 204 | BOT-8 | `forbidden` |

Cost fields (`costMicros`, `tokensIn`, `tokensOut`) on runs and steps are `null` for roles below admin. `AgentRun` is the camelCase `agent_runs` row plus `bot: BotSummary`.

### 5.19 Threads and chat (`agentRuns`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/threads` | My threads; filter by `botId`, `recordType`, `recordId`, `channel` | viewer | `ThreadListQuery` | `Page<Thread>` | CH-6, CH-7 | |
| POST | `/threads` | Start a thread with a Bot, optionally about a record ("Ask a Bot") | viewer | `ThreadCreate` `{ botId, record?: RecordRef, title? }` | `Thread` (201) | CH-6, CH-7 | `conflict` (`state`: Bot off) |
| GET, PATCH, DELETE | `/threads/:id` | Read, rename, delete my thread | viewer (owner of the thread) | `ThreadUpdate` | `Thread`, 204 | CH-6 | |
| GET | `/threads/:id/messages` | Messages as AI SDK UI messages, oldest first, cursor backwards | viewer | `?cursor=&limit=` | `Page<ThreadMessage>` | CH-6 | |
| POST | `/threads/:id/chat` | Send a message and stream the reply (§10) | viewer | `ChatRequest` | `text/event-stream` (UI message stream v1) | CH-6 | `limit_reached`, `model_unavailable`, `conflict` (`state`: a reply is already streaming) |
| GET | `/threads/:id/stream` | Reattach to the in-progress reply stream (AI SDK resume) | viewer | | `text/event-stream`, or 204 when none | CH-6 | |
| POST | `/threads/:id/stop` | Stop the in-progress reply (cancels the run) | viewer | | 204 | CH-6 | |

Viewers can chat, but Bots acting for a viewer cannot write (FR-BOT-2): write tools return a refusal inside the run.

### 5.20 Approvals (`approvals`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/approvals` | Inbox, oldest first. Default `filter[status][eq]=pending`. Filters `requestedForUserId` (`me`), `effect`, `botId`, `toolKey`, `recordType`, `recordId`. | viewer | `ApprovalListQuery` | `Page<Approval>` | APR-1, APR-3 | |
| GET | `/approvals/count` | Pending count for me (badge) | viewer | | `{ pending: number }` | APR-3 | |
| GET | `/approvals/:id` | Full card: `preview` (email, SMS, record change before and after, document, stage change), why, sources, run summary, short code, expiry | viewer | | `ApprovalDetail` | APR-1 | |
| POST | `/approvals/:id/decide` | Approve, edit then approve, or skip (AGENT_RUNTIME §8.5 runs the checks). `editedArgs` is validated against the tool's input schema. Resumes the waiting run with `DBOS.send` (p95 under 5 s). Audited with channel `web`, or `email` when the card was opened from an approval email (`via`). `note` is stored in `decision_note`. | member (requested-for person, or admin) | `ApprovalDecisionRequest` `{ action: 'approve' \| 'edit_and_approve' \| 'skip', editedArgs?, note?, via?: 'web' \| 'email' }` | `Approval` | APR-2, APR-5 | `approval_expired`, `approval_already_decided`, `impersonation_blocked` (external), `validation_failed` |
| POST | `/approvals/bulk-decide` | Approve or skip many internal approvals | member | `{ ids: uuid[] (max 100), action: 'approve' \| 'skip' }` | `BulkResult` (per id: `validation_failed` for external ones, `approval_expired`, `approval_already_decided`) | APR-3 | |

Status mapping: `approve` sets `approved`, `edit_and_approve` sets `edited` (with `edited_args`), `skip` sets `rejected`. Counters on `tool_policies` change in the same transaction (`approved_unchanged`, `approved_edited`, `rejected`). On the Managed plan an external approval starts with `review_stage = 'staff'` and is not visible in this inbox until staff send it on (§6.3).

### 5.21 Channels and notifications (`channels`, `notifications`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/channels` | My channel bindings in this workspace and which channels the platform offers | viewer | | `ChannelsResponse` `{ data: ChannelBinding[], available: { sms, telegram, webPush } }` | CH-1, CH-2, CH-8 | |
| POST | `/channels/sms/start` | Send a 6-digit code to a mobile number through Twilio Verify; creates a `link_codes` row (channel `sms`, 10 minutes) | viewer | `SmsStartRequest` `{ phoneE164 }` (`^\+1[2-9]\d{9}$`, US numbers in v1) | `SmsStartResponse` `{ challengeId, expiresAt }` | CH-1 | `rate_limited`, `conflict` (`duplicate`: number bound to another member here), `external_unavailable` |
| POST | `/channels/sms/verify` | Check the code; 5 tries per challenge; on success creates the binding and sends a welcome text with STOP and HELP instructions | viewer | `SmsVerifyRequest` `{ challengeId, code }` (`^\d{6}$`) | `ChannelBinding` (201) | CH-1 | `validation_failed` (wrong code, `attemptsLeft`), `conflict` (`state`: expired, used, or 5 tries spent) |
| POST | `/channels/telegram/link` | Create a 10-minute deep link `https://t.me/<bot>?start=<code>` | viewer | | `TelegramLinkResponse` `{ url, code, expiresAt }` | CH-2 | `rate_limited` |
| GET | `/channels/web-push/key` | VAPID public key | viewer | | `{ publicKey }` | CH-8 | |
| POST | `/channels/web-push` | Register this browser's push subscription | viewer | `WebPushSubscribeRequest` `{ endpoint, keys: { p256dh, auth }, userAgent? }` | `ChannelBinding` (201) | CH-8 | |
| PATCH | `/channels/:id` | Turn a binding on or off | viewer (own) | `{ isEnabled }` | `ChannelBinding` | CH-1, CH-2 | |
| DELETE | `/channels/:id` | Disconnect (Telegram gets a goodbye message) | viewer (own) | | 204 | CH-1, CH-2 | |
| POST | `/channels/:id/test` | Send a test message | viewer (own) | | 202 | CH-1, CH-2, CH-8 | `external_unavailable` |
| GET | `/short-links/:code` | Resolve a short link from a text or Telegram message (`short_links`, requested in UX.md) to its in-app target; switches the active workspace when the link belongs to another of my workspaces. The web route `/s/:code` calls it after sign-in. | signed in, link's user | | `{ target, workspaceId }` | CH-3, CH-4 | `not_found` (unknown, expired or another user's) |
| GET | `/notifications` | In-app notifications (`channel = 'in_app'`), newest first | viewer | `?filter[readAt][isNull]=true` | `Page<Notification>` | CH-8 | |
| GET | `/notifications/unread-count` | Badge | viewer | | `{ unread: number }` | CH-8 | |
| POST | `/notifications/:id/read` | Mark read | viewer | | 204 | CH-8 | |
| POST | `/notifications/read-all` | Mark all read | viewer | | 204 | CH-8 | |

### 5.22 Connections (`integrations`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/connections` | Workspace connections and mine, with status and account label; never secrets | viewer | | `{ data: Connection[] }` | SET-2 | |
| POST | `/connections/:provider/start` | Start OAuth for `google` or `microsoft`, purpose `send_email`; writes `oauth_states` with a PKCE verifier (10 minutes) | member | `{ purpose: 'send_email', redirectTo }` | `{ authorizeUrl }` | SET-2, SUB-2 | `feature_not_available` (provider not configured) |
| GET | `/connections/:provider/callback` | OAuth redirect target. Checks `state` against `oauth_states` and the session user, exchanges the code, stores the refresh token in `secrets`, upserts `connections`, then `302` to `redirectTo` with `?connected=<provider>` or `?error=<code>`. No workspace header (browser navigation); the tenant comes from `oauth_states.tenant_id`. | signed in, same user | `?code=&state=` | 302 | SET-2 | |
| POST | `/connections/keys` | Bring your own key for `millionverifier`, `hunter` or `leadmagic`; the key is tested with a free provider call, then stored in `secrets` (`byok_api_key`) | admin | `ByokKeyRequest` `{ provider, purpose, apiKey }` | `Connection` (201) | SET-2 | `validation_failed` (key refused by provider), `external_unavailable` |
| POST | `/connections/:id/test` | Check the connection works (token refresh or key check) | member | | `Connection` | SET-2 | `external_unavailable` |
| DELETE | `/connections/:id` | Disconnect: revoke at the provider where it supports revocation, delete the `secrets` row, set `status = 'revoked'` | member (own), admin (workspace-wide) | | 204 | SET-2 | |

### 5.23 Billing and usage (`billing`, `usage`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/billing` | Plan, subscription status, trial end, period end, cancel date, entitlements, payment state | admin | | `BillingSummary` | BIL-1, BIL-2, BIL-6 | |
| GET | `/billing/plans` | Public plans from `plans` | viewer | | `{ data: Plan[] }` | BIL-2 | |
| POST | `/billing/checkout-session` | Stripe Checkout for a plan; unused trial days carry over as `trial_end` | admin | `{ planKey, successPath, cancelPath }` | `{ url }` | BIL-2 | `conflict` (`state`: already on that plan, use the portal), `external_unavailable` |
| POST | `/billing/portal-session` | Stripe Customer Portal for card, plan and invoices | admin | `{ returnPath }` | `{ url }` | BIL-2 | `external_unavailable` |
| POST | `/billing/run-packs/checkout-session` | One-time purchase of run packs | admin | `{ quantity: 1..5, successPath, cancelPath }` | `{ url }` | BIL-5 | `external_unavailable` |
| POST | `/billing/cancel` | Cancel at period end with an optional reason; one confirmation screen | admin | `{ reason?: string, feedback?: 'too_expensive' \| 'missing_features' \| 'switched_service' \| 'unused' \| 'other' }` | `BillingSummary` | BIL-7 | `external_unavailable` |
| POST | `/billing/resume` | Undo a pending cancellation | admin | | `BillingSummary` | BIL-7 | `conflict` (`state`) |
| GET | `/billing/usage` | Runs, document pages, texts and other counters against limits for the current or a past period, plus cost per Bot; numbers come from `usage_counters` | admin | `?period=current\|YYYY-MM-DD` | `UsageSummary` | BIL-3, BIL-4 | |

### 5.24 API keys and calendar feed (`apiKeys`, `bids`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/api-keys` | My keys; admins see everyone's. Calendar feed keys are excluded. | member | | `{ data: ApiKey[] }` | SET-3, API-1 | |
| POST | `/api-keys` | Create a key acting as me; the full key appears once in the response | member | `ApiKeyCreate` `{ name, scopes: ('read' \| 'write')[], expiresAt? }` | `ApiKeyCreated` `{ apiKey: ApiKey, key: string }` (201) | SET-3, API-1 | `feature_not_available` |
| DELETE | `/api-keys/:id` | Revoke now (`revoked_at`) | member (own), admin (any) | | 204 | SET-3 | |
| GET | `/calendar-feed` | My ICS feed URL, if one exists | viewer | | `{ url, createdAt }` | BID-4 | `not_found` |
| POST | `/calendar-feed` | Create or rotate my feed (revokes the old token) | viewer | | `{ url, createdAt }` (201) | BID-4 | |
| DELETE | `/calendar-feed` | Revoke | viewer | | 204 | BID-4 | |

Key format: `mgp_` plus 40 base62 characters from a CSPRNG. `prefix` = the first 8 characters (`mgp_` plus 4), `key_hash` = hex SHA-256 of the full key. A prefix collision on insert regenerates the key. A calendar feed is an `api_keys` row with `scopes = '{calendar:read}'` and name `Calendar feed`; its URL is `<APP_URL>/ics/<key>.ics` (§7).

### 5.25 Audit log (`audit`)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/audit-log` | Read-only, newest first; filters `actorType`, `actorId`, `action`, `targetType`, `targetId`, `createdAt` | owner | `AuditLogListQuery` | `Page<AuditEntry>` | SET-4, APR-5 | |
| GET | `/audit-log/export` | CSV of the filtered rows (max 100,000) | owner | same filters | file | SET-4 | |

### 5.26 Outgoing webhooks (`events`, v1)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/webhook-endpoints` | Endpoints | admin | | `{ data: WebhookEndpoint[] }` | API-3 | |
| POST | `/webhook-endpoints` | Add an HTTPS URL and event types; the signing secret appears once | admin | `WebhookEndpointCreate` `{ url, events: string[] }` | `WebhookEndpointCreated` `{ endpoint, secret }` (201) | API-3 | `validation_failed` (not https, private address) |
| PATCH, DELETE | `/webhook-endpoints/:id` | Edit, enable or disable, delete | admin | `WebhookEndpointUpdate` | `WebhookEndpoint`, 204 | API-3 | |
| POST | `/webhook-endpoints/:id/rotate-secret` | New secret; the old one keeps signing for 24 hours alongside | admin | | `{ secret }` | API-3 | |
| GET | `/webhook-endpoints/:id/deliveries` | Delivery log | admin | | `Page<WebhookDelivery>` | API-3 | |
| POST | `/webhook-deliveries/:id/resend` | Resend one delivery | admin | | `WebhookDelivery` (202) | API-3 | |

Delivery format is in §12.3.

### 5.27 Automations (`automations`, v1)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/automations` | List | viewer | | `Page<Automation>` | AUT-1 | |
| POST | `/automations` | Create from the form: trigger, conditions, steps | admin | `AutomationCreate` | `Automation` (201) | AUT-1 | |
| GET, PATCH, DELETE | `/automations/:id` | Read, edit (bumps `version`), delete | viewer, admin, admin | `AutomationUpdate` | `Automation`, 204 | AUT-1 | |
| POST | `/automations/:id/test` | Dry run against a sample record; no effects | admin | `{ record?: RecordRef, eventPayload? }` | `AutomationTestResult` | AUT-1 | |
| GET | `/automations/:id/runs` | Runs with step results | viewer | | `Page<AutomationRun>` | AUT-1 | |
| POST | `/automations/:id/webhook-secret` | For an incoming-webhook trigger: create or rotate the secret; returns the URL `<APP_URL>/webhooks/automation/<tenantId>/<automationId>` | admin | | `{ url, secret }` | AUT-1 | |

Step kinds `send_templated_email` always create an external approval. Automation runs retry each failed step 3 times.

### 5.28 Reports (`reports`, v1)

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/reports` | Personal and shared reports | viewer | | `{ data: Report[] }` | REP-1 | |
| POST, PATCH, DELETE | `/reports`, `/reports/:id` | Manage reports (shared ones need admin) | member | `ReportCreate`, `ReportUpdate` | `Report` | REP-1 | `forbidden` |
| POST, PATCH, DELETE | `/reports/:id/widgets`, `/reports/:id/widgets/:widgetId` | Manage widgets (`number`, `bar`, `line`, `table`) | member | `WidgetCreate`, `WidgetUpdate` | `ReportWidget` | REP-1 | |
| POST | `/reports/widgets/data` | Run a widget query over companies, contacts, deals or matches (under 2 s for 50,000 records) | viewer | `WidgetQuery` | `WidgetData` | REP-1 | `validation_failed` (unsupported grouping) |
| GET | `/reports/bid-metrics` | Fixed metrics: bids found, pursued, submitted, won, win rate, average bid value, Bot time | viewer | `?from=&to=` | `BidMetrics` | REP-1 | |

### 5.29 Jobs

| Method | Path | Purpose | Role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/jobs/:id` | Status of an import, export, package, draft export or scan this workspace started | viewer (export and import jobs: the starter or admin) | | `Job` | CRM-8, BID-9 | |

## 6. Operator API (`/api/ops`, v1)

Staff only (`users.is_staff`). Queries that span tenants use the `magpie_ops` pool through `packages/core/ops` only. Every request, reads included, writes an `audit_log` row with `actor_type = 'staff'`, `tenant_id` of the tenant viewed (null for cross-tenant lists) and the query parameters (FR-OPS-1). Role column values are `staff_role`.

### 6.1 Tenants and costs

| Method | Path | Purpose | Staff role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/api/ops/tenants` | Tenants with plan, status, MRR, usage, AI and vendor cost, margin for the current month; search by name, slug, owner email, Stripe customer id | support | `OpsTenantListQuery` | `Page<OpsTenantRow>` | OPS-1 | |
| GET | `/api/ops/tenants/:tenantId` | Detail: members, subscription, entitlements and overrides, usage counters, recent failed runs, channel health, deletion state | support | | `OpsTenantDetail` | OPS-1 | |
| GET | `/api/ops/costs` | AI, SMS, Kontract, enrichment and email spend per tenant per day against revenue, from `usage_events` and Stripe | admin | `?from=&to=&groupBy=tenant\|day\|provider` | `CostReport` | OPS-6 | |
| GET | `/api/ops/audit` | Platform-wide audit search | admin | `AuditLogListQuery` plus `tenantId` | `Page<AuditEntry>` | OPS-1 | |

### 6.2 Support actions, lifecycle, entitlements and flags

| Method | Path | Purpose | Staff role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| POST | `/api/ops/tenants/:tenantId/impersonations` | Impersonate a member for support: required reason, 60-minute limit, writes `impersonations`, then calls Better Auth's admin impersonation for the staff session and sets the active workspace | support | `{ userId, reason }` (reason 10 to 500 chars) | `{ impersonationId, endsAt }` (201) | OPS-2 | `conflict` (`state`: already impersonating) |
| POST | `/api/ops/impersonations/:id/end` | End early; also ended automatically at 60 minutes by the session check | support | | 204 | OPS-2 | |
| POST | `/api/ops/tenants/:tenantId/suspend` | `tenants.status = 'suspended'`, `suspended_at`; Bot jobs stop | admin | `{ reason }` | `OpsTenantDetail` | OPS-3 | `conflict` (`state`) |
| POST | `/api/ops/tenants/:tenantId/unsuspend` | Back to the status the subscription implies | admin | `{ reason }` | `OpsTenantDetail` | OPS-3 | |
| POST | `/api/ops/tenants/:tenantId/trial-extension` | Push `trial_ends_at` out | admin | `{ days: 1..30, reason }` | `OpsTenantDetail` | OPS-3 | `conflict` (`state`: not trialing) |
| POST | `/api/ops/tenants/:tenantId/credits` | Grant account credit (Stripe customer balance transaction) | admin | `{ amountCents: 1..100000, reason }` | `OpsTenantDetail` | OPS-3 | `external_unavailable` |
| PUT | `/api/ops/tenants/:tenantId/entitlements/:key` | Override an entitlement (`source = 'override'`) | admin | `{ limitValue: number \| null, resetPeriod, reason }` | `Entitlement` | OPS-3 | |
| DELETE | `/api/ops/tenants/:tenantId/entitlements/:key` | Remove the override; the plan value returns | admin | `?reason=` | 204 | OPS-3 | |
| POST | `/api/ops/tenants/:tenantId/deletion` | Schedule deletion (30 days, cancelable) | admin | `{ reason }` | `TenantDeletion` | OPS-3 | |
| DELETE | `/api/ops/tenants/:tenantId/deletion` | Cancel a scheduled deletion | admin | `{ reason }` | 204 | OPS-3 | `conflict` (`state`: completed) |
| PUT | `/api/ops/tenants/:tenantId/reviewers` | Assign Managed-plan reviewers (`staff_assignments`, SECURITY §20) | admin | `{ reviewerUserIds: uuid[] }` | `OpsTenantDetail` | OPS-5 | `validation_failed` (not a reviewer) |
| GET | `/api/ops/flags` | Flags with global and per-tenant values | admin | | `{ data: FeatureFlag[] }` | OPS-4 | |
| PUT | `/api/ops/flags/:key` | Set a global value (`tenantId` omitted) or a tenant override; takes effect within 1 minute (flag cache TTL 30 s) | admin | `{ tenantId?, isEnabled, value? }` | `FeatureFlag` | OPS-4 | |
| DELETE | `/api/ops/flags/:key` | Remove a tenant override, or the global row | admin | `?tenantId=` | 204 | OPS-4 | |

### 6.3 Managed review queue

| Method | Path | Purpose | Staff role | Request | Response | FR | Errors |
|---|---|---|---|---|---|---|---|
| GET | `/api/ops/review-queue` | Approvals with `review_stage = 'staff'` and `status = 'pending'` for tenants assigned to me (admins see all), oldest first | reviewer | `?tenantId=` | `Page<ApprovalDetail>` | OPS-5 | |
| GET | `/api/ops/review-queue/:approvalId` | One card with the tenant's profile summary and the bid context | reviewer | | `ApprovalDetail` | OPS-5 | `not_found` (not assigned) |
| POST | `/api/ops/review-queue/:approvalId/claim` | Set `assigned_staff_user_id` to me | reviewer | | `ApprovalDetail` | OPS-5 | `conflict` (`state`: claimed by someone else) |
| POST | `/api/ops/review-queue/:approvalId/decide` | `send_to_owner` (optionally with `editedArgs`): `review_stage` becomes `owner`, `staff_reviewed_by` and `staff_reviewed_at` are set, notifications go to the owner. `return_to_bot`: `status = 'rejected'`, `decided_by_type = 'staff'`, notes in `decision_note`, and the run resumes so the Bot revises with the notes (AGENT_RUNTIME §8.7). | reviewer | `ReviewDecisionRequest` `{ action: 'send_to_owner' \| 'return_to_bot', editedArgs?, notes? }` (notes required for `return_to_bot`) | `ApprovalDetail` | OPS-5 | `approval_expired`, `approval_already_decided` |
| GET | `/api/ops/review-queue/stats` | Median and p90 review time per reviewer, queue depth by age | admin | `?from=&to=` | `ReviewStats` | OPS-5 | |

## 7. Public token routes and health

| Method | Path | Purpose | Auth | Response | FR |
|---|---|---|---|---|---|
| GET | `/ics/<key>.ics` | The person's bid deadlines (proposal due, questions due, site visit, amendment acknowledgment, other) for open bids, from 30 days back to 365 days ahead. `VEVENT` per `bid_deadlines` row: `UID` `<deadline id>@<APP_URL host>`, `DTSTART` in UTC, `SUMMARY` "<kind label>: <deal name>", `DESCRIPTION` with the bid link, `VALARM` at 24 hours. `ETag` and `Last-Modified` for conditional GET. | `api_keys` row with scope `calendar:read`, looked up with `tenant_for_api_key_prefix`; revoked or expired keys return 404 | `text/calendar; charset=utf-8` | BID-4 |
| GET | `/unsubscribe/<token>` | Page that confirms the address and offers one button | HMAC token (below) | HTML | SUB-6 |
| POST | `/unsubscribe/<token>` | One-click unsubscribe (RFC 8058 `List-Unsubscribe=One-Click` posts here too); inserts `suppressions` with reason `unsubscribe` | HMAC token | 200 HTML or 204 | SUB-6 |
| GET | `/files/shared/<token>` | Download an attachment of a quote request: `302` to a 5-minute presigned R2 URL | HMAC token | 302 | SUB-2 |
| GET | `/health` | Process is up | none | `{ status: 'ok', version, commit }` | |
| GET | `/ready` | Database reachable with the `magpie_app` role, migrations at the expected version, DBOS client connected | none | 200 `{ status: 'ready', checks }` or 503 `{ status: 'not_ready', checks }` | |

Signed tokens for `/unsubscribe` and `/files/shared` are `base64url(payload) + "." + base64url(HMAC-SHA256(LINK_SIGNING_KEY, payload))`. Unsubscribe payload: `{ v: 1, t: tenantId, a: address, m: messageId }`, no expiry. File payload: `{ v: 1, t: tenantId, f: fileId, q: quoteRequestId, exp }` with `exp` = quote due date plus 14 days. No database lookup is needed to find the tenant; the handler opens `withTenant(t)` after the HMAC checks out. A bad or expired token returns a plain 404 page.

## 8. Realtime stream (`GET /api/app/events`)

| Aspect | Rule |
|---|---|
| Transport | Server-Sent Events, `Content-Type: text/event-stream`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. Hono `streamSSE`. |
| Auth | Session cookie and `?workspaceId=<tenant id>` (EventSource cannot send headers); must equal the active workspace. |
| Source | Each `api` instance holds one `LISTEN domain_events` connection. A notification carries `<tenant_id>:<event_id>`; the instance loads the row and pushes it to that tenant's connected clients that are allowed to see it. |
| Frame | `id: <domain_events.id>`, `event: domain`, `data: <EventEnvelope JSON>`, blank line. One event name for every domain event, so the client needs a single listener and switches on `data.type`. Control frames use `event: reset`. |
| Envelope | `{ id, type, createdAt, actor: { type, id } \| null, payload }`. Payloads carry ids and a few small fields only, never whole records, so role rules and field visibility stay in the REST reads the client makes after invalidating. |
| Audience | `payload.audienceUserIds` (optional) limits delivery to those users: threads, personal memories, notifications, channel bindings, approvals requested for someone. Events without it go to every member of the tenant. |
| Heartbeat | Comment line `: ping` every 25 seconds. First frame sets `retry: 3000`. |
| Connection life | The server closes each stream after 10 minutes; the browser reconnects with `Last-Event-ID`. This keeps connections under proxy limits and spreads them across instances. |
| Replay | On connect with `Last-Event-ID`, the server sends rows of this tenant with `id` greater than that id (UUIDv7 order), oldest first, up to 1,000, filtered by audience, then switches to live. If the id is unknown, older than the 7-day retention, or more than 1,000 events behind, it sends one `event: reset` and the client invalidates every query. |
| Limits | 5 open streams per user per workspace; a sixth closes the oldest. |
| Internal-only types | Event types listed with "internal" in §9 are never sent to browsers. |

## 9. Event types and query invalidation

Types are dot-namespaced (`<entity>.<verb>`), the full list is the zod enum in `packages/shared/src/events.ts`, and the client map from type to TanStack Query keys lives next to it (ARCHITECTURE §9). Query keys follow one scheme: `[resource]` for lists, `[resource, id]` for one item, `[resource, id, sub]` for a sub-list; invalidating a prefix covers everything under it. `{x}` is a value from the payload.

| Event type | Payload (beyond `id`s named) | Invalidates |
|---|---|---|
| `company.created`, `company.updated`, `company.archived` | `companyId` | `['companies']`, `['companies', {companyId}]`, `['search']` |
| `company.merged` | `keptId`, `mergedIds` | `['companies']`, `['contacts']`, `['deals']`, `['search']` |
| `contact.created`, `contact.updated`, `contact.archived` | `contactId`, `companyId` | `['contacts']`, `['contacts', {contactId}]`, `['companies', {companyId}]`, `['search']` |
| `contact.merged` | `keptId`, `mergedIds` | `['contacts']`, `['deals']`, `['search']` |
| `deal.created`, `deal.updated`, `deal.archived` | `dealId`, `pipelineId` | `['deals']`, `['deals', {dealId}]`, `['today']` |
| `deal.stage_changed` | `dealId`, `fromStageId`, `toStageId` | `['deals']`, `['deals', {dealId}]`, `['records', 'deal', {dealId}, 'activities']`, `['today']`, `['reports']` |
| `pipeline.updated` | `pipelineId` | `['pipelines']`, `['deals']` |
| `task.created`, `task.updated`, `task.deleted` | `taskId`, `recordType`, `recordId` | `['tasks']`, `['tasks', {taskId}]`, `['records', {recordType}, {recordId}]`, `['today']` |
| `note.created`, `note.updated`, `note.deleted` | `noteId`, `recordType`, `recordId` | `['records', {recordType}, {recordId}, 'notes']`, `['records', {recordType}, {recordId}, 'activities']`, and `['drafts', {recordId}, 'comments']` when `recordType` is `draft` |
| `tag.changed` | `tagId` | `['tags']` |
| `record.tagged`, `record.untagged` | `recordType`, `recordId`, `tagId` | `['records', {recordType}, {recordId}]` and the list key of that type (`['companies']`, `['contacts']`, `['deals']`, `['tasks']`, `['matches']`) |
| `field_definition.changed` | `object` | `['fieldDefinitions', {object}]` |
| `field_suggestion.created`, `field_suggestion.decided` | `suggestionId`, `recordType`, `recordId` | `['fieldSuggestions']`, `['records', {recordType}, {recordId}]` |
| `saved_view.changed` | `viewId`, `object` | `['savedViews', {object}]` |
| `activity.created` | `activityId`, `links: RecordRef[]` | `['records', {recordType}, {recordId}, 'activities']` for each link |
| `file.scanned` | `fileId`, `scanStatus`, `links` | `['files', {fileId}]`, `['records', ..., 'files']` per link, `['deals', {dealId}, 'documents']` when linked to a deal |
| `job.updated` | `jobId`, `kind`, `status` (audience: the starter) | `['jobs', {jobId}]` |
| `match.created` | `matchId`, `searchId`, `score` | `['matches']`, `['today']`, `['savedSearches']` |
| `match.updated` | `matchId`, `status` | `['matches']`, `['matches', {matchId}]`, `['today']` |
| `match.pursued` | `matchId`, `dealId` | `['matches']`, `['matches', {matchId}]`, `['deals']`, `['today']` |
| `search.scanned` | `searchId`, `newMatches` | `['savedSearches']`, `['savedSearches', {searchId}]` |
| `bid.document_added`, `bid.document_updated` | `dealId`, `documentId`, `kind`, `textStatus` | `['deals', {dealId}, 'documents']`, `['deals', {dealId}, 'bid']` |
| `bid.documents_ready` | `dealId`, `documentIds` | `['deals', {dealId}, 'documents']`, `['deals', {dealId}, 'bid']` |
| `bid.amendment_ready` | `dealId`, `documentIds` | `['deals', {dealId}, 'documents']`, `['deals', {dealId}, 'bid']`, `['today']` |
| `bid.brief_updated` | `dealId`, `version` | `['deals', {dealId}, 'brief']`, `['deals', {dealId}, 'bid']` |
| `bid.requirements_updated` | `dealId` | `['deals', {dealId}, 'requirements']`, `['deals', {dealId}, 'bid']`, `['drafts']` |
| `bid.deadlines_changed` | `dealId`, `changes: [{ kind, before, after }]` | `['deals', {dealId}, 'deadlines']`, `['deadlines']`, `['today']` |
| `deal.bid_decided` | `dealId`, `decision` | `['deals', {dealId}, 'decision']`, `['deals', {dealId}]`, `['deals']` |
| `bid.ai_policy_changed` | `dealId`, `allowed` | `['deals', {dealId}, 'bid']`, `['deals', {dealId}]` |
| `submission.created` | `dealId`, `submissionId` | `['deals', {dealId}, 'submissions']`, `['deals', {dealId}]`, `['deals']` |
| `package.ready` | `dealId`, `jobId` | `['deals', {dealId}, 'packages']`, `['jobs', {jobId}]` |
| `price_sheet.updated`, `price_sheet.approved` | `dealId`, `priceSheetId`, `version` | `['priceSheets', {priceSheetId}]`, `['deals', {dealId}, 'priceSheets']`, `['deals', {dealId}, 'bid']` |
| `comparables.updated` | `dealId` | `['deals', {dealId}, 'comparables']` |
| `quote_request.updated` | `quoteRequestId`, `dealId`, `status` | `['quoteRequests', {quoteRequestId}]`, `['deals', {dealId}, 'quoteRequests']` |
| `quote.received` | `quoteId`, `quoteRequestId`, `dealId` | `['deals', {dealId}, 'quotes']`, `['quoteRequests', {quoteRequestId}]`, `['today']` |
| `quote.updated` | `quoteId`, `dealId` | `['deals', {dealId}, 'quotes']` |
| `quote.confirmed` | `quoteId`, `dealId` | `['deals', {dealId}, 'quotes']`, `['deals', {dealId}, 'priceSheets']` |
| `message.received` | `messageId`, `quoteRequestId`, `dealId` | `['quoteRequests', {quoteRequestId}]`, `['records', 'deal', {dealId}, 'activities']` |
| `message.status_changed` | `messageId`, `status`, `quoteRequestId` | `['quoteRequests', {quoteRequestId}]` |
| `draft.created`, `draft.updated` | `draftId` (document id), `dealId`, `version`, `updatedAt` | `['drafts']`, `['drafts', {draftId}]`. The editor ignores `draft.updated` whose `updatedAt` is not newer than its own last save, so autosave never reloads the open editor. |
| `draft.version_created`, `draft.approved` | `draftId`, `version` | `['drafts', {draftId}]`, `['drafts', {draftId}, 'versions']`, `['deals', {dealId}, 'bid']` |
| `run.updated` | `runId`, `botId`, `status`, `trigger` | `['runs']`, `['runs', {runId}]`, `['bots', {botId}]` |
| `run.finished` | `runId`, `botId`, `status`, `record?` | as `run.updated`, plus `['billing', 'usage']` and the record's keys |
| `bot.updated` | `botId` | `['bots']`, `['bots', {botId}]` |
| `bot_job.updated` | `botId`, `jobId` | `['bots', {botId}, 'jobs']` |
| `tool_policy.updated`, `tool_policy.promotion_suggested` | `botId`, `toolKey` | `['bots', {botId}, 'toolPolicies']`, `['toolPolicies']` |
| `thread.message_created` | `threadId`, `messageId` (audience: thread owner) | `['threads', {threadId}, 'messages']`, `['threads']` |
| `memory.changed` | `memoryId`, `scope` (audience: owner for `me`) | `['memories']` |
| `approval.requested` | `approvalId`, `effect`, `requestedForUserId`, `reviewStage` | `['approvals']`, `['approvals', 'count']`, `['today']` |
| `approval.decided`, `approval.expired`, `approval.canceled` | `approvalId`, `status`, `runId` | `['approvals']`, `['approvals', {approvalId}]`, `['approvals', 'count']`, `['runs', {runId}]`, `['today']` |
| `channel.updated` | `bindingId`, `channel`, `isEnabled` (audience: the user) | `['channels']` |
| `notification.created` | `notificationId`, `kind` (audience: the user) | `['notifications']`, `['notifications', 'unreadCount']` |
| `profile.updated` | `fields` | `['profile']`, `['today']` |
| `library.changed`, `past_performance.changed` | `itemId` | `['libraryItems']`, `['pastPerformance']`, `['today']` |
| `workspace.updated` | `fields` | `['workspace']`, `['settings']`, `['me']` |
| `member.updated` | `userId`, `role` or `removed` | `['members']`, and `['me']` for that user; when the user was removed, their open streams receive `event: reset` and then close |
| `connection.updated` | `connectionId`, `status` | `['connections']` |
| `billing.updated` | `status`, `planKey` | `['billing']`, `['me']` |
| `usage.threshold_reached` | `key`, `threshold: 80 \| 100 \| 120` | `['billing', 'usage']`, `['me']`, `['today']` |
| `automation.run_finished` (v1) | `automationId`, `runId`, `status` | `['automations', {automationId}, 'runs']` |
| `webhook_delivery.updated` (v1, internal) | `endpointId`, `deliveryId` | none (internal) |
| `outbox.*` (internal) | | none (internal) |

Types consumed by outgoing webhooks (§12.3), automations and the Bot event triggers (AGENT_RUNTIME §2.10: `match.pursued`, `bid.documents_ready`, `bid.amendment_ready`, `deal.bid_decided`, `deal.stage_changed`, `bid.deadlines_changed`, `message.received`, `quote.confirmed`, `profile.updated`) are the same rows; there is no second event bus. `bot.delegate_result` is internal to AGENT_RUNTIME and not sent to browsers.

## 10. Chat streaming (`POST /api/app/threads/:id/chat`)

The web app uses the AI SDK's `useChat` with a transport that sends only the new message, because the server keeps history in `thread_messages`. The response is the AI SDK UI message stream protocol over HTTP.

**Request** (`ChatRequest`):

```json
{ "message": { "id": "<client uuid>", "role": "user", "parts": [{ "type": "text", "text": "What's due this week?" }] } }
```

Text is 1 to 8,000 characters. The thread's `record_type` and `record_id` give the context record (FR-CH-7).

**Server steps:**
1. Validate, check the thread belongs to the user, check that no reply is streaming on this thread (`conflict`), check the `ai_runs` entitlement and per-run caps (`limit_reached` as problem+json before any stream byte).
2. Insert the user `thread_messages` row (its id is the client's message id) and an `agent_runs` row (trigger `chat`, `trigger_ref` = thread id), then enqueue `agentRunWorkflow` on queue `agent` with workflow id `run:<tenant_id>:chat:<thread_message_id>` (AGENT_RUNTIME §4.2). A retried request with the same message id attaches to the same run.
3. Respond `200` with `Content-Type: text/event-stream`, `x-vercel-ai-ui-message-stream: v1`, `Cache-Control: no-store`, `X-Accel-Buffering: no`, and relay the run. The segment workflow writes events to its DBOS stream `events` (`text-delta`, `tool-call`, `approval`, `reset`, `done`, each with `seq`, AGENT_RUNTIME §4.12); the api reads it with the DBOS client's `readStream`, drops repeated `seq` values (a retried step can repeat deltas), and converts each event to the UI message chunks below.
4. A run is split into segments at approvals (AGENT_RUNTIME §4.1). When a segment ends waiting for an approval, the response ends with `data-run` status `waiting_approval`, `finish` and `[DONE]`. When the approval is decided, the next segment publishes `run.updated` over SSE (§8) and the web app opens its stream with `GET /threads/:id/stream`. When the run finishes, the worker stores the assistant message (final UI message parts) in `thread_messages`.

**Frames:** each chunk is `data: <JSON>` followed by a blank line. Chunk types used:

| Chunk | When |
|---|---|
| `start` | first frame, with `messageId` = the assistant `thread_messages.id` |
| `data-run` | right after `start` and on status changes: `{ runId, status }` |
| `start-step`, `finish-step` | around each model call |
| `text-start`, `text-delta`, `text-end` | reply text |
| `tool-input-start`, `tool-input-available`, `tool-output-available` | tool calls, with a short human label in the tool name map |
| `data-approval` | from an `approval` event: `{ approvalId, shortCode, title, effect, expiresAt }`; the card renders inline and is decided through §5.20 |
| `data-reset` | from a `reset` event: the client discards the partial text of the current step (a retried model call starts over) |
| `data-notice` | plain notices such as "This bid bans AI drafting, so I won't write it." |
| `data-problem` | `{ code, detail }` for errors after streaming started, followed by `error` (`errorText` = `detail`) |
| `finish` | last frame before `[DONE]` |

Custom `data-*` part schemas are named exports of `packages/shared/src/schemas/chat.ts` (`ChatDataRunSchema`, `ChatDataApprovalSchema`, `ChatDataResetSchema`, `ChatDataNoticeSchema`, `ChatDataProblemSchema`).

**Disconnects:** closing the response does not cancel the run; the reply is still saved. `GET /threads/:id/stream` replays the active segment's stream from its first event (AI SDK resume) or returns 204 when nothing is streaming. `POST /threads/:id/stop` cancels the run.

**Telegram and SMS chat** are not streamed: the worker sends the final text when the run finishes (Telegram split at 4,096 characters; SMS cut at 600 characters with a link to the thread).

## 11. Inbound webhooks (`/webhooks/*`)

### 11.1 Common pipeline

1. Read the raw body (needed for signatures) within the provider's size limit; larger bodies get 413.
2. Verify authenticity (table below). Failure: `401`, nothing stored, a warning log with provider and source IP, no body logged.
3. Dedupe: `insert into webhook_receipts (provider, external_id) ... on conflict do nothing returning 1` through the `magpie_ops` pool. If the row existed, answer success now.
4. Enqueue the handling workflow on the DBOS client with a deterministic workflow id (`inbound:<provider>:<external_id>`), so a second enqueue is a no-op. If the enqueue fails, delete the receipt row and answer `500` so the provider retries.
5. Answer quickly (Twilio waits 15 seconds, Telegram and Stripe retry slow endpoints). The api does no tenant work beyond the resolver call; the workflow in `worker` opens `withTenant` with the resolved tenant.
6. Receipts older than 30 days are deleted by the `cleanup` schedule.

### 11.2 Providers

| Path | Verification | Dedupe `external_id` | Tenant resolution | Workflow, queue | Response |
|---|---|---|---|---|---|
| `POST /webhooks/stripe` | `Stripe-Signature` with `stripe.webhooks.constructEvent(rawBody, header, STRIPE_WEBHOOK_SECRET)`, 300 s tolerance. Body max 1 MB. | `event.id`; the payload also goes to `billing_events` | `tenant_for_stripe_customer(data.object.customer)`; cross-checked with `metadata.tenantId` when present | `stripeEventWorkflow`, `sync` | `200 {}` |
| `POST /webhooks/twilio/sms` | `X-Twilio-Signature` with `twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, TWILIO_WEBHOOK_BASE_URL + path, params)`; reject duplicate form keys; `AccountSid` and `MessagingServiceSid` must match ours. Form body max 64 KB. | `MessageSid` | `binding_for_channel_address('sms', From)` (may return several workspaces, §11.7) | `inboundSmsWorkflow`, `messaging` | `200 <Response/>` (TwiML, `text/xml`); replies go out through the REST API, never TwiML |
| `POST /webhooks/twilio/status` | Same signature check | `status:<MessageSid>:<MessageStatus>` | none needed: the `notifications` row is found by `provider_message_id` inside the tenant carried in the callback URL query `?t=<tenant id>&n=<notification id>`, set when sending; the signature covers the query | `smsStatusWorkflow`, `messaging` | `204` |
| `POST /webhooks/telegram` | `X-Telegram-Bot-Api-Secret-Token` equals `TELEGRAM_WEBHOOK_SECRET` (constant-time compare). Body max 256 KB. | `update_id` | `/start <code>`: `tenant_for_link_code(code)`. Other messages and button presses: `binding_for_channel_address('telegram', chat.id)` | `inboundTelegramWorkflow`, `messaging` | `200` always after verification; Telegram retries anything else |
| `POST /webhooks/postmark-inbound` | HTTP Basic credentials in the webhook URL, compared constant-time with `POSTMARK_INBOUND_BASIC_USER` and `POSTMARK_INBOUND_BASIC_PASSWORD`; optional IP allowlist from Postmark's published list. Body max 50 MB (attachments are base64). | `MessageID` | `tenant_for_reply_token(token)` where `token` comes from the first recipient matching `^(q\|u)-([a-z2-7]{52})@<INBOUND_EMAIL_DOMAIN>$` in `OriginalRecipient`, `ToFull`, `CcFull`, `BccFull`. `q-` is a reply (§11.8); `u-` is a mailto unsubscribe: add the sender to `suppressions` (`unsubscribe`) and stop | `inboundEmailWorkflow`, `messaging` | `200`. Unknown or missing token: `200` and drop (logged). Bad credentials: `401` (Postmark keeps retrying; it stops only on `403`). |
| `POST /webhooks/postmark-events` | Basic credentials `POSTMARK_EVENTS_BASIC_USER` and `POSTMARK_EVENTS_BASIC_PASSWORD`. Body max 1 MB. | `<RecordType>:<ID or MessageID>` | `Metadata.tenantId` that Magpie set on the outbound message, accepted only if a `messages` or `notifications` row with that `provider_message_id` exists in that tenant; otherwise drop | `emailEventWorkflow`, `messaging` | `200` |
| `POST /webhooks/automation/:tenantId/:automationId` (v1) | `Magpie-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + body)>` and `Magpie-Timestamp` within 5 minutes, with the automation's secret from `secrets` | `Magpie-Webhook-Id` header, else SHA-256 of body | `:tenantId` from the path; the signature check inside `withTenant(:tenantId)` proves it | `automationRunWorkflow`, `system` | `202` |
| `/webhooks/google`, `/webhooks/microsoft` | reserved for v2 mailbox reading (Gmail push, Graph change notifications) | | | | `404` in v1 |

### 11.3 Stripe events

The handler never trusts event order: for subscription events it retrieves the current subscription from Stripe and writes that state. Details of entitlement math and the past-due state machine are in BILLING.md.

| Event | Work |
|---|---|
| `checkout.session.completed`, `mode = 'subscription'` | Retrieve the subscription; upsert `subscriptions` (`stripe_subscription_id`, `plan_key` by matching the price to `plans.stripe_price_id`, `status`, periods, `trial_end`, `cancel_at`); recompute `entitlements` from the plan; set `tenants.plan_key` and `tenants.status`. |
| `checkout.session.completed` with `mode = 'payment'`, `metadata.kind = 'run_pack'`, `payment_status = 'paid'`; and `checkout.session.async_payment_succeeded` | Add the run pack entitlement (`source = 'addon'`); resume paused Bot jobs if usage drops below 120%; notify admins. |
| `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed` | Retrieve and upsert as above; map status to `tenants.status`; `deleted` sets `canceled_at`. |
| `customer.subscription.trial_will_end` | Only for Checkout trials carried over from the in-app trial; reminder notification. In-app trial reminders come from the `trial-lifecycle` schedule. |
| `invoice.paid` | Clear past-due state; record revenue for the ops MRR view. |
| `invoice.payment_failed` | Retrieve subscription; enter or advance the past-due state machine; email owner and admins; banner via `billing.updated`. |
| `invoice.payment_action_required` | Email the owner the hosted invoice link. |
| `invoice.finalization_failed` | Ops alert; if `automatic_tax.status = 'requires_location_inputs'`, email the owner to update the billing address in the portal. |
| `charge.refunded`, `charge.dispute.created` | Ops alert and audit row; a refunded run pack removes its unused entitlement. |
| anything else | Stored in `billing_events`, marked processed, no action. |

### 11.4 Twilio inbound SMS

Parameters used: `From`, `To`, `Body`, `MessageSid`, `AccountSid`, `MessagingServiceSid`, `NumSegments`, `OptOutType`.
- `OptOutType = STOP`: set `is_enabled = false` on every `sms` binding with that address (each bound workspace), `disabled_reason = 'stop'` (§15). Send nothing: Twilio already replied and blocks further sends.
- `OptOutType = START`: re-enable bindings whose `disabled_reason` is `stop`. Send nothing.
- `OptOutType = HELP`: record only; Twilio sends the configured HELP text (FR-CH-1).
- Otherwise: insert `inbound_channel_messages` (unique `(tenant_id, channel, external_id)`), run the reply grammar (§11.7), record `usage_events` key `sms_segments` for the inbound segments only if BILLING.md counts inbound (default: it does not).

### 11.5 Twilio status callbacks

Status only moves forward: `queued` < `sent` < `delivered`; `failed` and `undelivered` are terminal. Callbacks can arrive out of order, so a later status never overwrites a terminal one. `ErrorCode` `21610` (recipient opted out) disables the binding with `disabled_reason = 'stop'`. Repeated `30003`, `30005` or `30006` (unreachable, unknown, landline) disables it with `disabled_reason = 'undeliverable'` and emails the person.

### 11.6 Telegram

- Only `message` updates from chats with `type = 'private'` are handled. In a group, the bot calls `leaveChat`. `my_chat_member` with status `kicked` (the person blocked the bot) disables the binding with `disabled_reason = 'blocked'`.
- `/start <code>`: `<code>` matches `^[A-Za-z0-9_-]{32,64}$`; `tenant_for_link_code` must return channel `telegram`, unexpired, unused. The workflow creates `channel_bindings` (`channel = 'telegram'`, `address` = `chat.id` as a string, `verified_at = now()`), marks the code used, and replies "Connected. You'll get approvals and your morning digest here. Send /stop to disconnect." An invalid code gets "That link expired or was already used. Open Magpie, go to Settings, then Phone and chat, and choose Connect Telegram."
- `/stop`: disable the binding and reply that it is disconnected (FR-CH-2). `/help`: the grammar in short.
- Button presses (`callback_query`): `data` is `apr:<approval uuid>:a` (approve), `apr:<approval uuid>:s` (skip), `apr:<approval uuid>:e` (reply with a one-time edit link), as AGENT_RUNTIME §8.5 defines, or `mt:<match uuid>:p` (pursue) and `mt:<match uuid>:d` (dismiss) on digest matches; at most 42 bytes (limit 64). The chat must be the user's verified private chat. The workflow decides with `decided_via = 'telegram'`, calls `answerCallbackQuery` with a one-line result, then `editMessageReplyMarkup` to remove the buttons and `editMessageText` to append the outcome.
- Plain text goes through the reply grammar (§11.7).

### 11.7 Reply grammar (SMS and Telegram, FR-CH-4, FR-DIS-6)

Input is trimmed, inner whitespace collapsed, and matched case-insensitively. Rules are tried in order. The fixture table in `packages/core/channels/test/reply-grammar.fixtures.ts` must contain every row below plus the edge cases noted.

| Input | Pattern | Action | Reply |
|---|---|---|---|
| `1`, `Y1`, `Y 1` | `^Y?\s?([1-9]\d?)$` | Pursue match number N of the latest digest sent to this person on this channel within 7 days | "Pursuing <title>. Bid Reader is reading it now. <link>" |
| `N1`, `N 1` | `^N\s?([1-9]\d?)$` | Dismiss match N, reason `other`, note "Dismissed by text" | "Dismissed <title>." |
| `A7`, `Y A7`, `YA7` | `^(?:Y\s?)?(A\d{1,3})$` | Approve the pending approval with that `short_code` requested for this person | "Approved: <title>. <Bot name> is on it." |
| `X A7`, `XA7` | `^X\s?(A\d{1,3})$` | Skip it | "Skipped: <title>. <Bot name> won't do it." |
| `E A7`, `EA7` | `^E\s?(A\d{1,3})$` | Send the edit link | "Edit it here: <APP_URL>/approvals/<id>" |
| `A7 A8`, `A7, A8`, `Y A7 A8` | `^(?:Y\s?)?(A\d{1,3})(?:[\s,]+(A\d{1,3}))+$` | Approve each internal approval listed; external ones are not decided in a multi-code reply (they are never decided in bulk, FR-APR-3) | one combined reply, naming any external code to answer on its own |
| `X A7 A8` | `^X\s?(A\d{1,3})(?:[\s,]+(A\d{1,3}))+$` | Skip each listed approval | one combined reply |
| `?` | `^\?$` | List up to 10 pending approvals (code and title) and the undecided matches of the latest digest | the list, or "Nothing is waiting for you." |
| `/start <code>`, `/stop`, `/help` | Telegram only | §11.6 | |
| anything else | | Chat with the Assistant in this person's `sms` or `telegram` thread | the Assistant's reply |

- Digest match numbers come from the latest `notifications` row of kind `digest` for that user and channel: its `payload.items` holds `[{ n, matchId }]`. No other storage.
- Unknown number or code: "I can't find A9. Reply ? to see what's waiting." Expired: "A7 expired at 3:00 PM. Nothing was sent." Already decided: "A7 was already approved." Not allowed (viewer): "Your role can't approve this. Ask an admin."
- A phone number or Telegram chat bound in several workspaces: a code resolves in the workspace of the most recent notification that mentioned it on that channel; if two pending approvals still match, the reply lists both titles and asks for the workspace's initial plus the code (AGENT_RUNTIME §8.3 owns this rule). Digest numbers resolve against the most recent digest on that channel. Free text goes to the workspace that most recently sent this address a notification.
- Every decision writes `approvals.decided_via` (`sms` or `telegram`) and an `audit_log` row (FR-APR-5).

### 11.8 Postmark inbound email

The workflow, inside `withTenant`:
1. Insert `inbound_emails` (`reply_token`, sender, subject, bodies, headers).
2. Upload each attachment (base64) to R2 as a `files` row with `uploaded_by_type = 'inbound_email'`, queue its malware scan, record ids in `attachment_file_ids`.
3. Spam check: header `X-Spam-Status: Yes` or `X-Spam-Score` above 5 sets `routing_status = 'spam'` and stops.
4. Route by `record_type` from the resolver (v1 only `quote_request`): insert `messages` (`direction = 'in'`, `status = 'received'`, `channel = 'email'`, `quote_request_id`, `deal_id`, `company_id`, `thread_key = reply_token`, body from `StrippedTextReply` when present, else `TextBody`), set `inbound_emails.routed_message_id` and `routing_status = 'routed'`, set the quote request to `replied`, write an `email_in` activity linked to the deal and company, emit `message.received`.
5. Forward a copy to the bid owner's email through Postmark (transactional stream) within 1 minute of receipt (FR-SUB-3).
6. Start a Sub Finder run (trigger `event`) that parses amount, validity, scope notes and exclusions from the body and attachments into a `quotes` row with `is_confirmed = false` and citations in `parsed`, then sends a `quote_received` notification.

### 11.9 Postmark bounce and spam events

| `RecordType` | Work |
|---|---|
| `Bounce` with `Type` `HardBounce`, `BadEmailAddress`, `ManuallyDeactivated` or `Inactive = true` | `suppressions` reason `hard_bounce` (tenant from metadata), `messages.status = 'bounced'` with `error`, contact email `status = 'invalid'`, activity on the deal, notify the sender. |
| `Bounce`, other types | Record `error` on the message; no suppression. |
| `SpamComplaint` | `suppressions` reason `complaint`, `messages.status` unchanged, notify the sender and ops (complaints threaten the shared sending domain). |
| `Delivery` | `messages.status = 'delivered'`. |
| `SubscriptionChange` | Ignored: Magpie handles unsubscribes itself (§7). |

Bounces of transactional email to Magpie users (invites, digests) have no `messages` row; they mark the `notifications` row `failed` and alert ops.

## 12. Public API (`/api/v1`, v1)

### 12.1 Behaviour

- Authentication: `Authorization: Bearer mgp_<40 chars>`. The api takes the first 8 characters as the prefix, calls `tenant_for_api_key_prefix(prefix)`, compares SHA-256 of the presented key with `key_hash` in constant time, checks `revoked_at`, `expires_at` and that the user is still a member, then runs the request as that user (`actor_type = 'api_key'`, `actor_id` = key id in `audit_log`). `last_used_at` is updated at most once a minute.
- Scopes: `read` (GET), `write` (everything else). A missing scope returns `403 forbidden` with `detail` naming it. Calendar feed keys (scope `calendar:read` only) work on `/ics/*` and nowhere else.
- Same conventions as `/api/app` (§2), same schemas (from `packages/shared`), no `X-Workspace-Id` (the key fixes the workspace), no cookies, CORS open.
- Rate limit: 600 requests a minute per key (FR-API-1).
- Plan: a workspace on a plan without API access gets `403 feature_not_available` (BILLING.md decides which plans).
- Documentation: `GET /api/v1/openapi.json` and `<APP_URL>/docs/api`.

### 12.2 Resources

| Method | Path | Same as (`/api/app`) | Scope |
|---|---|---|---|
| GET | `/api/v1/me` | key info: `{ keyId, name, scopes, user: UserSummary, workspace: WorkspaceSummary }` | read |
| GET | `/api/v1/pipelines` | `/pipelines` | read |
| GET, POST | `/api/v1/companies` | `/companies` | read, write |
| GET, PATCH | `/api/v1/companies/:id` | `/companies/:id` | read, write |
| POST | `/api/v1/companies/:id/archive` | | write |
| GET, POST | `/api/v1/contacts` | `/contacts` | read, write |
| GET, PATCH | `/api/v1/contacts/:id` | `/contacts/:id` | read, write |
| POST | `/api/v1/contacts/:id/archive` | | write |
| GET, POST | `/api/v1/deals` | `/deals` (`source` is set to `api`) | read, write |
| GET, PATCH | `/api/v1/deals/:id` | `/deals/:id` | read, write |
| POST | `/api/v1/deals/:id/move`, `/api/v1/deals/:id/archive` | | write |
| GET, POST | `/api/v1/tasks` | `/tasks` | read, write |
| GET, PATCH, DELETE | `/api/v1/tasks/:id` | `/tasks/:id` | read, write |
| GET | `/api/v1/notes?recordType=&recordId=` | `/records/:recordType/:recordId/notes` | read |
| POST | `/api/v1/notes` | `{ recordType, recordId, body? , text? }`; `text` is converted to a TipTap paragraph | write |
| PATCH, DELETE | `/api/v1/notes/:id` | `/notes/:id` | write |
| GET | `/api/v1/matches`, `/api/v1/matches/:id` | `/matches` | read |
| POST | `/api/v1/matches/:id/pursue`, `/save`, `/dismiss` | `/matches/:id/...` | write |
| GET | `/api/v1/approvals`, `/api/v1/approvals/:id` | `/approvals` | read |
| POST | `/api/v1/approvals/:id/decide` | `/approvals/:id/decide`, `decided_via = 'api'` | write |
| GET | `/api/v1/runs`, `/api/v1/runs/:id`, `/api/v1/runs/:id/steps` | `/runs` (cost fields follow the key owner's role) | read |

### 12.3 Outgoing webhooks (FR-API-3)

| Aspect | Rule |
|---|---|
| Events offered | `company.created`, `company.updated`, `company.archived`, `contact.created`, `contact.updated`, `contact.archived`, `deal.created`, `deal.updated`, `deal.stage_changed`, `deal.archived`, `task.created`, `task.updated`, `note.created`, `match.created`, `approval.requested`, `approval.decided`, `run.finished`, `submission.created` |
| Body | `{ id: <domain_events.id>, type, createdAt, workspaceId, data }`; `data` is the resource as `GET /api/v1/...` returns it at delivery time, read with admin visibility |
| Headers | `Content-Type: application/json`, `Magpie-Webhook-Id: <delivery id>`, `Magpie-Event-Id`, `Magpie-Timestamp: <unix seconds>`, `Magpie-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>`; during a rotation two `v1=` values separated by a comma |
| Delivery | `webhook_deliveries` row per endpoint and event, sent by the outbox relay in `worker` on queue `messaging`; timeout 10 s; `2xx` is success; `410` disables the endpoint |
| Retries | after 1 min, 5 min, 30 min, 2 h, 6 h, 12 h and 24 h from the first attempt, then `failed` (FR-API-3: 24 hours) |
| Safety | HTTPS only; DNS resolved and private, loopback, link-local and metadata addresses refused at send time; no redirects followed |
| Visibility | deliveries listed and resendable in §5.26 |

## 13. MCP server (`/mcp`, v1)

### 13.1 Transport

| Aspect | Rule |
|---|---|
| Library | Official TypeScript SDK `@modelcontextprotocol/sdk` (1.32.x on 2026-11-10; pin it), mounted on Hono at `/mcp`. |
| Transport | Streamable HTTP, `POST /mcp` only, stateless (no `Mcp-Session-Id` minted). `GET` and `DELETE` return `405`. |
| Protocol versions | `2026-07-28` (current: per-request metadata, `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers that must match the body, else `400` with JSON-RPC `-32020`) and, for clients still on the initialize handshake, `2025-11-25` and `2025-06-18` in stateless mode. Verify the pinned SDK serves all three before shipping; drop a version rather than hand-roll it. |
| Origin | Requests with an `Origin` header not in `MCP_ALLOWED_ORIGINS` get `403`. Requests without `Origin` (server-side clients) pass. |
| Capabilities | `tools` only in v1. No resources, prompts, sampling or elicitation. |
| Limits | 600 requests a minute per grant; tool results capped at 50 KB of JSON (lists truncate with `truncated: true`). |

### 13.2 OAuth

The api is both the protected resource and, through Better Auth's `mcp()` plugin with `cimd()`, the authorization server.

1. A request without a valid token gets `401` with `WWW-Authenticate: Bearer resource_metadata="<APP_URL>/.well-known/oauth-protected-resource/mcp", scope="magpie:read"`.
2. Protected resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-protected-resource`: `{ resource: "<APP_URL>/mcp", authorization_servers: ["<issuer>"], scopes_supported: ["magpie:read", "magpie:write"], bearer_methods_supported: ["header"], resource_name: "Magpie" }`.
3. Authorization server metadata (RFC 8414) from Better Auth. The issuer is Better Auth's base URL; serve its metadata at the path the issuer requires (for issuer `<APP_URL>/api/auth`, that is `/.well-known/oauth-authorization-server/api/auth`) and set `authorization_response_iss_parameter_supported: true`. Verify the exact issuer and paths with the pinned plugin.
4. Client registration: Client ID Metadata Documents first (`cimd()`, metadata profile for `mcp-2026-07-28`), then Dynamic Client Registration for clients that lack CIMD (`allowDynamicClientRegistration: true`, unauthenticated registration rate-limited to 10 an hour per IP). DCR is deprecated in the current MCP spec; keep it until the main clients use CIMD.
5. Authorization code with PKCE (`S256` only) and the `resource` parameter equal to `<APP_URL>/mcp`. The person signs in with Better Auth, then sees the consent page at `<APP_URL>/oauth/consent`: client name and host, scopes in plain words, and a workspace picker. `magpie:write` is offered only for workspaces where the person is `member` or higher.
6. Tokens: JWT access tokens signed with Better Auth's JWKS, audience `<APP_URL>/mcp`, lifetime 1 hour, carrying `sub` (user), `tenant` (workspace chosen at consent, stored on the grant, §15) and `scope`. Refresh tokens rotate, 30-day lifetime. The resource server validates signature, issuer, audience, expiry and scope with `requireMcpAuth` from `@better-auth/mcp`, then checks the membership still exists.
7. A tool call that needs `magpie:write` with a read-only token gets HTTP `403` with `WWW-Authenticate: Bearer error="insufficient_scope", scope="magpie:write", resource_metadata="..."` (the `Mcp-Name` header names the tool before the body is parsed).
8. People see and revoke grants in Settings: `GET /api/app/oauth-grants` (`{ data: OAuthGrant[] }`: client name, scopes, workspace, created, last used) and `DELETE /api/app/oauth-grants/:id` (revokes refresh and access tokens). Role: viewer, own grants only.

### 13.3 Tools

Tool inputs are zod schemas exported from `packages/shared/src/schemas/mcp.ts` and converted to JSON Schema for `tools/list`. Every result has `structuredContent` (JSON) plus one `text` content item summarizing it. Records include `url` (`<APP_URL>/...`) so the AI client can link the person to Magpie.

| Tool | Description given to the AI client | Input (zod) | Scope | Effect |
|---|---|---|---|---|
| `search_records` | "Search the workspace's companies, contacts, bids and deals, and matches by name, email, domain or solicitation number. Returns ids to use with get_record." | `z.object({ query: z.string().min(1).max(200), types: z.array(z.enum(['company','contact','deal','opportunity_match'])).optional(), limit: z.number().int().min(1).max(25).default(10) })` | read | read-only |
| `get_record` | "Read one record with its key fields. Optionally include its recent timeline, open tasks, notes, and for bids the requirements and deadlines." | `z.object({ recordType: z.enum(['company','contact','deal','task','opportunity_match']), recordId: z.string().uuid(), include: z.array(z.enum(['timeline','tasks','notes','requirements','deadlines'])).default([]) })` | read | read-only |
| `list_bids_due` | "List open bids with a proposal due date in the next N days, soonest first, with their other deadlines." | `z.object({ withinDays: z.number().int().min(1).max(90).default(14), includeSubmitted: z.boolean().default(false), limit: z.number().int().min(1).max(50).default(25) })` | read | read-only |
| `list_matches` | "List new or saved bid matches from the workspace's saved searches, highest score first, with the reasons for each score." | `z.object({ status: z.array(z.enum(['new','shown','saved'])).default(['new','shown']), minScore: z.number().int().min(0).max(100).default(50), limit: z.number().int().min(1).max(50).default(20) })` | read | read-only |
| `create_task` | "Create a task, optionally linked to a record and assigned to a person. May need the person's approval in Magpie first." | `z.object({ title: z.string().min(1).max(200), notes: z.string().max(5000).optional(), dueAt: z.string().datetime({ offset: true }).optional(), priority: z.enum(['low','normal','high']).default('normal'), assigneeUserId: z.string().uuid().optional(), recordType: z.enum(['company','contact','deal']).optional(), recordId: z.string().uuid().optional() })` | write | internal |
| `add_note` | "Add a plain-text note to a company, contact or deal. May need the person's approval in Magpie first." | `z.object({ recordType: z.enum(['company','contact','deal']), recordId: z.string().uuid(), text: z.string().min(1).max(20000) })` | write | internal |
| `create_draft` | "Create a draft document (for example a cover letter or technical approach) on a bid, from Markdown. Refused on bids whose solicitation bans AI. May need approval first." | `z.object({ dealId: z.string().uuid().optional(), kind: z.enum(['proposal','technical_approach','past_performance_volume','capability_statement','cover_letter','quote_letter','email','other']), title: z.string().min(1).max(200), contentMarkdown: z.string().min(1).max(200000) })` | write | internal |

Annotations: read tools `readOnlyHint: true`; write tools `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`. No MCP tool sends anything outside the workspace.

### 13.4 Mapping to Bot tools, writes and approvals

Each MCP tool runs a Bot tool from AGENT_RUNTIME §3.3 as the token's user, through the same gate and guards (AGENT_RUNTIME §4.5, §3.13). Tool keys come from that catalog; if they change there, this table follows.

| MCP tool | Bot tool key | Effect |
|---|---|---|
| `search_records` | `crm.search` | read |
| `get_record` | `crm.get_record` | read |
| `list_bids_due` | `crm.list_records` (deals of kind `bid` in `open` stages, `dueAt` within the window) plus `bids.list_deadlines` | read |
| `list_matches` | `matching.list_matches` | read |
| `create_task` | `crm.create_task` | internal |
| `add_note` | `crm.add_note` | internal |
| `create_draft` | `drafts.create` | internal |

MCP writes follow the same approval rules as Bot tools (FR-API-2):
- Each write call is an `agent_runs` row of the workspace's `assistant` Bot with `trigger = 'api'`, `trigger_ref` = the MCP grant id, `acting_user_id` = the token's user, and `workflow_id = run:<tenant_id>:api:<user_id>:<uuid>` (AGENT_RUNTIME §4.2). The run executes the one tool call without a model turn, so it does not count toward `ai_runs` (BILLING.md). AGENT_RUNTIME.md owns how a direct tool call runs.
- The effective policy is the `assistant` Bot's policy for the Bot tool key (AGENT_RUNTIME §3.2). `always_allow` executes and returns `{ status: 'created', recordType, recordId, url }`. `needs_approval` creates an `approvals` row requested for the token's user and returns `{ status: 'pending_approval', approvalId, shortCode, url, expiresAt }`; the person decides in Magpie, by SMS or by Telegram, and the run finishes the call then. `off` returns a tool error.
- `create_draft` on a bid with AI drafting off returns the tool error `ai_drafting_not_allowed`. A created draft has `is_ai_generated = true` and an `ai_disclosure` entry naming the MCP client.
- Tool errors return `isError: true` with text `<code>: <detail>` using AGENT_RUNTIME §3.1's error codes (for example `not_found: No deal with that id in this workspace.`). Protocol and auth failures use JSON-RPC errors and HTTP status as above.

## 14. Requirement coverage

| Requirement | Where |
|---|---|
| FR-ACC-1 | §4 sign-up hook; §5.1 `POST /workspaces` |
| FR-ACC-2 | §5.1 invitations |
| FR-ACC-3 | §1 `X-Workspace-Id`; §5.1 `/me`, `/workspaces`, activate |
| FR-ACC-4 | §2.10; Role column of §5; §5.1 members |
| FR-ACC-5 | §5.1 ownership transfer, exports, deletion |
| FR-ACC-6 | §2.10 sessions; §4 revoke sessions |
| FR-PRO-1 to FR-PRO-6 | §5.3; §5.4; §5.6 preview and `runFirstScan` |
| FR-DIS-1 to FR-DIS-5 | §5.5, §5.6, §5.7 |
| FR-DIS-6 | §11.7 |
| FR-DIS-7 | §5.9 documents sync; §9 `bid.amendment_ready` |
| FR-BID-1 to FR-BID-9 | §5.9; §5.12 exports; §5.16 timeline; §5.24 and §7 ICS |
| FR-PRC-1 to FR-PRC-5 | §5.10 |
| FR-SUB-1 to FR-SUB-6 | §5.11; §7 unsubscribe and shared files; §11.8; §11.9; §5.13 do-not-contact |
| FR-DRF-1 to FR-DRF-4 | §5.12 |
| FR-CRM-1 to FR-CRM-10 | §5.8, §5.13 to §5.16 |
| FR-BOT-1 to FR-BOT-9 | §5.18; §2.10 Bots; `limit_reached` |
| FR-APR-1 to FR-APR-5 | §5.20; §11.6; §11.7; §12.2 |
| FR-CH-1, FR-CH-2, FR-CH-8 | §5.21; §11.4 to §11.6 |
| FR-CH-3, FR-CH-5 | §5.1 preferences; §5.2 settings |
| FR-CH-4 | §11.7 |
| FR-CH-6, FR-CH-7 | §5.19; §10; §5.18 `POST /bots/:id/runs` |
| FR-BIL-1 to FR-BIL-7 | §5.23; §11.3; `payment_required`, `limit_reached`; §9 `usage.threshold_reached` |
| FR-SET-1 to FR-SET-4 | §5.2; §5.22; §5.1 and §5.24; §5.25 |
| FR-OPS-1 to FR-OPS-6 | §6 |
| FR-API-1 | §12.1, §12.2 |
| FR-API-2 | §13 |
| FR-API-3 | §5.26; §12.3 |
| FR-AUT-1 | §5.27; §11.2 automation webhook |
| FR-REP-1 | §5.28 |

## 15. Schema additions requested

DATA_MODEL.md is not edited by this spec. The endpoints above depend on the additions below. Each needs a DATA_MODEL change before the module that uses it is built.

**Already requested in UX.md and used here (not repeated):** table `short_links` and resolver `short_link_target` (§5.21). UX.md also requests `notification_preferences` and `calendar_feeds`; this spec uses `memberships.notification_prefs` (AGENT_RUNTIME) and `api_keys` (item 7 below) instead, so one of each pair should be dropped when DATA_MODEL is updated.

**Already requested in AGENT_RUNTIME.md §15 and used here (not repeated):** table `bid_briefs` (item 1, API §5.9), `drafts.coverage` (item 2, §5.12), `approvals.decision_note` (item 3, §5.20, §6.3), `approvals.staff_reviewed_by` and `staff_reviewed_at` (item 4, §6.3), `memberships.notification_prefs` (item 5, §5.1), the `deals.bid_decision` recommendation fields (item 7, §5.9), and table `staff_assignments` (item 9, SECURITY §20, §6.2).

**New columns**

1. `channel_bindings.disabled_reason text check (disabled_reason in ('user','stop','blocked','undeliverable'))`, null while enabled. Lets `START` re-enable only bindings that `STOP` disabled (§11.4 to §11.6).

**New tables**

2. `idempotency_keys` (tenant table, standard RLS; rows deleted by the `cleanup` schedule after `expires_at`):

```sql
create table idempotency_keys (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  actor_key text not null,                 -- 'user:<uuid>' or 'api_key:<uuid>'
  key text not null,
  method text not null,
  path text not null,
  request_hash text not null,              -- hex sha256 of the raw body
  status text not null default 'running' check (status in ('running','done')),
  response_status int,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,         -- created_at + 24 hours
  primary key (tenant_id, actor_key, key)
);
create index on idempotency_keys (tenant_id, expires_at);
```

Routes that run without a workspace (`POST /workspaces`) do not store keys.

3. `rate_limits` (global, no tenant policy; keys contain tenant, user, key or IP identifiers but no customer data; `select, insert, update, delete` granted to `magpie_app` and `magpie_auth`; add to DATA_MODEL §2.1). Shaped as Better Auth's `rateLimit` model so Better Auth and Magpie's buckets share it (verify Better Auth's field names for the pinned version):

```sql
create table rate_limits (
  key text primary key,                    -- e.g. 'app:<session id>', 'v1:<api key id>', 'auth:<ip>'
  count int not null,
  last_request bigint not null             -- epoch milliseconds
);
```

4. MCP OAuth tables (v1): the tables Better Auth's `mcp()` and OAuth provider plugins require (clients, consents, access tokens, refresh tokens, JWKS), generated from the pinned plugin's schema and mapped to snake_case (`oauth_clients`, `oauth_consents`, `oauth_access_tokens`, `oauth_refresh_tokens`, `jwks`). Add `tenant_id uuid not null references tenants(id) on delete cascade` to `oauth_consents`, `oauth_access_tokens` and `oauth_refresh_tokens` so each grant is bound to the workspace chosen at consent. Owned by Better Auth and listed in DATA_MODEL §2.1 with the other identity tables (`magpie_auth` pool).

**New enumeration values**

5. `file_links.purpose`: add `'export'` (bid packages and draft DOCX and PDF exports, §5.9, §5.12).
6. Polymorphic `record_type` for `field_provenance` only: add `'company_profile'` (with `record_id` = the tenant id) so profile fields carry provenance `sam` (FR-PRO-2).
7. `api_keys.scopes`: document the allowed values and add `check (scopes <@ array['read','write','calendar:read'])`. A `calendar:read` key is the ICS feed token (§5.24, §7).

**Clarifications to existing comments (no DDL)**

8. `link_codes` with `channel = 'sms'`: `code` holds a random 32-character challenge id returned to the browser; the 6-digit code is generated and checked by Twilio Verify (INTEGRATIONS §12). `attempts` counts verify calls, maximum 5.
9. `drafts.parent_draft_id`: for versions 2 and up it points at the version-1 row (the document id), not the previous version (§5.12).
10. `price_lines.unit = 'percent'` marks overhead and profit lines whose `quantity` is a percentage (§5.10).
11. `tenant_settings.settings` keys: `postalAddress`, `marginFloorBps`, `quoteFollowups`, `pricingDefaults`, `onboarding`. `bot_jobs.config.learningMode`. Each gets a zod schema in `packages/shared`.
12. `opportunity_matches.dismiss_reason` stores one of the codes in §5.7; free-text notes go to `notes`.
13. `notifications.payload` for `kind = 'digest'` includes `items: [{ n, matchId }]`, which the reply grammar reads (§11.7).
14. `quote_requests.reply_token`: 32 random bytes, RFC 4648 base32 lowercase without padding (52 characters), as AGENT_RUNTIME's `quotes.draft_request` creates it; the tracked addresses `q-<token>` and `u-<token>` are 54 characters, inside the 64-character local-part limit.
15. DATA_MODEL §17 seed: the Stripe customer must exist before the seed transaction, because `subscriptions.stripe_customer_id` is `not null`. Create it in the sign-up hook with idempotency key `customer:<tenant_id>`, then run the transaction.

**To verify against the pinned Better Auth version**

16. Better Auth's `admin` plugin (used for impersonation, §6.2) expects user fields `role`, `banned`, `banReason` and `banExpires`, which `users` lacks. Either map `role` to `users.staff_role` and add `banned boolean not null default false`, `ban_reason text`, `ban_expires timestamptz` to `users`, or use the plugin options that limit it to impersonation without those fields. Record the choice with the DATA_MODEL change.
