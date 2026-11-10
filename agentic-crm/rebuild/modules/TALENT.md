# Module: Talent (find, hire and pay creators and freelancers)

Bots that find UGC creators, influencers and freelancers for social media content. They reach out with the deal and pay rate, negotiate within the customer's limits, send the agreement, review the work, and pay on approval. Built on the same engine as the bid module: sourcing, scoring, outreach with tracked replies, approvals, Bots and billing. This file adds what is specific to talent. It uses the names in [../DATA_MODEL.md](../DATA_MODEL.md) and the rulings in [../ARCHITECTURE.md §15](../ARCHITECTURE.md#15-rulings-across-the-specs). Where it changes a spine rule, it says so in §13.

Research behind it: [`../../research_notes/Talent module/`](../../research_notes/Talent%20module/).

## 1. Who it's for

| Customer | Job | Example |
|---|---|---|
| Social media agencies and done-for-you services | Keep a bench of designers, editors and UGC creators busy across many clients | 20 UGC videos a month for 8 clients, plus 2 editors |
| Brands and app companies running UGC or creator campaigns | Find creators who fit, get videos made, use them in ads | 30 TikTok videos for a skincare app, 90 days of paid usage |
| Any Magpie workspace that needs content | Occasional posts, a promo video, a logo | A janitorial company needs 4 before-and-after reels |

The module is sold as an add-on to any plan and as part of a **Content** plan (§11). It doesn't change the bid product.

## 2. What it does, end to end

```
Brief  ->  Source  ->  Score  ->  Shortlist  ->  Invite  ->  Replies and negotiation
   ->  Offer  ->  Agreement  ->  Onboarding (tax form, payout account, shipping)
   ->  Production (drafts, review, revisions)  ->  Approval  ->  Payment
   ->  Usage rights tracking  ->  Rating and rehire
```

1. **Brief.** The person describes the work in plain words or pastes a campaign link. The Talent Scout turns it into a structured brief with these parts, and the person checks and saves it:
   - deliverables, with platform, count, length, aspect ratio, hooks and raw footage
   - creative direction
   - who to hire (niche, location, language, follower range, self-described traits)
   - pay model and rate limits
   - usage rights, exclusivity, timeline, revisions, product seeding, disclosure rules
2. **Source.** The Scout searches four places, in this order:
   - the workspace's own talent pool (people hired or talked to before);
   - the licensed discovery provider (§9);
   - marketplace search where the marketplace allows it;
   - applications from the brief's public apply page.
3. **Score.** Each candidate gets a score from 0 to 100 with reasons:
   - niche fit;
   - content style match (the Scout reviews recent posts);
   - audience fit and engagement quality from provider data;
   - fake-follower risk;
   - the rate against the budget;
   - location and language;
   - past performance with this workspace.
4. **Shortlist.** The person approves or skips candidates, or lets the Scout shortlist the top N.
5. **Invite.** The Recruiter drafts one personal invite per candidate. Each states the deliverables, pay, usage rights and timeline, with a link to accept, counter or decline. Invites go out in a batch after one approval (§13 ruling T1), through allowed channels only (§9).
6. **Replies and negotiation.** Replies come back through tracked reply addresses and the creator portal. The Recruiter reads each one: interested, counteroffer (with the amount), question, or decline. It answers questions from the brief. It drafts counters only inside the floor and ceiling the person set. Anything outside those limits goes to the person.
7. **Offer and agreement.** On a yes, Magpie writes the offer and the agreement from the workspace's template: deliverables, pay schedule, usage rights, disclosure duty, revisions, kill fee. The creator signs in the portal.
8. **Onboarding.** The creator adds a tax form and a payout account through the payout provider (§10), and a shipping address if product is sent.
9. **Production.** The creator uploads drafts in the portal. The Content Reviewer checks each one against the brief and the rules (§7). The person approves or asks for changes. Revision rounds are counted against the agreement.
10. **Payment.** Approved work creates a payout. The owner or an admin approves every payment. Money never moves without a person's yes.
11. **Rights and rehire.** Usage-rights end dates get reminders. Ad codes (TikTok Spark codes, Meta partnership ad permissions) are stored. After the job, the person rates the creator, and good ones rank higher for the next brief.

