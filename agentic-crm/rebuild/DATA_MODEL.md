# Magpie: data model

Every table the app needs, with its columns, keys and isolation rule. Names here are canonical: code, API and other specs must use them. Write the Drizzle schema in `packages/db/src/schema/<module>.ts` from this file. Write RLS, functions and triggers as hand-written SQL migrations.

## 1. Conventions

| Rule | Detail |
|---|---|
| Ids | `uuid`. The app generates UUIDv7 (time-ordered) with the `uuidv7` package. The column default `gen_random_uuid()` is only a fallback. |
| Tenant column | `tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade` on every tenant table. |
| Timestamps | `timestamptz`. `created_at default now()`. `updated_at default now()`, maintained by the `set_updated_at()` trigger. |
| Money | `bigint` cents in `*_cents` columns, plus `currency char(3) default 'USD'` where a row can hold money. |
| AI and vendor cost | `bigint` millionths of a US dollar in `cost_micros`. |
| Enumerations | `text` with a `check (col in (...))` constraint. No Postgres enum types, because adding a value then needs a migration lock. |
| Flexible data | `jsonb`, always validated by a zod schema in `packages/shared` before it is written. |
| Soft delete | CRM records use `archived_at timestamptz`. Lists hide archived rows by default. Tenant deletion hard-deletes through `on delete cascade`. |
| Polymorphic links | `record_type text` + `record_id uuid`. `record_type` is one of `company`, `contact`, `deal`, `task`, `quote_request`, `draft`, `opportunity_match`. Integrity is checked in core services, plus a nightly orphan check. |
| Uniques | Every unique constraint on a tenant table includes `tenant_id`. |
| Indexes | Every tenant table has an index whose first column is `tenant_id`. Foreign keys get indexes. |
| Text search | `search tsvector generated always as (...) stored` plus a GIN index, on companies, contacts and deals. Trigram GIN indexes on names for fuzzy matching. |
| Naming | Tables plural snake_case. Columns snake_case. Booleans start with `is_` or `has_`. |

## 2. RLS template

Run once:

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists vector;

create role magpie_owner nologin;   -- owns all tables; migrations run as a login role in this group
create role magpie_app   nologin;   -- runtime role, no BYPASSRLS
create role magpie_ops   nologin bypassrls;  -- operator console pool only
create role magpie_auth  nologin;   -- Better Auth pool, identity tables only

create function app_tenant_id() returns uuid language sql stable as
$$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

create function app_user_id() returns uuid language sql stable as
$$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
```

For **every tenant table** `X` (a migration helper `tenantTable('X')` emits this):

```sql
alter table X enable row level security;
alter table X force row level security;
create policy tenant_isolation on X
  using (tenant_id = app_tenant_id())
  with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on X to magpie_app;
