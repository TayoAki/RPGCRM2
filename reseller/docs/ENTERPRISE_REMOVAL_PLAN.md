# Plan: replacing Twenty's Enterprise-licensed code (v2)

**Goal:** a community edition where no file carries `/* @license Enterprise */`, users lose nothing they have today, and upstream syncs stay cheap.

**Status:** plan only. Settle option 1 in [LICENSING.md](LICENSING.md#enterprise-licensed-code) (ask Twenty) and get legal sign-off on the process below before step 2. This is not legal advice.

## What changed from v1

v1 assumed every Enterprise file had to be rewritten from scratch. Twenty's git history shows that many of them are relabeled AGPL code. Code that Twenty published under AGPL stays AGPL, so the last open-source version of each file is free to use. That changes the plan in four ways:

1. **Start from the last AGPL version (port, then fill gaps) wherever one exists**, instead of rebuilding from a blank page.
2. **Do the riskiest area first.** v1 left the record access policy for last.
3. **Prove parity by differential testing**: run today's build and the community build side by side and diff every response. v1 relied on a hand-written test suite.
4. **Automate "freeze on relabel"**, so future relabels cost nothing at sync time.

## Findings

### License history (full upstream history, 17,485 commits)

- The Enterprise license first appeared on 2024-10-21, with SSO.
- **At least 124 of the 576 files were AGPL when first written** and relabeled later. More were AGPL under older paths and then moved, like record sharing below.

| Area | Relabeled in | Last AGPL commit | Enterprise-only commits since |
|---|---|---|---|
| Record sharing and inherited readability | `eb8a96bdea` "Make record sharing an enterprise feature", 2026-09-16 | `172dbaee1a` | 30 |
| Validation rules | `539a4b3574` "Gate validation rules behind the Organization plan", 2026-10-12 | `bc506d4811` | 3 |
| Billing | `12cec01d80` "Update billing to EE", 2025-02-06 | `005762c240` | 251 |
| Row-level permissions | Enterprise from the start, except 4 files briefly AGPL in January 2026 (`c795b8c52a`, `9ee2cd0fe3`) | n/a | n/a |
| SSO, audit logs, usage, domains, key validation, signing-key rotation, custom AI providers | Enterprise from the start | n/a | n/a |

The record-sharing commit says it in its own words: record sharing "was AGPL like the rest of the engine". Its first step was a path move only. **So the code that enforces private and inherited readability has a complete AGPL version from six weeks ago, together with its AGPL integration tests.** That was v1's biggest risk; it's now a port.

### The interface (scratch copy with all 576 files deleted, upstream `f0ab542`)

- **Most files need no replacement.** Open-source code imports 278 of the files. The other 298, including 82 tests, are only used by each other and can be deleted.
- **The contract:** 311 symbols to provide. 81 are types or enums, 66 services, 64 functions, 24 guards/resolvers/jobs, 22 DTOs, 19 exceptions, 15 modules, 11 entities and 9 constants.
- **Who imports it:** 433 open-source files, of which 143 are tests and 5 are upgrade commands. 39 of the 278 modules are needed only by tests.
- **Errors:** 5,320 server type errors, all cascading from 962 missing imports. The frontend shows only 25.
- **Database:** only `WorkspaceEntity` (SSO providers) and `RoleEntity` (row-level predicates) point at Enterprise tables.
- **API:** the open-source frontend calls 19 Enterprise GraphQL operations (custom AI provider admin, Enterprise key screen, audit logs, 4 billing and usage fields).
- **Readability:** 12 standard objects depend on the access policy. Private to their owner: `agentChatThread`, `agentChatThreadParticipant`, `workflowRun`. Inherited from their parent record: notes, tasks, attachments, timeline activities, and the target objects.

## Policy by area

| Area | Source | Decision |
|---|---|---|
| Record access policy and readability | **Port AGPL `172dbaee1a`** | Must stay exact: it protects private AI chats and inherited records. |
| Record sharing beyond roles | Port AGPL `172dbaee1a` | Off by default. It can become a feature you offer, since the AGPL version has no Enterprise gate. |
| Validation rules | **Port AGPL `bc506d4811`** | Can stay on as a free feature. Only 3 commits of drift. |
| Entitlements, custom roles | Clean-room | Small. Custom roles must keep working. |
| Custom AI provider admin | Clean-room | Users have it today. Your version can drop the 25-user limit. |
| Email campaign tracking | Clean-room, or drop tracking | Campaigns via Resend work today. |
| Sign-in "available workspaces" type | Clean-room (declaration) | Part of every login. |
| Usage middleware and quota admission | Clean-room no-op | Never meters or refuses anything today. |
| Row-level permissions | Clean-room empty implementation; keep the tables | Off today. |
| Billing, usage caps, SSO, audit logs, custom domains, Enterprise key, signing-key rotation | Clean-room "not available" stubs, hide the UI | Off today. Billing types can come from AGPL `005762c240` if useful. |

## Process

### 0. Gates that may make this unnecessary (start now, in parallel)

- Email Twenty: ask for written confirmation, or a partner or reseller agreement.
- Brief a lawyer on the provenance rules below.
- Start only the tooling in step 1 until both answer. That tooling is useful even if you never switch: the differential harness also protects every upstream sync.

### 1. Tooling (open-source material only)

| Tool | What it does |
|---|---|
| `strip.sh` | Builds the tree without marked files, as a fresh repository with **no git history**. |
| `seam.py` | Typechecks the stripped tree and writes `seam.json` (module, symbols, kind, importers) plus the remaining error count. |
| `ancestors.py` | For each seam module, finds its last AGPL version, following moves via relabel-commit metadata. Writes a provenance manifest. |
| GraphQL contract check | Every operation the open-source frontend sends must resolve identically on the community schema. |
| **Differential harness** | Runs today's build (the black-box oracle, no key) and the community build on copies of the same seeded database. It replays a request corpus and diffs every response and every resulting database state. |

The harness's request corpus comes from:
- the upstream integration and end-to-end suites
- the AGPL-era readability tests
- generated queries: two users × every object × read, list, search, aggregate and nested relations, over GraphQL, REST and MCP

### 2. Build (stripped repository)

1. **Port first, riskiest first.** Restore the record-share and readability code from `172dbaee1a` and validation rules from `bc506d4811` into the stripped tree. Fix the interface drift the compiler reports, without using the Enterprise changes made since. The differential harness shows where behavior differs from today, for example a bug fixed after the relabel. Re-implement those differences from the observed behavior.
2. **Declarations and stubs** for the areas that were never AGPL, driven by `seam.json` until the error count is zero.
3. **Clean-room rebuilds:** entitlements, the AI provider admin, campaign tracking, the sign-in type.
4. **Triage the 143 open-source tests that import Enterprise code.** Keep the ones covering core behavior; delete the ones covering Enterprise features.

Provenance rules for the lawyer to approve:
- **Ported files** carry a header naming their AGPL source commit.
- **Clean-room files** are written only by people or agents who work in the stripped repository, with no network access to GitHub, and who have never seen the Enterprise code.
- **One auditor role** may see both sides. It runs a similarity check of new files against the Enterprise files and reports only scores, which go into the provenance manifest.

### 3. Verify

- Zero type errors.
- Upstream unit, integration and end-to-end suites green.
- GraphQL contract unchanged.
- **Zero unexplained differential diffs** with features off. Any intentional difference, such as validation rules staying free, is listed in the manifest.
- A security review of the access policy.
- Manual QA of sign-in, roles, AI settings, campaigns, and note/task/chat visibility.

### 4. Switch over and stay current

- `sync-upstream.sh` drops every marked file from vendor snapshots. **Freeze on relabel:** when a file that was AGPL in the previous snapshot arrives marked, the sync keeps the fork's AGPL version and flags it in the manifest. Future relabels then cost nothing at sync time; you just stop receiving upstream changes to that file.
- `check-license-boundary.sh` becomes absolute: no marked file anywhere under `packages/`.
- Delete the GHCR images built before the switch. Keep the repository private or publish a fresh history, since the current history contains the original files.

## Who does the work

| Work | Who |
|---|---|
| Steps 0 and 1 (tooling, archaeology, harness) | Agents, two or three in parallel. Clean-room rules don't apply because only AGPL code and black-box behavior are involved. |
| Step 2.1 (port and drift fixes) | One strong agent or engineer, with a human security review. |
| Step 2.2 (declarations and stubs) | 4 to 6 parallel agents, one per area, in the stripped repository only. |
| Step 2.3 (clean-room rebuilds) | Same agents as 2.2. |
| Similarity audit | A separate auditor agent, the only role allowed to see the Enterprise code. |
| Integration, gates and merge | One orchestrator, which doesn't write clean-room code. |

The compiler error count and the differential diff count are objective done signals. That's what makes parallel agents effective here. This session has read Enterprise code, so it can run steps 0 and 1 and orchestrate. It shouldn't write clean-room files or prompt implementers with Enterprise knowledge; implementer prompts are generated from `seam.json` and AGPL sources only.

## Effort (rough)

| Work | Estimate |
|---|---|
| Tooling, ancestors and differential harness | 4 to 6 days |
| Port record sharing and validation rules, fix drift | 4 to 7 days |
| Declarations and stubs | 3 to 5 days (agents, parallel) |
| Clean-room rebuilds | 3 to 5 days |
| Verification and security review | 4 to 5 days |

**Total:** about 3 to 5 weeks of senior effort; with agents in parallel, about 2 to 3 weeks elapsed. **Ongoing:** about a day per upstream release, thanks to freeze-on-relabel.

## Risks

- **The fork maintains frozen modules.** Twenty has relabeled four features in under two years (billing, row-level permissions, record sharing, validation rules), and the pace is increasing. Each relabel freezes another module that you then maintain alone, including security fixes. Re-evaluate the Enterprise subscription option yearly.
- **Fixes after the relabel.** The 30 Enterprise-only record-sharing commits may include bug or security fixes. The differential harness surfaces them as behavior diffs to re-implement clean-room.
- **Legal.** Relying on earlier AGPL versions and on interface reimplementation is standard but must be confirmed by counsel. Keep the provenance manifest.
- **Database compatibility.** Keep the 11 Enterprise tables (empty) so upstream migrations keep applying.