## 3. Bots

New `bots.key` values: `talent_scout`, `recruiter`, `content_reviewer`. The Assistant can start their work from chat.

| Bot | Role (seeded `role_description`) | Triggers | Tier |
|---|---|---|---|
| Talent Scout | "I turn your request into a clear brief, find creators and freelancers who fit it, and explain why each one fits." | brief created or changed; "find more"; nightly refresh of open briefs | `standard`; `fast` for scoring; vision through `standard` |
| Recruiter | "I invite the people you pick, answer their questions, negotiate inside your limits and send offers and agreements for your approval." | shortlist approved; reply received; follow-up due; offer accepted | `standard` |
| Content Reviewer | "I check each draft against the brief and the rules and tell you what's right and what needs changes." | deliverable submitted | `standard` with vision; transcription through the media pipeline (§8) |

## 4. Tools

Same conventions as AGENT_RUNTIME.md: dot-namespaced keys, zod args, effect, default policy, permission. **External tools are locked to needs_approval.** **Money tools can never earn autonomy**, and only owners and admins can approve them.

| Key | Bots | Effect | Default policy | What it does |
|---|---|---|---|---|
| `talent.build_brief` | Scout | internal | needs_approval | Structured brief from plain words or a link |
| `talent.search_pool` | Scout | read | always_allow | Search the workspace's talent pool |
| `talent.discover` | Scout | read (metered) | always_allow | Search the discovery provider with brief filters; caches results per workspace |
| `talent.analyze_profile` | Scout | read (metered) | always_allow | Pull recent posts and stats for one candidate; summarize style; fake-follower risk |
| `talent.score_candidates` | Scout | internal | always_allow | Score and rank candidates with reasons (scoring in code, §6) |
| `talent.shortlist` | Scout | internal | needs_approval | Move the top candidates to shortlisted |
| `talent.draft_invites` | Recruiter | internal | always_allow | Personal invite drafts for shortlisted candidates |
| `talent.send_invites` | Recruiter | external | needs_approval (locked) | Send a batch of invites (one approval, every message shown) |
| `talent.parse_reply` | Recruiter | internal | always_allow | Classify a reply and extract counter amounts and questions, with quotes |
| `talent.send_message` | Recruiter | external | needs_approval (locked) | Answer, counter (inside limits), follow up, or ask for changes |
| `talent.draft_offer` | Recruiter | internal | always_allow | Offer from the brief and the agreed rate; totals computed in code |
| `talent.send_offer` | Recruiter | external | needs_approval (locked) | Send the offer and agreement link |
| `talent.review_deliverable` | Content Reviewer | internal | always_allow | Run the checks in §7 and record results with timestamps or frames |
| `talent.recommend_decision` | Content Reviewer | internal | always_allow | Recommend approve or changes, with reasons; the person decides |
| `payments.request_payout` | Recruiter | external (money) | needs_approval (locked; owner or admin) | Create a payout for approved work |

Hard rules in code, not prompts:
- A counter or offer outside the brief's `rate.floorCents` and `rate.maxCents` is refused with `outside_rate_limits`.
- No invite to a `do_not_contact` talent, a suppressed address, or anyone marked under 18.
- At most one follow-up per invite by default (creators get a lot of spam).
- Daily outreach caps per workspace from entitlements (§11).

## 5. Data model

Standard tenant tables (RLS template, `tenant_id` first in indexes). Add `talent` to the polymorphic `record_type` list so activities, notes, tags and files can link to it.