create index if not exists X_tenant_idx on X (tenant_id);  -- or a composite starting with tenant_id
create trigger X_updated_at before update on X for each row execute function set_updated_at();  -- if it has updated_at
```

Append-only tables (`audit_log`, `usage_events`, `domain_events`, `agent_steps`, `record_history`) grant only `select, insert` to `magpie_app`.

### 2.1 Tables without the tenant policy

| Table | Why | How it is protected |
|---|---|---|
| `users`, `sessions`, `auth_accounts`, `verifications`, `tenants`, `memberships`, `invitations` | Owned by Better Auth, read before a tenant is known | Accessed only through the `magpie_auth` pool by Better Auth and by `packages/core/tenants`. Every query in `core/tenants` filters by tenant or user explicitly and is covered by tests. `magpie_app` has `select` on `tenants` and `memberships` only through the views `my_memberships` (user's own rows) and `current_tenant` (the row matching `app_tenant_id()`). |
| `plans`, `market_opportunities`, `market_opportunity_texts` | Global, non-customer data (the plan catalog, public government notices) | `magpie_app` has `select` only. Writes run in `worker` through the `magpie_ops` pool. |
| `feature_flags` | Global with optional tenant override | Policy `using (tenant_id is null or tenant_id = app_tenant_id())`, select only for `magpie_app`. |
| `billing_events`, `webhook_receipts` | Arrive before a tenant is known | Written by webhook handlers through the `magpie_ops` pool. Processing then switches to `withTenant`. |
| `impersonations`, `tenant_deletions`, `pending_work`, `tenant_run_slots` | Operator and dispatcher data | `magpie_ops` only. |

### 2.2 Resolver functions (the only cross-tenant lookups)

Webhooks must find the tenant before they can open `withTenant`. They use these `security definer` functions, owned by `magpie_owner`, each returning the minimum needed:

```sql
tenant_for_stripe_customer(customer_id text) returns uuid
binding_for_channel_address(channel text, address text) returns table (tenant_id uuid, user_id uuid, binding_id uuid)
tenant_for_reply_token(token text) returns table (tenant_id uuid, record_type text, record_id uuid)
tenant_for_link_code(code text) returns table (tenant_id uuid, user_id uuid, channel text)
tenant_for_api_key_prefix(prefix text) returns table (tenant_id uuid, key_id uuid, key_hash text)
```

## 3. Identity and tenants (Better Auth)

Configure Better Auth's `modelName` and `fields` options so its models map to these snake_case tables. Additional fields use `additionalFields`. Check the current Better Auth docs for the exact option names.

```sql
create table users (                       -- Better Auth "user"
  id uuid primary key,
  email citext not null unique,
  email_verified boolean not null default false,
  name text not null,
  image text,
  phone_e164 text,                          -- optional, verified separately through channel_bindings
  timezone text not null default 'America/New_York',
  is_staff boolean not null default false,  -- Magpie employees
  staff_role text check (staff_role in ('support','reviewer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (                    -- Better Auth "session"
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text, user_agent text,
  active_tenant_id uuid references tenants(id) on delete set null,   -- organization plugin "activeOrganizationId"
  impersonated_by uuid references users(id),                          -- admin plugin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table auth_accounts (               -- Better Auth "account": password hash or OAuth login
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  provider_id text not null,               -- 'credential' | 'google' | 'microsoft'
  account_id text not null,
  password text,                            -- hashed by Better Auth
  access_token text, refresh_token text, id_token text,  -- login only; data-access tokens live in secrets
  access_token_expires_at timestamptz, scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);

create table verifications (               -- Better Auth "verification"
  id uuid primary key,
  identifier text not null, value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table tenants (                     -- Better Auth "organization"
  id uuid primary key,
  name text not null,
  slug citext not null unique,
  logo text,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','suspended','canceled','deleting')),
  plan_key text not null default 'trial',
  timezone text not null default 'America/New_York',
  country char(2) not null default 'US',
  cell text not null default 'pool-1',
  trial_ends_at timestamptz,
  suspended_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (                 -- Better Auth "member"
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  title text,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table invitations (                 -- Better Auth "invitation"
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email citext not null,
  role text not null check (role in ('admin','member','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','canceled','expired')),
  inviter_id uuid not null references users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
```

Exactly one `owner` membership per tenant. Ownership transfer is a core service, not a direct update.

## 4. Platform tables

```sql
create table tenant_settings (
  tenant_id uuid primary key default app_tenant_id() references tenants(id) on delete cascade,
  digest_hour smallint not null default 7 check (digest_hour between 0 and 23),
  quiet_hours jsonb not null default '{"start":"21:00","end":"07:00"}',
  model_policy jsonb not null default '{"excludedProviders":[]}',
  outreach_footer text,                     -- postal address and unsubscribe line (CAN-SPAM)
  approval_expiry_hours int not null default 72,
  ai_drafting_allowed boolean not null default true,  -- tenant-wide switch; per bid override on deals
  default_pipeline_id uuid,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table secrets (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  kind text not null check (kind in ('oauth_refresh_token','oauth_access_token','byok_api_key','webhook_signing_secret')),
  provider text not null,
  ciphertext bytea not null,
  nonce bytea not null,
  wrapped_data_key bytea not null,
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table api_keys (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,  -- the key acts as this person
  name text not null,
  prefix text not null unique,            -- first 8 chars shown in UI, e.g. 'mgp_AbC1'
  key_hash text not null,                 -- sha256 of the full key
  scopes text[] not null default '{read,write}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key,
  tenant_id uuid default app_tenant_id() references tenants(id) on delete cascade,  -- null for platform actions
  actor_type text not null check (actor_type in ('user','bot','system','staff','api_key')),
  actor_id uuid,
  impersonated_by uuid,                   -- staff user id when acting through impersonation
  action text not null,                   -- e.g. 'deal.update', 'approval.decide', 'secret.read'
  target_type text, target_id uuid,
  data jsonb not null default '{}',       -- diff or parameters, secrets redacted
  ip inet, user_agent text,
  created_at timestamptz not null default now()
);
create index on audit_log (tenant_id, created_at desc);

create table feature_flags (
  key text not null,
  tenant_id uuid references tenants(id) on delete cascade,  -- null = global default
  is_enabled boolean not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (key, tenant_id)
);

create table domain_events (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  type text not null,                     -- 'deal.stage_changed', 'approval.requested', ...
  payload jsonb not null,
  actor_type text, actor_id uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index on domain_events (tenant_id, created_at);
create index on domain_events (published_at) where published_at is null;

create table webhook_receipts (           -- dedupe for every inbound webhook
  provider text not null,                 -- 'stripe' | 'twilio' | 'telegram' | 'postmark' | 'google' | 'microsoft'
  external_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, external_id)
);
```

## 5. Company profile (the customer's own business)

```sql
create table company_profiles (
  tenant_id uuid primary key default app_tenant_id() references tenants(id) on delete cascade,
  legal_name text, dba text,
  uei text, cage text,
  sam_status text check (sam_status in ('active','expired','none','unknown')) default 'unknown',
  sam_expires_on date,
  naics_codes text[] not null default '{}',     -- primary first
  psc_codes text[] not null default '{}',
  certifications text[] not null default '{}'   -- '8a','wosb','edwosb','hubzone','sdvosb','vosb','sdb','dbe','mbe','wbe'
    check (certifications <@ array['8a','wosb','edwosb','hubzone','sdvosb','vosb','sdb','dbe','mbe','wbe']),
  base_address jsonb,                            -- {line1, city, state, zip, lat, lng}
  service_area jsonb not null default '{}',      -- {states:[], counties:[], radiusMiles:int}
  self_perform_trades text[] not null default '{}',
  capabilities text,                             -- plain-language description
  differentiators text,
  employee_count int,
  annual_revenue_band text,
  bonding jsonb,                                 -- {singleCents, aggregateCents, surety}
  insurance jsonb,                               -- {generalLiabilityCents, autoCents, workersComp: bool, umbrellaCents}
  labor_rates jsonb,                             -- [{role, hourlyCents, burdenPct}]
  min_contract_cents bigint, max_contract_cents bigint,
  website text, phone text,
  capability_statement_file_id uuid,
  updated_at timestamptz not null default now()
);

create table past_performance (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  title text not null,
  customer_name text not null,                  -- agency or company
  contract_number text,
  value_cents bigint,
  start_on date, end_on date,
  naics text,
  description text,
  reference jsonb,                              -- {name, title, email, phone}
  is_reference_allowed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table library_items (                    -- reusable boilerplate and files for bids
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  kind text not null check (kind in ('boilerplate','resume','certificate','insurance_certificate','w9','license','reference_letter','other')),
  title text not null,
  body text,                                    -- for boilerplate
  file_id uuid,
  expires_on date,                              -- certificates and insurance expire
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
```

## 6. CRM records

```sql
create table companies (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  name text not null,
  kinds text[] not null default '{}'           -- 'agency','prime','subcontractor','customer','supplier','partner','competitor'
    check (kinds <@ array['agency','prime','subcontractor','customer','supplier','partner','competitor']),
  domain citext, website text, phone text,
  address jsonb,
  uei text, cage text,
  naics_codes text[] not null default '{}',
  place_id text,                               -- Google place id only (Google terms forbid storing other Places fields)
  owner_user_id uuid references users(id),
  custom jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(domain::text,''))) stored
);
create index on companies using gin (search);
create index on companies using gin (name gin_trgm_ops);
create unique index on companies (tenant_id, uei) where uei is not null and archived_at is null;

create table contacts (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  first_name text, last_name text,
  title text,
  emails jsonb not null default '[]',          -- [{address, label, isPrimary, status:'unknown'|'valid'|'risky'|'invalid', verifiedAt}]
  phones jsonb not null default '[]',          -- [{e164, label, isPrimary}]
  owner_user_id uuid references users(id),
  is_do_not_contact boolean not null default false,
  custom jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple',
    coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(title,'') || ' ' || coalesce(emails::text,''))) stored
);
create index on contacts using gin (search);
create index on contacts (tenant_id, company_id);

create table pipelines (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bid','sale')),
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table pipeline_stages (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  category text not null check (category in ('open','submitted','won','lost','no_bid')),
  position int not null,
  probability_pct smallint check (probability_pct between 0 and 100)
);
-- Seeded bid pipeline: Found(open) > Reviewing(open) > Pricing(open) > Writing(open) > Submitted(submitted) > Won(won) > Lost(lost) > No bid(no_bid)
-- Seeded sale pipeline: Lead > Qualified > Proposal > Negotiation > Won > Lost

create table deals (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id),
  stage_id uuid not null references pipeline_stages(id),
  kind text not null check (kind in ('bid','sale')),
  name text not null,
  company_id uuid references companies(id) on delete set null,       -- the buyer: agency, prime or customer
  primary_contact_id uuid references contacts(id) on delete set null,
  owner_user_id uuid references users(id),
  amount_cents bigint,                          -- our price or expected value
  currency char(3) not null default 'USD',
  opportunity_id uuid references market_opportunities(id),  -- set for bids found in the market
  solicitation_number text,
  due_at timestamptz,                           -- proposal due
  close_date date,
  source text not null default 'manual' check (source in ('match','manual','import','inbound','api')),
  bid_decision jsonb,                           -- {decision:'bid'|'no_bid'|'undecided', score, reasons:[], decidedBy, decidedAt}
  is_ai_drafting_allowed boolean,               -- null = follow tenant setting; false when the solicitation bans AI
  lost_reason text, no_bid_reason text,
  submitted_at timestamptz, won_at timestamptz, lost_at timestamptz,
  custom jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(solicitation_number,''))) stored
);
create index on deals using gin (search);
create index on deals (tenant_id, stage_id);
create index on deals (tenant_id, due_at) where archived_at is null;
create unique index on deals (tenant_id, opportunity_id) where opportunity_id is not null and archived_at is null;

create table deal_contacts (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  role text not null default 'other' check (role in ('contracting_officer','contract_specialist','buyer','prime_pm','subcontractor','reference','other')),
  primary key (deal_id, contact_id)
);

create table tasks (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','done','canceled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  assignee_user_id uuid references users(id),
  assignee_bot_id uuid references bots(id),
  record_type text, record_id uuid,
  source text not null default 'user' check (source in ('user','bot','automation','system')),
  completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on tasks (tenant_id, status, due_at);
create index on tasks (tenant_id, record_type, record_id);

create table notes (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  body jsonb not null,                          -- TipTap JSON
  body_text text not null,                      -- plain text for search and prompts
  author_type text not null check (author_type in ('user','bot')),
  author_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on notes (tenant_id, record_type, record_id);

create table tags (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  name text not null, color text not null default 'gray',
  unique (tenant_id, name)
);

create table record_tags (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  primary key (tag_id, record_type, record_id)
);

create table field_definitions (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  object text not null check (object in ('company','contact','deal')),
  key text not null,                            -- snake_case, stored under records.custom[key]
  label text not null,
  type text not null check (type in ('text','long_text','number','currency','date','datetime','boolean','select','multiselect','email','phone','url','rating','record_link')),
  options jsonb,                                -- choices, link target object, number format
  is_required boolean not null default false,
  position int not null default 0,
  ai_fill text not null default 'off' check (ai_fill in ('off','suggest','auto')),
  ai_instructions text,                         -- how a Bot should fill it
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, object, key)
);

create table field_provenance (                 -- where each standard or custom field value came from
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  field_key text not null,                      -- standard column name or custom key
  source text not null check (source in ('user','bot','import','kontract','sam','usaspending','places','website','verifier','enrichment','api')),
  source_ref text,                              -- URL, document id + page, provider record id
  confidence numeric(3,2),
  run_id uuid,
  captured_at timestamptz not null default now(),
  primary key (tenant_id, record_type, record_id, field_key)
);

create table field_suggestions (                -- 'suggest' mode: a Bot proposes, a person accepts
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  field_key text not null,
  value jsonb not null,
  rationale text,
  citations jsonb not null default '[]',        -- [{kind, ref, quote}]
  status text not null default 'pending' check (status in ('pending','accepted','rejected','superseded')),
  run_id uuid,
  decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table record_history (                   -- append-only field diffs
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  field_key text not null,
  old_value jsonb, new_value jsonb,
  actor_type text not null check (actor_type in ('user','bot','automation','system','api_key','import')),
  actor_id uuid,
  run_id uuid,
  created_at timestamptz not null default now()
);
create index on record_history (tenant_id, record_type, record_id, created_at desc);

create table saved_views (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  object text not null check (object in ('company','contact','deal','task','opportunity_match')),
  name text not null,
  owner_user_id uuid references users(id) on delete cascade,  -- null = shared with the team
  layout text not null default 'table' check (layout in ('table','kanban','calendar')),
  filters jsonb not null default '[]',          -- [{field, op, value}]
  sort jsonb not null default '[]',
  columns jsonb not null default '[]',
  group_by text, date_field text,
  position int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
```

## 7. Activity timeline and files

```sql
create table activities (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  type text not null check (type in (
    'note','email_out','email_in','sms_out','sms_in','call','meeting','stage_change',
    'bot_action','approval','file','bid_event','quote_received','submission','system')),
  occurred_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('user','bot','contact','system','automation')),
  actor_id uuid,
  summary text not null,                        -- one line shown on the timeline
  payload jsonb not null default '{}',          -- type-specific; ids of messages, notes, approvals
  external_source text, external_id text,       -- for dedupe of imported events
  created_at timestamptz not null default now()
);
create unique index on activities (tenant_id, external_source, external_id) where external_id is not null;

create table activity_links (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  occurred_at timestamptz not null,             -- copied from activities for the timeline index
  primary key (activity_id, record_type, record_id)
);
create index on activity_links (tenant_id, record_type, record_id, occurred_at desc);

create table files (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  storage_key text not null unique,             -- 't/<tenant_id>/<yyyy>/<mm>/<file_id>'
  filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','infected','skipped')),
  uploaded_by_type text not null check (uploaded_by_type in ('user','bot','system','inbound_email')),
  uploaded_by_id uuid,
  created_at timestamptz not null default now()
);

create table file_links (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,
  record_type text not null, record_id uuid not null,
  purpose text not null default 'attachment' check (purpose in ('attachment','bid_document','quote','submission','logo','avatar','library')),
  primary key (file_id, record_type, record_id)
);
```

## 8. Market data (global) and matching (tenant)

```sql
create table market_opportunities (            -- global cache of public notices; no tenant_id
  id uuid primary key,
  source text not null check (source in ('sam','sled','other')),
  source_id text not null,                      -- notice id from Kontract / SAM.gov
  title text not null,
  agency text, office text,
  solicitation_number text,
  notice_type text,                             -- solicitation, combined synopsis, sources sought, presolicitation, award
  naics_codes text[] not null default '{}',
  psc_code text,
  set_aside text,                               -- normalized: 'none','small','8a','wosb','edwosb','hubzone','sdvosb','other'
  place_of_performance jsonb,                   -- {city, state, zip, country}
  posted_at timestamptz,
  response_due_at timestamptz,
  estimated_value_low_cents bigint, estimated_value_high_cents bigint,
  url text,
  summary text,                                 -- short description from the source
  raw jsonb not null,                           -- the source payload as received
  fetched_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (source, source_id)
);
create index on market_opportunities using gin (naics_codes);
create index on market_opportunities (response_due_at) where is_active;

create table market_opportunity_texts (         -- bid text read once, shared by every tenant (public documents only)
  id uuid primary key,
  opportunity_id uuid not null references market_opportunities(id) on delete cascade,
  document_ref text not null,                   -- source attachment id or URL
  document_title text,
  chunk_no int not null,
  page_from int, page_to int,
  text text not null,
  embedding vector(1536),
  fetched_at timestamptz not null default now(),
  unique (opportunity_id, document_ref, chunk_no)
);
create index on market_opportunity_texts using hnsw (embedding vector_cosine_ops);

create table opportunity_searches (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  name text not null,
  filters jsonb not null,                       -- {naics:[], psc:[], keywords:[], excludeKeywords:[], setAsides:[], states:[], agencies:[], valueMinCents, valueMaxCents, dueWithinDays, noticeTypes:[], sources:['sam','sled']}
  is_active boolean not null default true,
  created_by uuid references users(id),
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table opportunity_matches (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  opportunity_id uuid not null references market_opportunities(id),
  search_id uuid references opportunity_searches(id) on delete set null,
  score smallint not null check (score between 0 and 100),
  reasons jsonb not null default '[]',          -- [{factor:'naics'|'set_aside'|'distance'|'value'|'due'|'past_performance'|'incumbent', weight, note}]
  status text not null default 'new' check (status in ('new','shown','saved','dismissed','pursuing','expired')),
  dismiss_reason text,
  first_seen_at timestamptz not null default now(),
  shown_at timestamptz, decided_at timestamptz, decided_by uuid,
  deal_id uuid references deals(id) on delete set null,
  unique (tenant_id, opportunity_id)
);
create index on opportunity_matches (tenant_id, status, score desc);
```

## 9. Bid workspace, pricing, quotes, drafts

```sql
create table bid_documents (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  kind text not null check (kind in ('solicitation','amendment','sow','pricing_schedule','wage_determination','qna','attachment','our_upload')),
  title text not null,
  source_url text,
  market_document_ref text,                     -- points at market_opportunity_texts.document_ref when public
  file_id uuid references files(id),            -- tenant uploads and downloaded copies
  page_count int,
  text_status text not null default 'pending' check (text_status in ('pending','ready','failed','unsupported')),
  created_at timestamptz not null default now()
);

create table bid_document_chunks (              -- text of tenant-uploaded documents (never shared)
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  document_id uuid not null references bid_documents(id) on delete cascade,
  chunk_no int not null, page_from int, page_to int,
  text text not null,
  embedding vector(1536),
  unique (document_id, chunk_no)
);

create table bid_requirements (                 -- compliance matrix rows
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  category text not null check (category in ('submission','technical','pricing','eligibility','certification','insurance','bonding','site_visit','evaluation','ai_use','wage','staffing','other')),
  text text not null,
  is_mandatory boolean not null default true,
  citation jsonb not null,                      -- {documentId, page, quote}  (required: no citation, no row)
  status text not null default 'open' check (status in ('open','met','not_met','not_applicable')),
  response_note text,
  owner_user_id uuid references users(id),
  run_id uuid,
  position int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table bid_deadlines (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  kind text not null check (kind in ('questions_due','site_visit','proposal_due','amendment_ack','award_expected','other')),
  at timestamptz not null,
  label text,
  citation jsonb,
  reminders_sent jsonb not null default '[]',   -- ['72h','24h','2h']
  created_at timestamptz not null default now()
);
create index on bid_deadlines (tenant_id, at);

create table submissions (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  method text not null check (method in ('email','portal','mail','hand','other')),
  submitted_at timestamptz not null,
  confirmation text,
  submitted_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table price_sheets (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  version int not null,
  status text not null default 'draft' check (status in ('draft','approved','superseded')),
  total_cents bigint not null default 0,
  margin_bps int,                               -- basis points
  assumptions text,
  created_by_type text not null check (created_by_type in ('user','bot')),
  created_by_id uuid,
  approved_by uuid, approved_at timestamptz,
  run_id uuid,
  created_at timestamptz not null default now(),
  unique (deal_id, version)
);

create table price_lines (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  price_sheet_id uuid not null references price_sheets(id) on delete cascade,
  kind text not null check (kind in ('labor','material','subcontract','equipment','travel','overhead','profit','other')),
  description text not null,
  quantity numeric(14,4) not null default 1,
  unit text not null default 'each',
  unit_cost_cents bigint not null,
  total_cents bigint not null,
  wage_ref jsonb,                               -- {wdNumber, revision, occupationCode, rateCents, fringeCents}
  quote_id uuid,                                -- when the line comes from a sub quote
  citation jsonb,
  position int not null default 0
);

create table award_comparables (                -- past awards used to sanity-check a price
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  award jsonb not null,                         -- {piid, recipient, agency, amountCents, awardedOn, naics, description, url}
  relevance_note text,
  run_id uuid,
  created_at timestamptz not null default now()
);

create table quote_requests (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  company_id uuid not null references companies(id),
  contact_id uuid references contacts(id),
  scope text not null,
  due_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','sent','replied','quoted','declined','no_response','canceled')),
  reply_token text not null unique,             -- used in the tracked reply address
  first_message_id uuid,
  followups_sent int not null default 0,
  next_followup_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  quote_request_id uuid references quote_requests(id) on delete set null,
  deal_id uuid not null references deals(id) on delete cascade,
  company_id uuid not null references companies(id),
  amount_cents bigint,
  valid_until date,
  scope_notes text,
  exclusions text,
  file_id uuid references files(id),
  parsed jsonb,                                 -- what the Bot extracted, with citations
  is_confirmed boolean not null default false,  -- a person checked the parsed numbers
  received_at timestamptz not null default now()
);

create table drafts (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  kind text not null check (kind in ('proposal','technical_approach','past_performance_volume','capability_statement','cover_letter','quote_letter','email','sms','other')),
  title text not null,
  content jsonb not null,                       -- TipTap JSON
  content_text text not null,
  version int not null default 1,
  parent_draft_id uuid references drafts(id),
  status text not null default 'draft' check (status in ('draft','in_review','approved','sent','archived')),
  is_ai_generated boolean not null default false,
  ai_disclosure jsonb,                          -- {models:[], runIds:[], sections:[]} for solicitations that require disclosure
  created_by_type text not null check (created_by_type in ('user','bot')),
  created_by_id uuid,
  run_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
```

## 10. Messaging

```sql
create table messages (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  direction text not null check (direction in ('out','in')),
  status text not null check (status in ('draft','awaiting_approval','queued','sent','delivered','bounced','failed','received','canceled')),
  provider text check (provider in ('gmail','graph','postmark','twilio')),
  provider_message_id text,
  from_address text, to_addresses jsonb not null default '[]', cc_addresses jsonb not null default '[]',
  reply_to text,                                -- tracked reply address for outbound
  subject text,
  body_text text, body_html text,
  thread_key text,                              -- groups a conversation (reply token or Message-ID chain)
  deal_id uuid references deals(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  quote_request_id uuid references quote_requests(id) on delete set null,
  approval_id uuid,
  draft_id uuid references drafts(id),
  sent_at timestamptz, error text,
  created_by_type text not null check (created_by_type in ('user','bot','system','external')),
  created_by_id uuid,
  created_at timestamptz not null default now()
);
create index on messages (tenant_id, deal_id, created_at desc);

create table inbound_emails (                   -- raw inbound from Postmark before routing
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  reply_token text,
  from_address text not null,
  subject text,
  text_body text, html_body text,
  headers jsonb, attachment_file_ids uuid[] not null default '{}',
  received_at timestamptz not null default now(),
  routed_message_id uuid references messages(id),
  routing_status text not null default 'pending' check (routing_status in ('pending','routed','unmatched','spam'))
);

create table suppressions (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  address citext not null,                      -- email or e164
  reason text not null check (reason in ('unsubscribe','hard_bounce','complaint','manual','do_not_contact')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, address)
);
```

## 11. Bots, runs, approvals, chat, memory

```sql
create table bots (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  key text not null check (key in ('assistant','bid_scout','bid_reader','estimator','sub_finder','proposal_writer','deadline_keeper','follow_up')),
  name text not null,                           -- shown to people, editable
  role_description text not null,
  instructions text,                            -- tenant's extra instructions
  model_tier text not null default 'standard' check (model_tier in ('fast','standard','deep')),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table bot_jobs (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  bot_id uuid not null references bots(id) on delete cascade,
  kind text not null check (kind in ('scan_opportunities','daily_digest','deadline_watch','quote_followups','award_watch','custom')),
  name text not null,
  schedule_cron text,                           -- in the tenant's timezone; null for event-driven jobs
  config jsonb not null default '{}',
  is_enabled boolean not null default true,
  last_run_at timestamptz, next_run_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on bot_jobs (next_run_at) where is_enabled;

create table tool_policies (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  bot_id uuid references bots(id) on delete cascade,   -- null = tenant default for the tool
  tool_key text not null,
  policy text not null check (policy in ('always_allow','needs_approval','off')),
  approved_unchanged int not null default 0,
  approved_edited int not null default 0,
  rejected int not null default 0,
  promotion_suggested_at timestamptz,
  set_by uuid references users(id),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, bot_id, tool_key)
);

create table threads (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  bot_id uuid not null references bots(id) on delete cascade,
  channel text not null default 'web' check (channel in ('web','telegram','sms')),
  title text,
  record_type text, record_id uuid,             -- context record, e.g. the deal the chat started from
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table thread_messages (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  thread_id uuid not null references threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','notice')),
  parts jsonb not null,                         -- AI SDK UI message parts
  run_id uuid,
  created_at timestamptz not null default now()
);
create index on thread_messages (thread_id, created_at);

create table agent_runs (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  bot_id uuid not null references bots(id),
  acting_user_id uuid references users(id),     -- permissions are this person's
  trigger text not null check (trigger in ('chat','job','event','automation','api','approval_resume')),
  trigger_ref text,                             -- thread id, job id, event id
  workflow_id text not null unique,             -- DBOS workflow id
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','succeeded','failed','canceled','limit_reached')),
  is_learning_mode boolean not null default false,
  input jsonb not null default '{}',
  output_summary text,
  error jsonb,
  steps int not null default 0, model_calls int not null default 0,
  tokens_in bigint not null default 0, tokens_cached bigint not null default 0, tokens_out bigint not null default 0,
  cost_micros bigint not null default 0,
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index on agent_runs (tenant_id, created_at desc);

create table agent_steps (                      -- append-only
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  run_id uuid not null references agent_runs(id) on delete cascade,
  seq int not null,
  kind text not null check (kind in ('model_call','tool_call','tool_result','approval_wait','note')),
  provider text, model text, tier text,
  tool_key text,
  args jsonb, result jsonb,                     -- truncated to 32 KB
  tokens_in int, tokens_cached int, tokens_out int,
  cost_micros bigint,
  latency_ms int,
  error jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

create table approvals (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  run_id uuid not null references agent_runs(id) on delete cascade,
  bot_id uuid not null references bots(id),
  tool_key text not null,
  effect text not null check (effect in ('internal','external')),
  title text not null,                          -- "Send quote request to ABC Cleaning"
  preview jsonb not null,                       -- render-ready: {kind:'email'|'sms'|'record_change'|'document'|'stage_change', ...}
  args jsonb not null,
  edited_args jsonb,
  status text not null default 'pending' check (status in ('pending','approved','edited','rejected','expired','canceled')),
  review_stage text not null default 'owner' check (review_stage in ('staff','owner')),  -- 'staff' for the managed plan
  assigned_staff_user_id uuid references users(id),
  requested_for_user_id uuid references users(id),
  short_code text,                              -- e.g. 'A7', unique among the user's pending approvals
  record_type text, record_id uuid,
  expires_at timestamptz not null,
  decided_by_type text check (decided_by_type in ('user','staff','system')),
  decided_by_id uuid,
  decided_via text check (decided_via in ('web','sms','telegram','email','api')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on approvals (tenant_id, status, created_at);
create unique index on approvals (tenant_id, requested_for_user_id, short_code) where status = 'pending';

create table memories (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,  -- null = about the business
  kind text not null check (kind in ('fact','preference','instruction')),
  text text not null,
  embedding vector(1536),
  source_run_id uuid,
  is_confirmed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on memories using hnsw (embedding vector_cosine_ops);
```

## 12. Channels and notifications

```sql
create table channel_bindings (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  channel text not null check (channel in ('telegram','sms','web_push')),
  address text not null,                        -- telegram chat id, e164 number, or push endpoint
  push_subscription jsonb,                      -- web push keys
  verified_at timestamptz,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, channel, address)
);

create table link_codes (
  code text primary key,                        -- random, 32+ chars for telegram deep links; 6 digits for SMS verification
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  channel text not null check (channel in ('telegram','sms')),
  address text,                                 -- phone number being verified
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0
);

create table inbound_channel_messages (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  channel text not null check (channel in ('telegram','sms')),
  external_id text not null,
  binding_id uuid references channel_bindings(id) on delete set null,
  text text,
  received_at timestamptz not null default now(),
  handled_as text check (handled_as in ('approval_reply','command','chat','unknown')),
  ref jsonb,
  unique (tenant_id, channel, external_id)
);

create table notifications (                    -- outbox
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('digest','approval','deadline','quote_received','run_finished','alert','billing','system')),
  channel text not null check (channel in ('email','sms','telegram','web_push','in_app')),
  payload jsonb not null,
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts int not null default 0,
  send_after timestamptz not null default now(),  -- quiet hours push this later
  sent_at timestamptz, provider_message_id text, error text,
  read_at timestamptz,                          -- in_app only
  created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key, channel)
);
create index on notifications (status, send_after) where status = 'pending';
```

## 13. Integrations

```sql
create table connections (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,  -- null = workspace-wide connection
  provider text not null check (provider in ('google','microsoft','hunter','leadmagic','millionverifier','slack','hubspot','salesforce')),
  purpose text not null check (purpose in ('send_email','calendar','enrichment','verification','chat','crm_sync')),
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  account_label text,                           -- e.g. the Gmail address
  scopes text[] not null default '{}',
  secret_id uuid references secrets(id) on delete set null,
  metadata jsonb not null default '{}',
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, provider, purpose)
);

create table oauth_states (
  state text primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  purpose text not null,
  code_verifier text not null,
  redirect_to text not null,
  expires_at timestamptz not null
);
```

## 14. Billing and usage

```sql
create table plans (                            -- global catalog
  key text primary key,                         -- 'trial','bid_desk','bid_desk_pro','managed','team','business'
  name text not null,
  price_cents bigint not null,
  billing_interval text not null check (billing_interval in ('month','year')),
  pricing_model text not null check (pricing_model in ('flat','per_seat')),
  stripe_price_id text,
  included jsonb not null,                      -- entitlement defaults, see BILLING.md
  features jsonb not null default '{}',         -- feature switches, e.g. {"managedReview":true,"sso":false}
  is_public boolean not null default true,
  position int not null default 0
);

create table subscriptions (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade unique,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  plan_key text not null references plans(key),
  status text not null check (status in ('trialing','active','past_due','canceled','unpaid','incomplete','paused')),
  seats int not null default 1,
  addons jsonb not null default '[]',           -- [{key, quantity, stripeItemId}]
  current_period_start timestamptz, current_period_end timestamptz,
  trial_end timestamptz, cancel_at timestamptz,
  updated_at timestamptz not null default now()
);

create table entitlements (
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  key text not null,                            -- see BILLING.md for the list
  limit_value bigint,                           -- null = unlimited
  source text not null check (source in ('plan','addon','override')),
  reset_period text not null default 'month' check (reset_period in ('month','none')),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table usage_events (                     -- append-only
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  key text not null,                            -- 'ai_runs','ai_cost','doc_pages','sms_segments','emails_sent','kontract_calls','enrichment_lookups','storage_bytes'
  quantity numeric(18,4) not null,
  cost_micros bigint not null default 0,        -- our cost, for margin reporting
  feature text,                                 -- 'chat','bid_reader','scan', ...
  bot_id uuid, run_id uuid, user_id uuid,
  provider text, model text,
  meta jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  stripe_reported_at timestamptz
);
create index on usage_events (tenant_id, occurred_at);
create index on usage_events (stripe_reported_at) where stripe_reported_at is null;

create table usage_counters (                   -- fast limit checks; incremented in the same transaction as usage_events
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  period_start date not null,                   -- first day of the billing period
  key text not null,
  used numeric(18,4) not null default 0,
  alerted_80_at timestamptz, alerted_100_at timestamptz, alerted_120_at timestamptz,
  primary key (tenant_id, period_start, key)
);

create table billing_events (                   -- Stripe webhook log; ops pool only
  stripe_event_id text primary key,
  type text not null,
  tenant_id uuid,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
```

## 15. Operations

```sql
create table impersonations (                   -- ops pool only
  id uuid primary key,
  staff_user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id) on delete cascade,
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table data_exports (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  requested_by uuid not null references users(id),
  status text not null default 'queued' check (status in ('queued','running','ready','failed','expired')),
  file_id uuid references files(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table tenant_deletions (                 -- ops pool only
  tenant_id uuid primary key references tenants(id) on delete cascade,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,           -- 30 days after request; cancelable until then
  completed_at timestamptz
);

-- Fair dispatcher fallback (only if DBOS queue partitioning is unavailable; see ARCHITECTURE §7.2). Worker-only tables, ops pool.
create table pending_work (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  queue text not null,
  workflow_name text not null,
  workflow_id text not null unique,
  args jsonb not null,
  enqueued_at timestamptz not null default now(),
  dispatched_at timestamptz
);
create index on pending_work (queue, dispatched_at, enqueued_at);

create table tenant_run_slots (
  tenant_id uuid not null references tenants(id) on delete cascade,
  queue text not null,
  running int not null default 0,
  max_running int not null,
  primary key (tenant_id, queue)
);
```

## 16. Later milestones (schema sketched, build in M8 and M9)

```sql
-- M8 outgoing webhooks
webhook_endpoints (id, tenant_id, url, secret_id, events text[], is_enabled, created_at)
webhook_deliveries (id, tenant_id, endpoint_id, event_id, status, attempts, last_status_code, next_attempt_at, created_at)

-- M9 automations
automations (id, tenant_id, name, trigger jsonb, conditions jsonb, steps jsonb, is_enabled, version, created_by, created_at, updated_at)
automation_runs (id, tenant_id, automation_id, version, trigger_event_id, status, step_results jsonb, started_at, finished_at)

-- M9 reports
reports (id, tenant_id, name, owner_user_id null=shared, layout jsonb, created_at, updated_at)
report_widgets (id, tenant_id, report_id, kind 'number'|'bar'|'line'|'table', query jsonb, position jsonb)
```

## 17. Seed data per new tenant

Created in one transaction by `tenants.createTenant()`:
1. `tenant_settings` row with defaults.
2. Pipelines "Bids" (`kind='bid'`, default) and "Sales" (`kind='sale'`) with the stages listed in §6.
3. The Bot team: one `bots` row per key, with names and role descriptions from [AGENT_RUNTIME.md](AGENT_RUNTIME.md).
4. Default `bot_jobs`: `scan_opportunities` every 4 hours on business days, `daily_digest` at `digest_hour`, `deadline_watch` (event-driven plus the global schedule), `quote_followups`, `award_watch` daily.
5. Default `tool_policies` (tenant-wide, `bot_id null`) from the tool catalog's default policy.
6. An empty `company_profiles` row.
7. `subscriptions` and `entitlements` for the `trial` plan.
