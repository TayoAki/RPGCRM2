# Magpie: billing, plans and limits

**Status:** ready to build. **Owner:** founder. **Last updated:** 2026-11-10.

Plans, entitlements, Stripe, the subscription state machine, metering and limits, trial abuse controls, cancellations and refunds, and per-workspace cost and margin reporting. Names come from [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md) (`plans`, `subscriptions`, `entitlements`, `billing_events`, `usage_events`, `usage_counters`; modules `billing` and `usage`); if this file disagrees with them, they win. Prices and allowances come from PRD §8 and are data in `plans`, changeable without a deploy (ARCHITECTURE §14, decision 8). Problem codes are in [API.md](API.md) §2.9. Data model changes this file needs are in §11. Anything marked **verify** must be checked against Stripe's current documentation before code is written.

## 1. Principles

1. Month-to-month, per workspace, cancel in the app, export everything (PRD §4, principle 6).
2. `plans` holds prices and allowances. `entitlements` holds each workspace's effective limits. `usage_counters` holds what was used. Code never hard-codes a plan's numbers.
3. Stripe is the system of record for money (subscriptions, invoices, tax, refunds). Magpie mirrors what it needs through webhooks within 1 minute (FR-BIL-2).
4. Limits protect margin without locking people out mid-task: chat and approvals keep working at 120% of runs (FR-BIL-4). Only the hard AI cost ceiling stops everything, and it is set well above normal use.
5. Every model call and every paid vendor call writes a `usage_events` row with its cost, so per-workspace margin is always known (PRD §7, Attio-style attribution of every call to workspace, feature and run).

## 2. Plan catalog

Seed for the `plans` table (`pnpm db:seed`, BUILD_PLAN M6). `stripe_price_id` is null in the seed; `pnpm billing:sync-stripe` fills it per environment (§4.1). Money is in cents, AI cost in micros (millionths of a dollar), storage in bytes (1 GiB = 1,073,741,824).

```json
[
  {
    "key": "trial",
    "name": "Trial",
    "price_cents": 0,
    "billing_interval": "month",
    "pricing_model": "flat",
    "stripe_price_id": null,
    "included": {
      "users": 3, "ai_runs": 150, "ai_cost_micros": 25000000, "doc_pages": 300, "saved_searches": 2,
      "sms_segments": 100, "emails_sent": 25, "storage_bytes": 1073741824, "bot_jobs": 2,
      "api_requests_per_day": 0, "managed_review": 0, "max_steps_per_run": 20, "max_cost_micros_per_run": 750000
    },
    "features": { "trialDays": 14, "prioritySupport": false },
    "is_public": true,
    "position": 0
  },
  {
    "key": "bid_desk",
    "name": "Bid Desk",
    "price_cents": 14900,
    "billing_interval": "month",
    "pricing_model": "flat",
    "stripe_price_id": null,
    "included": {
      "users": 3, "ai_runs": 600, "ai_cost_micros": 100000000, "doc_pages": 1500, "saved_searches": 5,
      "sms_segments": 300, "emails_sent": 500, "storage_bytes": 10737418240, "bot_jobs": 5,
      "api_requests_per_day": 10000, "managed_review": 0, "max_steps_per_run": 25, "max_cost_micros_per_run": 1000000
    },
    "features": { "prioritySupport": false },
    "is_public": true,
    "position": 1
  },
  {
    "key": "bid_desk_pro",
    "name": "Bid Desk Pro",
    "price_cents": 39900,
    "billing_interval": "month",
    "pricing_model": "flat",
    "stripe_price_id": null,
    "included": {
      "users": 10, "ai_runs": 2000, "ai_cost_micros": 300000000, "doc_pages": 6000, "saved_searches": 25,
      "sms_segments": 1000, "emails_sent": 2000, "storage_bytes": 53687091200, "bot_jobs": 15,
      "api_requests_per_day": 50000, "managed_review": 0, "max_steps_per_run": 40, "max_cost_micros_per_run": 2000000
    },
    "features": { "prioritySupport": true },
    "is_public": true,
    "position": 2
  },
  {
    "key": "managed",
    "name": "Managed",
    "price_cents": 99900,
    "billing_interval": "month",
    "pricing_model": "flat",
    "stripe_price_id": null,
    "included": {
      "users": 10, "ai_runs": 4000, "ai_cost_micros": 600000000, "doc_pages": 10000, "saved_searches": 50,
      "sms_segments": 2000, "emails_sent": 4000, "storage_bytes": 107374182400, "bot_jobs": 25,
      "api_requests_per_day": 100000, "managed_review": 1, "max_steps_per_run": 40, "max_cost_micros_per_run": 3000000
    },
    "features": { "prioritySupport": true, "managedReview": true },
    "is_public": true,
    "position": 3
  },
  {
    "key": "team",
    "name": "Team",
    "price_cents": 9900,
    "billing_interval": "month",
    "pricing_model": "per_seat",
    "stripe_price_id": null,
    "included": {
      "users": { "perSeat": 1 }, "ai_runs": { "perSeat": 400 }, "ai_cost_micros": { "perSeat": 60000000 },
      "doc_pages": { "perSeat": 1000 }, "saved_searches": 10, "sms_segments": { "perSeat": 200 },
      "emails_sent": { "perSeat": 300 }, "storage_bytes": { "perSeat": 5368709120 }, "bot_jobs": 10,
      "api_requests_per_day": 20000, "managed_review": 0, "max_steps_per_run": 40, "max_cost_micros_per_run": 2000000
    },
    "features": { "release": "v1.5", "minSeats": 1, "maxSeats": 25, "sso": false },
    "is_public": false,
    "position": 4
  },
  {
    "key": "run_pack",
    "name": "Run pack",
    "price_cents": 15000,
    "billing_interval": "one_time",
    "pricing_model": "flat",
    "stripe_price_id": null,
    "included": { "ai_runs": 1000, "doc_pages": 2500, "ai_cost_micros": 125000000 },
    "features": { "maxQuantityPerPurchase": 5, "requiresPaidPlan": true, "carryOver": "one_period" },
    "is_public": true,
    "position": 10
  }
]
```