```sql
create table talent (                            -- a creator or freelancer, per workspace
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  kind text not null check (kind in ('ugc_creator','influencer','video_editor','designer','copywriter','social_manager','photographer','other')),
  display_name text not null,
  legal_name text,
  emails jsonb not null default '[]',            -- [{address, source:'provider'|'creator'|'marketplace'|'manual', isPrimary}]
  phone_e164 text,
  country char(2), region text, city text,
  languages text[] not null default '{}',
  handles jsonb not null default '[]',           -- [{platform:'tiktok'|'instagram'|'youtube'|'x'|'linkedin'|'behance'|'other', handle, url, followers, engagementRate, avgViews, updatedAt, source}]
  niches text[] not null default '{}',
  self_description jsonb not null default '{}',  -- traits the creator chose to share for casting; never inferred
  audience jsonb,                                -- provider audience data (countries, age bands), with source and date
  rate_card jsonb not null default '[]',         -- their stated rates: [{deliverable, platform, priceCents, notes}]
  portfolio jsonb not null default '[]',         -- [{url, kind, title}]
  source text not null check (source in ('pool','discovery','marketplace','inbound','import','manual','referral')),
  provider_refs jsonb not null default '{}',     -- {modash: 'id', upwork: 'id'}
  status text not null default 'prospect' check (status in ('prospect','contacted','in_talks','active','paused','do_not_contact')),
  is_age_confirmed_18 boolean not null default false,
  rating numeric(2,1),                           -- 1.0 to 5.0, from this workspace's jobs
  jobs_completed int not null default 0,
  last_hired_at timestamptz,
  custom jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(handles::text,''))) stored
);
create index on talent using gin (search);
create index on talent using gin (niches);

create table talent_briefs (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('ugc_campaign','influencer_campaign','freelance_job')),
  client_company_id uuid references companies(id),  -- for agencies: whose content this is
  deliverables jsonb not null,                   -- [{type:'video'|'image'|'carousel'|'post'|'edit'|'design'|'copy', platform, count, lengthSec, aspect, hooks, rawFootage}]
  creative_direction text,
  requirements jsonb not null default '{}',      -- {niches, countries, languages, followerMin, followerMax, selfDescription, mustHave:[]}
  rate jsonb not null,                           -- {model:'per_deliverable'|'flat'|'hourly', targetCents, floorCents, maxCents}
  budget_cents bigint,
  usage_rights jsonb not null,                   -- {organic, paidAds, durationDays, whitelisting, exclusivityDays, territories}
  timeline jsonb not null,                       -- {startBy, dueAt, turnaroundDays}
  revisions_included int not null default 1,
  product_seeding jsonb,                         -- {product, valueCents, shipFrom}
  disclosure jsonb not null default '{"required":true}',
  slots int not null default 1,                  -- how many people to hire
  status text not null default 'draft' check (status in ('draft','sourcing','outreach','in_production','completed','canceled')),
  apply_token text unique,                       -- public apply page; null when closed
  created_by uuid references users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table talent_candidates (                 -- one row per person per brief
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  brief_id uuid not null references talent_briefs(id) on delete cascade,
  talent_id uuid not null references talent(id) on delete cascade,
  score smallint check (score between 0 and 100),
  reasons jsonb not null default '[]',
  status text not null default 'suggested' check (status in (
    'suggested','shortlisted','skipped','invited','replied','negotiating','offer_sent','accepted','declined','no_response','hired')),
  offered_rate_cents bigint, counter_rate_cents bigint,
  reply_token text not null unique,              -- tracked reply address q-style, same format as quote_requests
  last_contact_at timestamptz, next_followup_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (brief_id, talent_id)
);

create table talent_offers (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  candidate_id uuid not null references talent_candidates(id) on delete cascade,
  version int not null,
  terms jsonb not null,                          -- deliverables, rate, total, usage, timeline, revisions, paymentSchedule, killFeePct
  total_cents bigint not null,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','sent','countered','accepted','declined','expired','withdrawn')),
  portal_token text unique,
  sent_at timestamptz, responded_at timestamptz, expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (candidate_id, version)
);

create table talent_agreements (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  offer_id uuid not null references talent_offers(id),
  talent_id uuid not null references talent(id),
  template_version text not null,
  file_id uuid references files(id),             -- the signed PDF
  method text not null check (method in ('clickwrap','esign')),
  provider_ref text,
  status text not null default 'sent' check (status in ('sent','signed','voided')),
  signed_at timestamptz, signed_name text, signer_ip inet,
  created_at timestamptz not null default now()
);

create table talent_assignments (                -- a hired person on a brief
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  brief_id uuid not null references talent_briefs(id) on delete cascade,
  talent_id uuid not null references talent(id),
  agreement_id uuid references talent_agreements(id),
  status text not null default 'onboarding' check (status in ('onboarding','active','delivered','approved','paid','canceled')),
  total_cents bigint not null,
  revisions_used int not null default 0,
  due_at timestamptz,
  shipping jsonb,                                -- {address, carrier, tracking, deliveredAt}
  rating smallint check (rating between 1 and 5), rating_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table deliverables (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  assignment_id uuid not null references talent_assignments(id) on delete cascade,
  type text not null, platform text,
  spec jsonb not null,                           -- copied from the brief line
  status text not null default 'pending' check (status in ('pending','submitted','in_review','changes_requested','approved','rejected')),
  revision_round int not null default 0,
  due_at timestamptz,
  file_ids uuid[] not null default '{}',
  review jsonb,                                  -- [{check, result:'pass'|'fail'|'unsure', evidence:{atSec|frame|quote}, note}]
  posted_url text,
  ad_code text,                                  -- Spark code or partnership-ads permission id
  usage_expires_on date,
  submitted_at timestamptz, approved_at timestamptz, approved_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table talent_payments (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  assignment_id uuid not null references talent_assignments(id),
  talent_id uuid not null references talent(id),
  kind text not null check (kind in ('upfront','milestone','final','bonus','kill_fee','reimbursement')),
  amount_cents bigint not null,
  currency char(3) not null default 'USD',
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval','approved','processing','paid','failed','canceled')),
  provider text not null,                        -- see §10
  provider_ref text,
  approval_id uuid,
  approved_by uuid, paid_at timestamptz, error text,
  created_at timestamptz not null default now()
);

create table talent_payout_accounts (
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  talent_id uuid not null references talent(id) on delete cascade,
  provider text not null,
  account_ref text not null,
  status text not null default 'pending' check (status in ('pending','active','restricted','disabled')),
  tax_form text check (tax_form in ('w9','w8ben','w8bene','none')),
  tax_form_status text not null default 'missing' check (tax_form_status in ('missing','submitted','verified')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, talent_id, provider)
);

create table talent_applications (               -- from a brief's public apply page
  id uuid primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  brief_id uuid not null references talent_briefs(id) on delete cascade,
  payload jsonb not null,                        -- name, email, handles, rate, portfolio, age confirmation
  talent_id uuid references talent(id),         -- set after dedupe
  status text not null default 'new' check (status in ('new','matched','rejected','spam')),
  created_at timestamptz not null default now()
);

create table portal_tokens (                     -- magic links for creators; they are not workspace users
  token_hash text primary key,
  tenant_id uuid not null default app_tenant_id() references tenants(id) on delete cascade,
  talent_id uuid not null references talent(id) on delete cascade,
  scope text not null check (scope in ('offer','agreement','upload','payout','messages')),
  ref_id uuid not null,                          -- the offer, agreement or assignment
  expires_at timestamptz not null,
  used_at timestamptz
);

create table rate_benchmarks (                   -- global; seeded from research, edited by ops
  id uuid primary key,
  kind text not null,                            -- 'ugc_video','influencer_post','video_edit','design','usage_paid_ads', ...
  platform text, tier text, unit text not null,  -- tier e.g. 'nano','micro'; unit e.g. 'per_video','per_hour','per_30_days'
  p25_cents bigint, p50_cents bigint, p75_cents bigint,
  source text not null, as_of date not null
);
```

Resolver functions for the public portal (security definer, like DATA_MODEL §2.2): `portal_token_target(token_hash text)` and `brief_for_apply_token(token text)`.

## 6. Scoring (in code)

`scoreTalent(brief, talent, providerStats, history) -> {score, reasons}`:

| Factor | Weight | Notes |
|---|---|---|
| Niche and content fit | 30 | Niche overlap, plus the Scout's style summary of recent posts against the creative direction |
| Rate fit | 20 | Stated or estimated rate against the brief's target, floor and ceiling |
| Audience and engagement quality | 15 | Engagement rate against benchmarks for the tier; audience country and language match. UGC-only briefs (content for the brand's ads) weight this down to 5 |
| Fake-follower risk | 10 | From the provider; high risk caps the score at 40 |
| Past performance here | 15 | Rating, on-time delivery, revision count |
| Location, language, availability | 10 | Hard filters for must-haves |

Never infer protected traits (age, race, gender, health) from images or text. Casting filters use only `self_description` fields the creator chose to share.

## 7. Content review checks

Run by the Content Reviewer on each submitted draft. Every check returns pass, fail or unsure, with evidence: a timestamp, a frame or a quote.

| Check | How |
|---|---|
| Specs: length, aspect ratio, resolution, file type | ffprobe in the media pipeline (§8) |
| Hook in the first 3 seconds matches the brief's hooks | transcript plus first-frames summary |
| Required mentions and product shown | transcript and sampled frames through a vision model |
| Prohibited claims (health, earnings, "guaranteed") | transcript against the workspace's banned-claims list and an FTC rule list |
| Disclosure on posts to the creator's own channels ("#ad", "Paid partnership" label) | caption check; the posted URL is checked after posting |
| Music and third-party logos or likeness | flag for a person when commercial music or other brands appear; never auto-pass |
| Brand guidelines | the workspace's guideline text against the transcript and frames |

The person always makes the final call. The Reviewer recommends.

## 8. Media pipeline

- Uploads go straight to R2 through presigned PUTs from the creator portal, up to 2 GB per file, then through the ClamAV scan.
- The worker image adds `ffmpeg` and `ffprobe` to read specs, sample frames (1 per second for the first 5 seconds, then 1 every 3 seconds) and extract audio.
- Transcription runs through the LLM gateway's audio support, or a transcription provider behind the `Transcriber` port. It is metered as `media_minutes`.
- Previews: a 720p proxy for review in the browser. The original files are kept for delivery.

## 9. Sourcing and outreach channels

<!-- filled from research_notes/Talent module/sourcing_and_outreach.md -->

## 10. Agreements and payouts

<!-- filled from research_notes/Talent module/rates_contracts_payouts.md -->

## 11. Plans, entitlements and metering

<!-- filled after §9 and §10 -->

## 12. Screens and routes

| Route | Screen | Notes |
|---|---|---|
| `/talent` | Talent home | Open briefs, people waiting on you (shortlists, replies, drafts to review, payments to approve) |
| `/talent/briefs/new` | New brief | Plain-words box or a pasted campaign link, then the structured form for checking |
| `/talent/briefs/$briefId` | Brief | Tabs: Brief, Candidates (kanban by status), Messages, Hired, Deliverables, Payments |
| `/talent/pool` | Talent pool | Table with filters (kind, niche, platform, followers, rate, rating, status), saved views |
| `/talent/people/$talentId` | Person | Profile, handles and stats with source and date, rate card, history, timeline, notes |
| `/talent/review` | Review queue | Submitted drafts with the Reviewer's checks; approve or ask for changes |
| `/talent/payments` | Payments | Awaiting approval, processing, paid; export for bookkeeping |
| `/settings/talent` | Talent settings | Agreement template, banned claims, brand guidelines, default usage terms, payout setup |

Creator portal (public, no Magpie account; magic links from `portal_tokens`, rate limited, `noindex`):

| Route | What the creator does |
|---|---|
| `/c/apply/$applyToken` | Apply to a brief: name, email, handles, rate, samples, confirm 18 or older |
| `/c/offer/$token` | See the offer; accept, counter with an amount and note, or decline |
| `/c/agreement/$token` | Read and sign the agreement |
| `/c/payout/$token` | Add a tax form and payout account through the provider's hosted onboarding |
| `/c/upload/$token` | Upload drafts and finals, see requested changes, message the team |

The portal shows the workspace's name and logo, never other workspaces or other creators.

## 13. Rulings this module adds

| # | Ruling |
|---|---|
| T1 | **Batch outreach approval.** One approval of kind `batch_outreach` may cover up to 50 invites from one brief. Every message is shown and can be edited or removed before approving. Only owners and admins can approve it. This is one approval covering a listed set, not bulk approval of separate approvals, so PRD FR-APR-3 still holds. |
| T2 | **Money is never autonomous.** `payments.*` tools can't be set to always allow and can't be suggested for earned autonomy. Owners and admins approve every payout. |
| T3 | **Negotiation limits are code.** Counters and offers outside `rate.floorCents` to `rate.maxCents` are refused before an approval is created. |
| T4 | **18 or older only in v1.** Apply and offer flows require age confirmation. Anyone marked under 18 can't be contacted. |
| T5 | **No scraping and no automated DMs.** Contact happens only through licensed provider contacts, marketplace APIs that allow it, creator-supplied details, or the public apply link the customer shares. |
| T6 | **New `bots.key` values:** `talent_scout`, `recruiter`, `content_reviewer`. New polymorphic `record_type`: `talent`. New approval preview kinds: `batch_outreach`, `offer`, `payout`. New notification kinds: `talent_reply`, `deliverable_submitted`, `payout_due`. |

## 14. Requirements and acceptance criteria

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-TAL-1 | Create a brief from plain words or a campaign link; the Scout fills the structured fields. | Every field the Scout fills shows where it came from. The person saves the brief before sourcing starts. |
| FR-TAL-2 | Find candidates from the pool, the discovery provider, marketplaces and applications. | 50 or more candidates for a common brief (for example, US skincare UGC) within 5 minutes, with stats dated and sourced. |
| FR-TAL-3 | Score and explain each candidate (§6). | Three or more reasons per candidate. Protected traits are never inferred (eval). |
| FR-TAL-4 | Shortlist and invite in a batch with one approval (T1). | Invites go out only after approval, each with a working accept, counter and decline link and an unsubscribe line. |
| FR-TAL-5 | Read replies and negotiate within limits (T3). | Reply classification at least 95% correct on the fixture set. Counter amounts are extracted exactly. Nothing goes outside the limits (property test). |
| FR-TAL-6 | Offer, agreement and signature in the portal. | The signed PDF is stored, with name, time and IP. The offer can't be changed after acceptance; a change needs a new version. |
| FR-TAL-7 | Onboarding: tax form, payout account, shipping. | The payout can't be approved until the account is active and the tax form is submitted. |
| FR-TAL-8 | Draft review with checks and evidence (§7). | Each check shows evidence. Revision rounds over the agreement's limit warn the person. |
| FR-TAL-9 | Pay on approval (T2). | Each payout needs owner or admin approval. Duplicate payouts are impossible (idempotency key per payment). |
| FR-TAL-10 | Track usage rights and ad codes, with reminders 14 and 3 days before rights expire. | Reminders arrive on the channels set up in the workspace. |
| FR-TAL-11 | Rate and rehire. | Ratings update `talent.rating`. Past performers rank first for similar briefs. |
| FR-TAL-12 | Do-not-contact and opt-outs. | An unsubscribe or a "no thanks" sets `do_not_contact` and blocks future outreach from that workspace. |

## 15. Build milestone M11 (3 to 4 weeks, after M6)

1. Tables in §5 with RLS and isolation fixtures; the new enum values from T6.
2. The discovery provider adapter and the marketplace adapter behind `TalentSource` (§9), with recorded fixtures.
3. Scout tools and `scoreTalent` with unit tests; brief builder.
4. Recruiter: invites through tracked reply addresses (reuses `messages`, `inbound_emails` routing and suppressions), the batch approval preview, reply parsing, negotiation limits, follow-ups.
5. Creator portal routes, magic links, rate limits, the apply page.
6. Agreements: template rendering to PDF (Gotenberg), signature (§10).
7. Payouts: provider onboarding links, payout creation after approval, provider webhooks (§10).
8. Media pipeline: ffmpeg in the worker image, transcription, frame sampling, the Reviewer checks and the review queue.
9. Usage-rights reminders; ratings and rehire ranking.
10. Evals:
    - reply classification and counter extraction (200 labeled replies);
    - review checks on 30 sample videos with known issues;
    - a protected-trait inference red-team set (must refuse 100%).

**Done when:** in staging, a brief for 5 UGC videos finds 50 or more candidates. Ten invites go out in one approval. A test creator counters inside the limits and accepts, then signs, onboards a test payout account and uploads a draft. The Reviewer flags a missing disclosure, the creator re-uploads, the person approves, and a test payout completes.