Notes:
- `included` is validated by a zod schema in `packages/shared`: each value is an integer, `null` for unlimited, or `{ "perSeat": integer }` for `per_seat` plans.
- `features` is for display and plan-level switches; enforcement reads `entitlements` only. `managedReview` in `features` mirrors the `managed_review` entitlement for the pricing page.
- `trial.billing_interval` is required by the column but unused; the trial length is `features.trialDays`.
- `run_pack` is a one-time product, not a subscription plan. `billing_interval = 'one_time'` needs the schema change in §11. `subscriptions.plan_key` must never be `run_pack` or `trial` after a paid checkout (checked in core).
- `team` is hidden (`is_public: false`) until v1.5 (PRD §5).
- `business` (named in DATA_MODEL's comment) is not seeded in v1.
- `ai_cost_micros` is a hard ceiling, not an allowance to sell. It sits at 1.25 to 1.4 times the cost of using 120% of the plan's runs at $0.10 a run (COGS.md), so normal use never reaches it. Recheck it after a week of pilot metering (COGS.md §5).

## 3. Entitlements

### 3.1 Keys

| Key | Unit | Kind | `reset_period` | Counter key in `usage_counters` | Checked when | Meaning |
|---|---|---|---|---|---|---|
| `users` | people | count | `none` | none; counts memberships with role `owner`, `admin` or `member` plus pending invitations for those roles | inviting, changing a viewer's role, accepting an invitation | Seats for people who can write. Viewers are free and do not count, up to 25 per workspace. |
| `ai_runs` | runs | counter | `month` | `ai_runs` | a run's first model call | AI runs per billing period (PRD §8). 120% rule (§6.4). |
| `ai_cost_micros` | micros | counter | `month` | `ai_cost`, plus `ai_cost_reserved` | before each model call and each paid vendor call | Hard ceiling on per-call variable cost per period: model calls, paid Kontract calls (`websites/read`, `subcontractors`) and email verifications on Magpie's MillionVerifier key (INTEGRATIONS §3, §19). At 100% all of them stop. |
| `doc_pages` | pages | counter | `month` | `doc_pages` | when a bid document's text becomes ready | Document pages read (§6.1). 120% rule. |
| `saved_searches` | searches | count | `none` | none; counts `opportunity_searches` with `is_active` | creating or activating a search | Active saved searches that are scanned. |
| `sms_segments` | segments | counter | `month` | `sms_segments` | before each SMS | SMS segments sent to the workspace's users. |
| `emails_sent` | emails | counter | `month` | `emails_sent` | before each outreach email sent through Magpie's domain | Outreach recipients through Postmark. Sends from a connected Gmail or Outlook are not counted. |
| `storage_bytes` | bytes | gauge | `none` | `storage_bytes` (period `1970-01-01`) | presigning an upload | Total size of the workspace's files. |
| `bot_jobs` | jobs | count | `none` | none; counts enabled `bot_jobs` of kind `custom` | creating or enabling a custom job | Custom Bot jobs. Seeded jobs do not count. |
| `api_requests_per_day` | requests | counter | `day` | `api_requests` (period is the UTC date) | each `/api/v1` and `/mcp` request | Daily API quota on top of the per-key rate limit (FR-API-1). `0` means no API access (`feature_not_available`). |
| `managed_review` | flag (0 or 1) | flag | `none` | none | creating an external approval | 1 sends external approvals to a Magpie reviewer first (FR-OPS-5). |
| `max_steps_per_run` | steps | per run | `none` | none | the gate (AGENT_RUNTIME §4.8) | Step cap per run (FR-BOT-9). |
| `max_cost_micros_per_run` | micros | per run | `none` | none | before each model call | Cost cap per run (FR-BOT-9). |

Counter keys without an entitlement: `ai_cost_reserved` (reservations, §6.3). `usage_events` keys used only for cost: `kontract_calls`, `enrichment_lookups` (cost 0 with a workspace's own key), `payment_fees` (§9). The cost of `kontract_calls` and platform-key `enrichment_lookups` events is also added to the `ai_cost` counter, so one ceiling bounds all per-call variable cost; their `usage_events` rows keep their own keys for reporting. `api_requests` is counted only in `usage_counters`, never in `usage_events`, because it has no cost and would add a row per API call.

### 3.2 Values per plan

Generated from §2; repeated here for reading.

| Key | Trial | Bid Desk | Bid Desk Pro | Managed | Team (per seat unless noted) | Run pack adds |
|---|---|---|---|---|---|---|
| `users` | 3 | 3 | 10 | 10 | 1 | |
| `ai_runs` | 150 | 600 | 2,000 | 4,000 | 400 | 1,000 |
| `ai_cost_micros` | $25 | $100 | $300 | $600 | $60 | $125 |
| `doc_pages` | 300 | 1,500 | 6,000 | 10,000 | 1,000 | 2,500 |
| `saved_searches` | 2 | 5 | 25 | 50 | 10 (flat) | |
| `sms_segments` | 100 | 300 | 1,000 | 2,000 | 200 | |
| `emails_sent` | 25 | 500 | 2,000 | 4,000 | 300 | |
| `storage_bytes` | 1 GiB | 10 GiB | 50 GiB | 100 GiB | 5 GiB | |
| `bot_jobs` | 2 | 5 | 15 | 25 | 10 (flat) | |
| `api_requests_per_day` | 0 | 10,000 | 50,000 | 100,000 | 20,000 (flat) | |
| `managed_review` | 0 | 0 | 0 | 1 | 0 | |
| `max_steps_per_run` | 20 | 25 | 40 | 40 | 40 | |
| `max_cost_micros_per_run` | $0.75 | $1.00 | $2.00 | $3.00 | $2.00 | |

### 3.3 How plans, add-ons, grants and overrides combine

`entitlements` holds one effective row per key (primary key `(tenant_id, key)`). `billing.recomputeEntitlements(tx, tenantId)` rebuilds every row from four inputs:

| Input | Where | Example |
|---|---|---|
| Plan | `plans.included` for `subscriptions.plan_key`; per-seat values times `subscriptions.seats` | Bid Desk: `ai_runs` 600 |
| Recurring add-ons | `subscriptions.addons` (`[{key, quantity, stripeItemId}]`); none sold in v1 | later: extra SMS |
| One-time grants | `credit_grants` rows for the current usage period, not revoked (§11) | a run pack: `ai_runs` +1,000 |
| Overrides | `entitlement_overrides` rows, not expired (§11) | ops sets `saved_searches` to 40 for a pilot |

```
base(key)      = override(key) ?? plan(key) × (perSeat ? seats : 1)
effective(key) = base(key) is null ? null : base(key) + Σ addons(key) + Σ grants(key, current period)
source         = override exists ? 'override' : (addons or grants contribute ? 'addon' : 'plan')
```

- Overrides replace the plan value; grants and add-ons still add on top.
- Grants apply only to counter keys with `reset_period = 'month'`.
- `reset_period` comes from §3.1.
- Recompute runs in the same transaction as:
  - a subscription or seat change;
  - a grant inserted or revoked;
  - an override set, cleared or expired (the daily `trial-lifecycle` schedule expires them);
  - a period rollover (§6.8).
- Every recompute writes an `audit_log` row `entitlements.recompute` with the changed keys.
- Lowering a limit never deletes data. Above a lowered count limit (`users`, `saved_searches`, `bot_jobs`), creation is refused until the workspace is under the limit; existing items keep working, except that only the first N saved searches by `created_at` are scanned and the rest show "Paused by plan".

## 4. Stripe

### 4.1 Objects and mapping

| Stripe object | Magpie | Metadata | Notes |
|---|---|---|---|
| Customer | One per workspace, created in the sign-up hook before the seed transaction, because `subscriptions.stripe_customer_id` is `not null` (API.md §15 item 15) | `tenant_id` | Idempotency key `customer:<tenant_id>`. Email is the owner's, name is `tenants.name`. If Stripe is unreachable, sign-up fails with `external_unavailable` and can be retried; the idempotency key prevents duplicates. |
| Product | One per plan key: `bid_desk`, `bid_desk_pro`, `managed`, `team`, `run_pack` | `plan_key` | Tax code for business SaaS (**verify**, likely `txcd_10103001`). |
| Price | Monthly recurring USD for subscription plans (per unit for `team`), one-time for `run_pack` | `plan_key`, `catalog_version` | `lookup_key` `magpie_<plan_key>_v<n>`; `tax_behavior: exclusive`. Its id goes into `plans.stripe_price_id` for that environment. |
| Subscription | One per workspace at most | `tenant_id`, `plan_key` | `subscriptions.stripe_subscription_id`. |
| Checkout Session | One per purchase | `tenant_id`, `kind` (`subscription` or `run_pack`), `plan_key` or `quantity`, `requested_by` | `client_reference_id = tenant_id`. |
| Invoice | Created by Stripe | | Not copied into Magpie; read through the API for the billing page. |

- `pnpm billing:sync-stripe` reads `plans`, finds or creates each Product and Price by `lookup_key` in the current Stripe mode, and writes `plans.stripe_price_id`.
- Price changes create a new Price (`_v<n+1>`) and update `plans`. Existing subscribers stay on their price until an announced migration with 30 days' notice.
- **API version.** Pin `STRIPE_API_VERSION` to the version current at integration, `2025-03-31.basil` or later. From basil on, a subscription's `current_period_start` and `current_period_end` are on its items (`items.data[0]`), not on the subscription. Magpie's subscriptions have one item, so `subscriptions.current_period_*` come from that item.

### 4.2 Checkout

**Subscription** (first purchase, or coming back after a cancellation):
1. An owner or admin picks a plan on the billing page. `POST /api/app/billing/checkout-session { planKey, successPath, cancelPath }` (API.md §5.23) with an `Idempotency-Key`.
2. The api checks:
   - the person has `billing.manage` and a verified email;
   - the workspace has no live Stripe subscription (otherwise `409 conflict`; plan changes go through the Portal, §4.3);
   - the plan is public and purchasable.
3. Use the workspace's Customer (created at sign-up, §4.1).
4. Create the Checkout Session:
   - `mode: "subscription"`, `customer`, `line_items: [{ price, quantity: 1 }]` (seats for `team`);
   - `client_reference_id`, `metadata`, `subscription_data.metadata: { tenant_id, plan_key }`;
   - unused trial days carry over (API.md §5.23): while `tenants.trial_ends_at` is in the future, set `subscription_data.trial_end` to it, so the first charge happens when the trial would have ended (**verify** Stripe's minimum lead time for `trial_end`; if the trial ends sooner than that, omit it and charge now). Checkout still collects the card;
   - `automatic_tax: { enabled: true }`, `customer_update: { address: "auto", name: "auto" }`, `billing_address_collection: "required"`, `tax_id_collection: { enabled: true }`;
   - `allow_promotion_codes: true` for pilot codes;
   - `success_url` and `cancel_url` built from `APP_URL` and the request's paths; the success URL carries `session_id={CHECKOUT_SESSION_ID}`.
5. The browser goes to Stripe. On return, the page shows "Finishing setup" until `subscription.updated` arrives over SSE, or polls `GET /api/app/billing` for up to 60 seconds.
6. The `checkout.session.completed` webhook does the work (§4.4); the success page never activates anything itself.

**Run pack** (§6.6, `POST /api/app/billing/run-packs/checkout-session`): the same steps with `mode: "payment"`, the `run_pack` price, `quantity` 1 to 5, `invoice_creation: { enabled: true }` so a paid invoice and receipt exist, `automatic_tax`, and `metadata` and `payment_intent_data.metadata` of `{ tenant_id, kind: "run_pack", quantity, period_start }`.

Payment methods: cards only in v1, so failures and retries follow one path. Bank debits can come later.

### 4.3 Customer Portal

One portal configuration per Stripe mode, id in `STRIPE_PORTAL_CONFIGURATION_ID`. `POST /api/app/billing/portal-session` creates a session with `return_url` `<APP_URL>/settings/billing`; a "Change plan" button uses the portal's subscription update deep link (**verify** `flow_data` options).

| Portal feature | Setting |
|---|---|
| `customer_update` | on: email, address, tax id, name |
| `payment_method_update` | on |
| `invoice_history` | on |
| `subscription_update` | on; prices of `bid_desk`, `bid_desk_pro`, `managed` (and seat quantity for `team` in v1.5); upgrades prorated and invoiced at once (`proration_behavior: always_invoice`); downgrades scheduled at period end (**verify** the portal's schedule-at-period-end setting) |
| `subscription_cancel` | off. Cancellation is in the app (§8.1), so there is one flow with one confirmation screen (FR-BIL-7). |
| Retention offers | none |

Upgrading to Managed notifies ops to assign a reviewer (`staff_assignments`, SECURITY §20). Until one is assigned, staff-stage approvals go to the unassigned queue that staff admins see.

### 4.4 Webhooks handled

`POST /webhooks/stripe` verifies the signature on the raw body (SECURITY §12), then in one ops-pool transaction inserts `billing_events (stripe_event_id, type, tenant_id, payload)` with `on conflict do nothing`. The tenant comes from `tenant_for_stripe_customer`, else `metadata.tenant_id`. It answers 200 and enqueues `billingEventWorkflow` on the `sync` queue (partition tenant) with workflow id `stripe:<event id>`. The workflow re-fetches the current object from Stripe, because events can arrive out of order, applies it inside `withTenant`, and sets `billing_events.processed_at`, or `error` after retries.

| Event | Action |
|---|---|
| `checkout.session.completed` (`mode: subscription`) | Retrieve the subscription. Set `stripe_subscription_id`, `plan_key` (matching the price to `plans.stripe_price_id`), `status` (`trialing` while carried-over trial days remain), `seats`, periods (from the item), `cancel_at`, `trial_end`. Set `tenants.status = 'active'`, `plan_key`, clear `status_reason`; delete any `tenant_deletions` row. Recompute entitlements. Start a new usage period (§6.8). Notify owners and admins. |
| `checkout.session.completed` (`mode: payment`, `payment_status: paid`) | Run pack: insert `credit_grants` (unique on the session id), recompute, notify (§6.6). If `payment_status` is not `paid`, wait for the async event. |
| `checkout.session.async_payment_succeeded` / `failed` | Same as above on success; notify the buyer on failure. Not expected with cards only. |
| `customer.subscription.created`, `customer.subscription.updated` | Sync `subscriptions` (status, plan, seats, periods, `cancel_at`). Recompute on plan or seat change. A new period triggers the rollover (§6.8). `cancel_at_period_end` shows the end-date banner. Status changes drive §5. |
| `customer.subscription.deleted` | `subscriptions.status = 'canceled'`. Tenant goes to `canceled` with `status_reason` `payment_failed` if it was past due, else `owner_canceled` (§5). Schedule deletion. |
| `invoice.paid` | If the subscription is now `active`: clear `tenants.past_due_since`, set `active`, resume paused jobs. Record revenue and the Stripe fee for margin reporting (§9). |
| `invoice.payment_failed` | Set `tenants.status = 'past_due'` and `past_due_since` if null. Notify owners and admins (email, in-app, banner) with the Portal link. `attempt_count` goes into the notice. |
| `invoice.payment_action_required` | Email the owner the hosted invoice link to complete card authentication. |
| `invoice.finalization_failed` | If `automatic_tax.status = 'requires_location_inputs'`, ask the owner to update the billing address in the Portal; alert ops either way. |
| `invoice.upcoming` | Not handled in v1. |
| `customer.updated` | Not handled; Magpie reads customer details from Stripe when it needs them. |
| `charge.refunded` | Record the refund in revenue (§9). For a run pack, revoke the grant (`revoked_at`) and recompute (§8.2). |
| `charge.dispute.created` | Alert ops; flag the tenant on the ops console. |
| `radar.early_fraud_warning.created` | Alert ops; ops decides whether to refund and cancel before a dispute. |

| `customer.subscription.trial_will_end` | Only for carried-over trial days: email owners and admins "Your first charge of $149 is on Dec 3." |

Configure the Stripe endpoint to send these events plus `customer.subscription.paused` and `resumed` (stored, no action; Magpie never pauses subscriptions). Stripe's entitlement events are not used, because entitlements are computed in Magpie.

### 4.5 Idempotency

| Direction | Rule |
|---|---|
| Inbound | `billing_events.stripe_event_id` is the primary key; the workflow id `stripe:<event id>` runs once; every handler is safe to run twice (BUILD_PLAN M6 replays each fixture twice). |
| Outbound | Every Stripe write passes an `Idempotency-Key` built from its natural key, for example `customer:<tenant_id>`, `checkout:<tenant_id>:<request Idempotency-Key>`, `cancel:<subscription id>:<request Idempotency-Key>`, `refund:<charge id>:<ops request id>`. |
| Grants | `credit_grants.stripe_checkout_session_id` is unique, so a replayed checkout event grants once. |

### 4.6 Stripe Tax

- Stripe Tax on in test and live mode (BUILD_PLAN §0.1). Add a registration in each state where Magpie must collect; Stripe Tax only collects where a registration exists, and its threshold monitoring shows when a new one is needed.
- Products carry the business SaaS tax code; prices are tax-exclusive.
- Checkout collects the billing address (`billing_address_collection: required`) and tax ids, and saves the address to the Customer (`customer_update.address: auto`). Subscriptions created by Checkout keep automatic tax on for renewals.
- Taxability of SaaS differs by state; Stripe Tax decides per invoice.
- Stripe Tax and Stripe Billing fees are costs in §9 (**verify** current rates).

## 5. Subscription state machine

### 5.1 States

The product state is `tenants.status` plus `tenants.status_reason` and `tenants.past_due_since` (§11). `subscriptions.status` mirrors Stripe.

| `tenants.status` | `status_reason` | Meaning |
|---|---|---|
| `trialing` | null | 14-day trial, no card, trial limits |
| `active` | null | Paid and current |
| `past_due` | null | A payment failed; `past_due_since` set |
| `canceled` | `trial_ended`, `payment_failed` or `owner_canceled` | No paid plan; read-only; data kept until deletion |
| `suspended` | `ops` or `abuse` | Stopped by Magpie staff (FR-OPS-3) |
| `deleting` | null | Deletion requested by the owner (FR-ACC-5) and cancelable until it runs |

| `subscriptions.status` | Effect on `tenants.status` |
|---|---|
| `trialing` with no Stripe subscription (Magpie's own trial row) | `trialing` |
| `active` | `active`, unless `suspended` or `deleting` |
| `past_due` | `past_due` |
| `canceled` | `canceled` with the reason from §4.4 |
| `trialing` with a Stripe subscription (carried-over trial days after Checkout) | `active`, with the chosen plan's entitlements |
| `incomplete` | no change; the first payment did not finish, so the workspace stays as it was |
| `incomplete_expired` | stored as `canceled` in `subscriptions` (its check has no `incomplete_expired`, INTEGRATIONS §26 item 5); the workspace stays as it was before Checkout |
| `unpaid`, `paused` | not used; Stripe is set to cancel after retries (§5.2) |

### 5.2 Transitions and timings

| From | Event | To | Timing and notices |
|---|---|---|---|
| (none) | Sign-up | `trialing` | `trial_ends_at` = sign-up + 14 days. `subscriptions` row with `plan_key = 'trial'`, `status = 'trialing'`, the Stripe customer id (§4.1) and no Stripe subscription. Trial entitlements. |
| `trialing` | Daily lifecycle | `trialing` | Reminders 3 days and 1 day before `trial_ends_at` by email and in-app (FR-BIL-1). |
| `trialing` | Checkout completed | `active` | The chosen plan applies at once. Unused trial days carry over as Stripe `trial_end`, so the first charge is at the original trial end; `trial_will_end` sends a reminder 3 days before. New usage period from the subscription start; trial usage stays in the old period. |
| `trialing` | `trial_ends_at` passes | `canceled` (`trial_ended`) | Read-only. Deletion scheduled 30 days later (`tenant_deletions.scheduled_for`), with emails 7 days and 1 day before. |
| `active` | `invoice.payment_failed` | `past_due` | Day 0. Emails on days 0, 3 and 6; banner; in-app notice. Stripe Smart Retries runs up to 8 retries within 2 weeks (Stripe's default for new accounts; set it explicitly). |
| `past_due` | `invoice.paid` | `active` | Clears `past_due_since`; jobs resume. |
| `past_due` | 7 days after `past_due_since` | `past_due` | Scheduled Bot jobs pause (FR-BIL-6). One notice: "Your Bots have paused their scheduled work. Update your card to restart them." |
| `past_due` | Stripe cancels after the last retry (setting "If all retries fail: cancel the subscription") | `canceled` (`payment_failed`) | About day 14: read-only (FR-BIL-6). Backstop: if Stripe has not canceled by day 15, the lifecycle job cancels through the API. Deletion scheduled 60 days later, with emails 30, 7 and 1 days before. |
| `active` | Owner cancels in the app | `active` | `cancel_at_period_end`; full access until the period ends (FR-BIL-7); banner with the end date; "Keep my plan" undoes it. |
| `active` | Period ends after cancellation (`customer.subscription.deleted`) | `canceled` (`owner_canceled`) | Read-only; deletion scheduled 60 days later, with the same reminders. |
| `canceled` | Checkout completed (any time before deletion runs) | `active` | Deletion row removed; data intact; new period. |
| any but `deleting` | Ops suspends | `suspended` (`ops` or `abuse`) | Audited. Unsuspend returns to the state the subscription implies. |
| any | Owner requests deletion | `deleting` | Scheduled 30 days out, cancelable (FR-ACC-5). The subscription is set to cancel at period end; if deletion runs first, it is canceled at once without proration. |
| `deleting` or `canceled` | `tenant_deletions.scheduled_for` reached | deleted | The deletion workflow on the `system` queue removes every row and the R2 prefix (BUILD_PLAN M7); a platform `audit_log` row records it. |

PRD FR-BIL-6 reads "past due for 7 days, then Bot jobs pause, then read-only after 14 days, then data kept for 60 days". The read-only point is when Stripe cancels at the end of its 2-week retry window, about day 14.

### 5.3 What each state allows

| State | Sign in, read, search | Export | Writes | Chat, Ask a Bot, approvals | Bot work a person starts | Scheduled Bot jobs | Outbound email and SMS | Billing pages | Problem code on refused writes |
|---|---|---|---|---|---|---|---|---|---|
| `trialing` | yes | yes | yes | yes | yes | yes | yes, trial limits | yes | |
| `active` | yes | yes | yes | yes | yes | yes | yes | yes | |
| `past_due`, days 0 to 7 | yes | yes | yes | yes | yes | yes | yes | yes | |
| `past_due`, day 7 on | yes | yes | yes | yes | yes | paused | yes | yes | |
| `canceled` | yes | yes | no | no; pending approvals canceled on entry | no | no | no | yes | `payment_required` for `trial_ended` and `payment_failed`; `workspace_read_only` for `owner_canceled` (API.md §2.9) |
| `suspended` | only `/me`, workspace list, billing, export (API.md §2.9) | yes | no | no | no | no | no | yes | `workspace_suspended` |
| `deleting` | yes | yes | no, except canceling the deletion | no | no | no | no | yes | `workspace_read_only` |

- Entering `canceled`, `suspended` or `deleting` cancels running Bot runs and pending approvals (AGENT_RUNTIME §4.11).
- Inbound emails (quote replies) are still stored while read-only, so nothing is lost if the workspace comes back. They are not processed by Bots until it does.
- Usage pauses (§6.4) apply on top of these states.

`billing.workspaceState(tenant)` returns these flags. It is the single function the api middleware (ARCHITECTURE §5.4 step 3), the fan-out functions, `beginSegment` and the notification relay use.

### 5.4 Timers

The daily `trial-lifecycle` schedule (ARCHITECTURE §7.4) runs `billing.advanceLifecycle(now)` in `packages/core/billing` on the `magpie_ops` pool:
- trial reminders;
- trials ending;
- the day-7 jobs-paused notice;
- the day-15 cancel backstop;
- deletion reminders;
- expired `entitlement_overrides`;
- deletions due (handed to the deletion workflow).

Each transition writes `audit_log` (actor `system`) and is idempotent per tenant per day (workflow id `lifecycle:<tenant>:<yyyy-mm-dd>:<transition>`). Daily runs can act up to 24 hours late, except the jobs-paused rule, which `billing.workspaceState` computes live from `past_due_since`. Tests use a fake clock (BUILD_PLAN M6).

## 6. Metering

### 6.1 What counts

| Unit | Definition |
|---|---|
| AI run (`ai_runs`) | One Bot turn: a chat reply, a job firing, a reaction to an event or a delegated task, whatever the number of model calls inside it, up to the plan's step cap (PRD §8). Counted once, at the run's first model call. Resume segments after approvals are the same run. A run that makes no model call is not counted, so code-only jobs (scans, digests, deadline reminders, award watch) cost no runs. Each delegated run is its own run. If a run's first model call fails at every provider, the count is reversed with a `usage_events` row of quantity -1 and deterministic id `ai_run_refund:<run_id>`. |
| AI cost (`ai_cost`) | The provider cost of every model and embedding call, in micros, from token counts and `packages/llm/models.json` prices (cached input at the cached price). |
| Document page (`doc_pages`) | A page of a bid document whose text Magpie reads for the workspace: a PDF page; one page per image; for DOCX, XLSX, CSV and text, one page per 3,000 characters of extracted text, rounded up. Counted once per `bid_documents` row when its text becomes ready, whether the text came from the shared public cache or the workspace's upload. Re-reading the same document later is not counted. Quote reply emails and attachments stored as bid documents count the same way. |
| SMS segment (`sms_segments`) | One billed segment of an SMS to a workspace user: 160 GSM-7 or 70 UCS-2 characters for a single segment, 153 or 67 per segment when split. Settled with Twilio's segment count from the status callback. |
| Outreach email (`emails_sent`) | One recipient (each `to` and `cc`) of an outreach email sent through Postmark from Magpie's domain. Magpie's own notifications and digests are not counted. |
| Storage (`storage_bytes`) | Sum of `files.size_bytes` for the workspace, updated when a file row is created or deleted. |
| API request (`api_requests`) | One `/api/v1` or `/mcp` request that passed authentication. |

### 6.2 Writes in the same transaction

Every metered action writes its `usage_events` row and its `usage_counters` change in the transaction that does the work (ARCHITECTURE §8, DATA_MODEL §14):

```sql
insert into usage_events (id, key, quantity, cost_micros, feature, bot_id, run_id, user_id, provider, model, meta)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
on conflict (id) do nothing
returning id;

insert into usage_counters (period_start, key, used)
values ($12, $2, $3)
on conflict (tenant_id, period_start, key) do update set used = usage_counters.used + excluded.used
returning used, alerted_80_at, alerted_100_at, alerted_120_at;
```

- The counter statement runs only when the event insert returned a row, so a replayed event never counts twice. Ids are UUIDv7, or a deterministic UUIDv5 when the event has a natural key (`ai_run:<run_id>`, `doc:<bid_document_id>`, `sms:<message_id>`).
- `tenant_id` comes from the column default `app_tenant_id()`.
- The threshold check (§6.4) uses the returned `used` in the same transaction and, on a crossing, sets `alerted_*_at` and inserts the alert notifications.
- **Period start** (`billing.currentPeriodStart`):
  - for a paid subscription, the UTC date of the subscription item's `current_period_start`;
  - for a trial, the trial's start date;
  - for `day` keys, the current UTC date;
  - for gauges, `1970-01-01`.

### 6.3 Reserve and settle

Limits are checked before work starts, so concurrent work cannot overshoot (BUILD_PLAN M6: "no overshoot beyond one run").

**Atomic check and add** for keys whose amount is known up front (`ai_runs` for job and event runs, `doc_pages`, `emails_sent`, `storage_bytes`, `api_requests`):

```sql
insert into usage_counters (period_start, key, used) values ($1, $2, 0) on conflict do nothing;

update usage_counters set used = used + $3
where tenant_id = app_tenant_id() and period_start = $1 and key = $2 and used + $3 <= $4
returning used;
```

`$4` is the limit times the multiplier from §6.4 (1.2 for the 120% keys, 1.0 for hard keys). No row returned means `limit_reached`. The `usage_events` row is inserted in the same transaction. Chat and person-started runs add to `ai_runs` without the check (they continue past 120%), bounded by the cost ceiling.

**Reserve, then settle** for AI cost, whose amount is known only after the call:
1. **Reserve** (before each model call, in its own short transaction):
   1. Lock the period's `ai_cost` and `ai_cost_reserved` counter rows in that order (`select ... for update`).
   2. Compute `estimate` = input tokens times the input price plus `max_tokens` times the output price of the most expensive allowed entry in the tier.
   3. If `ai_cost.used + ai_cost_reserved.used + estimate > ai_cost_micros`, refuse with `limit_reached`. Also refuse if the run's `cost_micros + estimate > max_cost_micros_per_run`.
   4. Otherwise add `estimate` to `ai_cost_reserved`.
2. **Call** the provider.
3. **Settle** (one transaction, with `agent_steps` and `agent_runs` totals, AGENT_RUNTIME §4.7):
   - insert the `usage_events` row with the actual cost;
   - add the actual cost to `ai_cost`;
   - subtract `estimate` from `ai_cost_reserved`.
4. **Release.** If the call fails without cost, or the run is canceled before the call, subtract `estimate` only. The reservation and its release are DBOS steps, so a crash between them is resumed by recovery. Reservations left by a crash that recovery never resumes expire with the period.

Since the actual cost cannot exceed the estimate (output is capped by `max_tokens`), the ceiling is never passed.

**SMS** reserves the estimated segments when the notification is queued and settles the difference from Twilio's status callback.

### 6.4 The 80%, 100% and 120% rules

| Key | At 80% | At 100% | At 120% |
|---|---|---|---|
| `ai_runs` | Alert owners and admins | Alert everyone in the workspace; everything keeps working | Scheduled jobs (`trigger = 'job'`) and event runs not caused by a person pause until a run pack or the next period (FR-BIL-4). Chat, Ask a Bot, approvals, API tasks and runs from a person's action keep working. |
| `doc_pages` | Alert owners and admins | Alert everyone | New documents wait unread (`text_status` stays `pending`, reason `page_allowance`); reading resumes on a run pack or the next period |
| `sms_segments` | Alert owners and admins | Non-urgent texts go by Telegram or email instead | Only deadline reminders inside 2 hours go by SMS |
| `ai_cost_micros` | Alert owners, admins and ops | Every model call stops, chat included, until a run pack or the next period; approvals can still be decided and approved actions still execute | |
| `emails_sent` | Alert owners and admins | Outreach through Magpie's domain stops; sending from a connected Gmail or Outlook still works | |
| `storage_bytes` | Alert owners and admins | Uploads refused | |
| `users`, `saved_searches`, `bot_jobs` | | Creation refused with `limit_reached` | |
| `api_requests_per_day` | | `limit_reached` until the next UTC day | |

- An event run is "caused by a person" when its `domain_events.actor_type` is `user`: Pursue, a decision, a stage move, an upload, a confirmed quote. Events from outside (a quote reply arriving) or from the system are not.
- Paused event runs are recorded as skipped; the bid shows "Paused by your plan's limit" with a Run now button, which starts a person-caused run.
- Paused jobs need no catch-up: their next firing after the pause lifts runs normally.

### 6.5 Alerts

| Threshold | Recipients | Channels |
|---|---|---|
| 80% | owners and admins | in-app, email |
| 100% | everyone in the workspace (owners and admins only for `ai_cost_micros`, `emails_sent`, `storage_bytes`) | in-app, email |
| 120% (`ai_runs`, `doc_pages`) and 100% of `ai_cost_micros` | owners and admins | in-app, email, and their phone channel, since Bots stop working |

- Notification kind `billing`, `dedupe_key` `usage:<key>:<period_start>:<threshold>`.
- `usage_counters.alerted_80_at`, `alerted_100_at` and `alerted_120_at` are set in the crossing transaction, so each alert goes out once per period.
- Text example: "You've used 600 of 600 AI runs this month. Your Bots keep working. At 720 runs, scheduled work pauses. Buy a run pack or wait until Dec 1."
- Ops alerts: a workspace whose AI cost passes 50% of its revenue over the trailing 30 days (PRD §7), and every 100% `ai_cost_micros` crossing.

### 6.6 Run pack purchase

1. An owner or admin clicks "Buy a run pack" on the usage page, from an alert link, or from the 120% banner. The workspace must have a paid subscription (`active` or `past_due`); trials must pick a plan first.
2. Checkout in payment mode (§4.2), quantity 1 to 5.
3. `checkout.session.completed` with `payment_status: paid` inserts `credit_grants`:
   - `source 'run_pack'`, `quantity`;
   - `grants` `{ ai_runs: 1000 × quantity, doc_pages: 2500 × quantity, ai_cost_micros: 125000000 × quantity }`;
   - `period_start` = the current period;
   - `stripe_checkout_session_id`.
   It then recomputes entitlements in the same transaction.
4. The raised limit takes effect at once (FR-BIL-5). Paused jobs run at their next firing; documents waiting on `page_allowance` are re-queued; a notice confirms the purchase.
5. **Carry-over.** Unused run pack amounts carry into the next period once (§6.8), then expire. The purchase screen says so.

### 6.7 Stripe Meters

v1 does not report usage to Stripe Meters. No plan charges for usage in v1: limits plus run packs cover overuse, so Meters would be a second source of truth with nothing to bill. `usage_events.stripe_reported_at` stays null. The `report-usage` schedule (ARCHITECTURE §7.4) and its reporting path (INTEGRATIONS §14) are built but return at once while feature flag `billing.stripe_meters` is off; no key is reported in v1. Revisit for Team in v1.5 if per-seat overage pricing is chosen; Stripe's Meters API then receives one event per settled unit, keyed by the `usage_events.id` as the meter event identifier (**verify** the meter event API at that time).

### 6.8 Period rollover

When `customer.subscription.updated` or `invoice.paid` shows a new `current_period_start`:
1. Set `subscriptions.current_period_start` and `current_period_end`. New counter rows start at zero for the new `period_start`; the old rows stay for history.
2. Carry-over: for each counter key with run pack grants in the ending period (not themselves `carryover`), carry `min(Σ those grants, max(0, effective limit at period end - used))`. Insert it as a `credit_grants` row with `source 'carryover'` for the new period.
3. Recompute entitlements (grants of the old period stop counting).
4. Clear 120% pauses (they are computed from the new counters, so nothing to clear by hand).

Trials have one period: sign-up to `trial_ends_at`.

## 7. Trial abuse controls

A trial costs real money (up to the $25 AI cost ceiling plus SMS and email), and outreach from Magpie's domain could be abused for spam. Controls:

1. **Turnstile** on sign-up and magic-link requests (SECURITY §3.4).
2. **Verified email before Bots run** (SECURITY §3.3). Google and Microsoft sign-ups arrive verified.
3. **Disposable email domains** are refused at sign-up with "Use your work email" (a maintained list in `packages/core/tenants`).
4. **One trial per identity.** `trial_claims` (§11) stores HMAC-SHA256 hashes, keyed by `TRIAL_CLAIM_PEPPER`, of:
   - the verified email;
   - the Google or Microsoft account id;
   - the UEI once entered in onboarding;
   - the verified SMS number;
   - the email domain for non-public domains.
   A workspace whose claim already exists gets no new trial allowance: it starts in `canceled` (`trial_ended`) with a "Pick a plan" screen. Ops can grant an exception with a reason, which is audited. Business email domains are limited to 3 trials per 90 days; public domains (gmail.com, outlook.com and the like) are not limited by domain.
5. **Sign-up limits:** 5 per IP per hour (SECURITY §14) and 10 trials per IP per 30 days, after which new workspaces from that IP wait for ops review.
6. **Low trial allowances** (§3.2): 25 outreach emails, 100 SMS segments, no API, $25 AI cost ceiling. Outreach needs the workspace's postal address and a verified owner email.
7. **Monitoring:** the ops console flags trials whose AI cost passes $10 or whose outreach passes 20 emails in their first 3 days, and trials with spam complaints or hard bounces above 5%. Ops can suspend with reason `abuse`.

`trial_claims` survives workspace deletion (its `tenant_id` is set to null), so deleting and re-signing does not restart a trial. Rows are kept 2 years (SECURITY §7.2).

## 8. Cancellations, refunds and invoices

### 8.1 Cancellation (FR-BIL-7)

- Owners and admins cancel in Settings > Billing (`POST /api/app/billing/cancel`, API.md §5.23). One screen: what happens (access until the period end date, then read-only, data kept 60 days, export any time), an optional reason (a short list plus free text), and a Cancel plan button. No calls, no discount offers, no extra steps.
- `stripe.subscriptions.update(id, { cancel_at_period_end: true, cancellation_details: { feedback, comment } })` with an idempotency key; audited.
- Until the period ends, a banner shows the end date with "Keep my plan" (`POST /api/app/billing/resume`), which sets `cancel_at_period_end: false`.
- After the period ends: `canceled` (`owner_canceled`), read-only, export available, deletion after 60 days (§5.2). Coming back before deletion restores everything.

### 8.2 Refunds

- **Policy:** month-to-month, no refunds for partial months; access lasts to the period end. Exceptions, decided by ops admins:
  - billing errors and duplicate charges: full refund;
  - a run pack bought by mistake and unused within 7 days: full refund, and the grant is revoked;
  - goodwill credits: an `ops_credit` grant instead of money where possible.
- Refunds are issued from the ops console through the Stripe API with an idempotency key, never by editing Magpie data, and are audited.
- `charge.refunded` updates revenue for margin reporting and revokes the matching run pack grant (`revoked_at`), then recomputes entitlements.
- A run pack whose runs were already used is not refunded.
- Disputes: ops responds through Stripe with the audit trail as evidence. A lost dispute on a subscription charge leads to cancellation at ops' discretion.

### 8.3 Invoices and receipts

- Stripe creates invoices for subscriptions and, through `invoice_creation`, for run packs. Stripe emails receipts and invoices (turn on customer emails for successful payments and finalized invoices in Stripe settings).
- Invoice settings in Stripe: Magpie's legal name, address, support email, tax registration numbers, and the footer "Month-to-month. Cancel any time in Settings > Billing."
- Magpie stores no invoice table. The billing page lists the last 12 invoices through the Stripe API (cached for 5 minutes) with links to Stripe's hosted invoice and PDF. The Customer Portal shows the full history.
- Customer tax ids collected at Checkout appear on invoices.

## 9. Cost and margin reporting

For the ops console (FR-OPS-1, FR-OPS-6) and the alert in PRD §7. The workspace usage page (FR-BIL-3) reads only its own `usage_counters` and, for owners and admins, AI cost per Bot from `usage_events`.

### 9.1 Revenue per workspace per day

- Subscriptions: from `invoice.paid` events in `billing_events`, the amount paid minus tax, spread evenly over the days of the invoice line's period.
- Run packs: the amount paid minus tax, on the payment day.
- Refunds: negative on the refund day (`charge.refunded`).
- MRR: the current subscription price times seats, after discounts, for `active` and `past_due` workspaces.

### 9.2 Cost per workspace per day

Every cost is a `usage_events.cost_micros` value, so costs sum by `tenant_id`, `key`, `feature` and `bot_id`.

| Cost | Source | How |
|---|---|---|
| Models and embeddings | `usage_events` key `ai_cost` | Exact per call (§6.1) |
| SMS | `sms_segments` events | Settled segments times the Twilio unit price, plus carrier fees from `unit-costs.json` |
| Outreach and notification email | `emails_sent` events, plus a daily `notification_emails` estimate | Postmark unit price |
| Kontract | `kontract_calls` events | Exact per call from Kontract's `X-Kontract-Cost-Micro` header (INTEGRATIONS §3); the monthly `kontract-usage-reconcile` job compares totals with Kontract's `GET /api/v1/usage?workspace=<tenant_id>` and alerts ops on a difference |
| Email verification | `enrichment_lookups` events | `MILLIONVERIFIER_COST_MICROS` per lookup on Magpie's key; 0 on a workspace's own key (INTEGRATIONS §19) |
| Storage | daily accrual from the `storage_bytes` gauge | R2 price per GB-month / 30 |
| Payment fees | `payment_fees` event on each `invoice.paid` and run pack payment | The Stripe fee from the charge's balance transaction, plus Stripe Billing and Stripe Tax fees at their published rates (**verify**) |
| Hosting | allocation, not an event | Fixed monthly platform cost from `unit-costs.json` divided by active workspaces and days |

`packages/core/billing/unit-costs.json` holds every unit price with a `verifiedOn` date. A CI warning fires when any date is older than 90 days. **Verify** every price before launch (COGS.md §5).

Model calls made while reading public documents for the shared cache are charged to the workspace that triggered the reading, with `meta.shared = true`, so platform-wide shared costs stay visible.

### 9.3 Reports and alerts

| View | Contents |
|---|---|
| Tenants list | plan, status, MRR, usage percentage per key, AI cost, vendor cost, gross margin for the current period and trailing 30 days; sortable by margin |
| Tenant detail | daily revenue and cost chart; cost by key, by Bot and by feature; top runs by cost; grants and overrides |
| Cost dashboard | all workspaces' AI, SMS, Kontract and enrichment spend per day against revenue (FR-OPS-6) |

- Gross margin = (revenue - total cost) / revenue, per period and trailing 30 days.
- Flags:
  - AI cost above 50% of trailing-30-day revenue (PRD §7);
  - gross margin under 50%;
  - a trial costing over $15;
  - any `ai_cost_micros` ceiling hit.
  Flags alert ops by email and on the console.
- Targets to watch (PRD §7 and §10): typical workspace cost under 30% of plan price; gross margin 70% or more at typical use.

Queries run on the `magpie_ops` pool from `packages/core/ops`, and each view is audited (ARCHITECTURE §5.1). A nightly rollup (§11) keeps the console fast; a test checks that rollup totals equal raw `usage_events` sums (FR-OPS-6).

## 10. Verify before building

1. Checkout Session parameters in §4.2 against the pinned API version: subscription mode with an existing Customer, `automatic_tax`, `customer_update`, `tax_id_collection`, `invoice_creation` in payment mode.
2. Customer Portal configuration: plan-change deep links, scheduling downgrades at period end, turning cancellation off.
3. Subscription period fields on items from `2025-03-31.basil` on, and which events carry a new period.
4. Smart Retries settings (retry count and window) and the "cancel the subscription" outcome; that `customer.subscription.deleted` follows.
5. The business SaaS tax code, Stripe Tax registration steps, Stripe Billing and Stripe Tax fee rates.
6. Restricted key permissions needed for this integration (SECURITY §5.5).
7. Twilio segment counts in status callbacks and per-segment prices; Postmark, R2 and MillionVerifier unit prices; Kontract's cost header and usage endpoint per workspace label.
8. Stripe's minimum lead time for `subscription_data.trial_end` in Checkout (§4.2).

## 11. Schema additions requested

> **Settled.** Adopted in [DATA_MODEL.md §18](DATA_MODEL.md#18-additions-adopted-from-the-supporting-specs). Conflicts with the other specs are settled in [ARCHITECTURE.md §15](ARCHITECTURE.md#15-rulings-across-the-specs), which wins over this file.

These are not in DATA_MODEL.md. Do not build them until the data model is updated.

1. **`plans.billing_interval`**: add `'one_time'` to the check, so the run pack is a `plans` row (PRD §8 lists it with the plans).
2. **`entitlements.reset_period`**: add `'day'` to the check, for `api_requests_per_day`.
3. **Table `credit_grants`** (module `billing`, standard tenant RLS; written by webhook processing inside `withTenant`, and by ops through the ops pool):
   ```sql
   create table credit_grants (
     id uuid primary key,
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     source text not null check (source in ('run_pack','ops_credit','carryover')),
     grants jsonb not null,
     quantity int not null default 1,
     period_start date not null,
     stripe_checkout_session_id text unique,
     granted_by uuid references users(id),
     reason text,
     revoked_at timestamptz,
     created_at timestamptz not null default now()
   );
   create index on credit_grants (tenant_id, period_start);
   ```
   `grants` is `{ "<entitlement key>": integer }`. Needed for run packs (FR-BIL-5), ops credits (FR-OPS-3) and carry-over.
4. **Table `entitlement_overrides`** (module `billing`, standard tenant RLS; written only through the ops pool):
   ```sql
   create table entitlement_overrides (
     tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
     key text not null,
     limit_value bigint,
     reason text not null,
     set_by uuid not null references users(id),
     expires_at timestamptz,
     created_at timestamptz not null default now(),
     primary key (tenant_id, key)
   );
   ```
   Needed because `entitlements` holds only the effective value, and an override must survive recomputes (FR-OPS-3).
5. **`tenants.status_reason text`** with `check (status_reason in ('trial_ended','payment_failed','owner_canceled','ops','abuse'))`, and **`tenants.past_due_since timestamptz`**. Needed to tell apart the read-only reasons (they map to different problem codes, API.md §2.9) and to time the day-7 and day-14 rules (FR-BIL-6).
6. **Table `trial_claims`** (`magpie_ops` pool only, no tenant policy; add to DATA_MODEL §2.1):
   ```sql
   create table trial_claims (
     id uuid primary key,
     kind text not null check (kind in ('email','oauth_account','uei','phone','email_domain')),
     value_hash text not null,
     tenant_id uuid references tenants(id) on delete set null,
     created_at timestamptz not null default now()
   );
   create unique index on trial_claims (kind, value_hash) where kind <> 'email_domain';
   create index on trial_claims (kind, value_hash, created_at);
   ```
   Needed for one trial per identity (§7); it must outlive deleted workspaces. `email_domain` allows several rows so the 3-per-90-days rule can count them.
7. **Materialized view `ops_tenant_daily`** (owned by `magpie_owner`, `select` for `magpie_ops`, refreshed nightly): per tenant per day, revenue, cost by `usage_events.key`, and run counts. Needed so the ops console loads fast at 5,000 workspaces (ARCHITECTURE §13).
8. **Comment-only update** to `usage_events.key`'s list in DATA_MODEL §14: add `payment_fees` and `notification_emails`. `usage_counters` also uses `ai_cost_reserved` and `api_requests`. Neither column has a check constraint, so no migration is needed.
