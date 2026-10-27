# Plan: replacing Twenty's Enterprise-licensed code

**Goal:** a community edition where no file carries `/* @license Enterprise */`, users lose nothing they have today, and upstream syncs stay cheap.

**Status:** plan only. Nothing here has been implemented. Get legal sign-off on the clean-room process (step 2) before starting. This is not legal advice.

## What the measurements say

All numbers come from a scratch copy of this repo with all 576 marked files deleted and the compiler run on what's left (Twenty upstream `f0ab542`).

- **Most files need no replacement.** Open-source code imports 278 of the 576 files directly. The other 298, including 82 tests, are only used by each other and can simply be deleted.
- **The contract is small and precise.** The 278 missing modules must export 311 symbols:

  | Symbols | Kind |
  |---:|---|
  | 81 | types and enums |
  | 66 | services |
  | 64 | functions |
  | 24 | guards, resolvers, controllers, jobs and handlers |
  | 22 | DTOs |
  | 19 | exceptions |
  | 15 | NestJS modules |
  | 11 | entities |
  | 9 | constants |

- **Errors cascade from a small root.** The server shows 5,320 type errors, all traced back to 962 missing imports. The frontend shows only 25.
- **Who imports it:** 433 open-source files. Of those, 143 are tests and 5 are upgrade commands. 39 of the 278 modules are needed only by open-source tests.
- **Database:** only two open-source entities point at Enterprise tables. `WorkspaceEntity` links to SSO providers, and `RoleEntity` links to row-level predicates.
- **API:** the open-source frontend calls 19 Enterprise-defined GraphQL operations. They cover the custom-AI-provider admin screen, the Enterprise key screen, audit logs, and 4 billing and usage fields.
- **No shipped data:** no standard role, app or SDK manifest ships validation rules or row-level predicates.

**The critical finding.** The record-share access-policy code enforces object readability for everyone, with or without a key. Twelve standard objects depend on it:

| Readability | Objects |
|---|---|
| Private to their owner | `agentChatThread`, `agentChatThreadParticipant`, `workflowRun` |
| Inherited from their parent record | `agentChatThreadTarget`, `attachment`, `calendarEventTarget`, `messageThreadTarget`, `note`, `noteTarget`, `task`, `taskTarget`, `timelineActivity` |

Stubbing this out would let users read each other's AI chats and see notes on records they can't access. It has to be rebuilt faithfully, and it's the hardest part of the job.

## The approach: compile-driven clean-room replacement

1. **Let the compiler write the spec.** Delete the files. The missing symbols, their types and their call sites in open-source code are the complete interface spec. Nobody needs to read Twenty's Enterprise code to know what to build.
2. **Make the clean room physical.** Implementers work in a repository created from the stripped tree **with no git history**. The Enterprise code can't be read there, even by accident. Behavior specs come only from open-source code, open-source tests, and black-box observation of the running app.
   - This session has read parts of the Enterprise code while documenting it. The replacements should therefore be written by fresh sessions or people who have only ever seen the stripped repository.
   - Keep a log of who saw what.
3. **Replace at the same paths.** Community files go exactly where the removed files were. The 433 importing files stay untouched, so upstream merges don't conflict. Each file starts with a community-edition AGPL header.
   - I rejected TypeScript path aliases. They would need matching configuration in tsc, SWC, Jest, Vite and Nx, and that breaks quietly.
4. **Default to "feature off".** Rebuild only what users actually get today; see the policy table below.
5. **Prove parity with gates, not reviews.** A build ships only if all four pass:
   - zero type errors
   - the upstream test suites pass (minus Enterprise tests)
   - the GraphQL contract the frontend uses is unchanged
   - a black-box characterization suite passes on both today's build and the community build

## Policy by area

| Area | Decision | Why |
|---|---|---|
| Record access policy (object readability) | **Rebuild faithfully** | Protects private and inherited objects for every user. Highest risk. |
| Entitlement checks | Rebuild (small) | Custom roles must keep working. |
| Custom AI provider admin (8 operations) | Rebuild | Free today for instances with 25 users or fewer, and the admin screen is open-source. Your version can drop the seat limit. |
| Email campaign open/click tracking | Rebuild, or drop tracking | Campaigns via Resend work today with tracking. |
| Sign-in "available workspaces" type | Rebuild (declaration) | It's part of every login response. |
| Usage middleware and quota admission | No-op | Never meters or refuses anything today. |
| Row-level permissions and validation rules | Empty implementations; keep their tables | Needed to compile and to keep the database compatible. Both are off today. |
| Record sharing beyond roles | Off | Never enabled without a key. |
| Stripe billing, usage caps and analytics, SSO, audit logs, custom domains, Enterprise key screen, signing-key rotation, app billing | Off: declarations only, any call returns "not available", hide the UI | All off today. You could build your own signing-key rotation later. |
| Upgrade commands 2-4 and 2-43 | Keep compiling; no-op the billing and sharing parts | They only run on installs upgrading from old versions. Yours start current. |

## Steps

### 0. Tooling and baselines (open-source material only)

- `reseller/community/strip.sh`: builds the stripped tree from the current vendor snapshot.
- `reseller/community/seam.py`: typechecks the stripped tree and writes `seam.json` (module, symbols, kind, importers), plus the remaining error count as a progress meter.
- **GraphQL contract:** dump the schema from today's server and check every operation the open-source frontend sends against it.
- **Characterization suite:** black-box API tests written now and passing on today's build. They cover:
  - the readability matrix: two users, every private and inherited object, read, list and search
  - custom roles
  - sign-in
  - the AI provider admin screen
  - sending an email campaign

### 1. Clean-room build (stripped repository, separate implementers)

Work in this order, driving the error count to zero:

1. **Declarations.** Types, enums, DTOs, exceptions, constants, modules and entities. Entity table and column names come from the open-source migrations.
2. **Feature-off implementations** for the "off" areas.
3. **Rebuilds:** entitlements, the sign-in type, the AI provider admin, campaign tracking.
4. **Record access policy, last.** The characterization suite is its acceptance test.

Triage the 143 open-source tests that import Enterprise code:
- Keep those that test core behavior; they become parity tests.
- Delete those that test Enterprise features.

### 2. Verify

- Zero type errors.
- Upstream unit, integration (with database) and end-to-end suites green.
- GraphQL contract unchanged.
- Characterization suite green on both builds.
- A security review of the access-policy code.
- Manual QA of sign-in, roles, AI settings, campaigns, and note/task visibility.

### 3. Switch over

- Make `sync-upstream.sh` exclude every marked file from vendor snapshots. The list is computed at each sync, so new Enterprise files never enter the repository.
- Make `check-license-boundary.sh` absolute: no marked file anywhere under `packages/`.
- Delete the GHCR images built before the switch; they contain Enterprise code.
- Handle git history: it still contains the original files. Either keep the repository private or publish a fresh history. The `/source-code` archive is built from the working tree, so it's clean automatically.

### 4. Every upstream sync after that

- Changed or new seams show up as type errors and in the `seam.json` diff.
- Update the matching community files, then rerun the gates.

## Effort (rough estimate)

| Work | Estimate |
|---|---|
| Tooling and baselines | 2 to 3 days |
| Characterization suite | 4 to 5 days |
| Declarations | 2 to 4 days |
| Feature-off implementations | 4 to 6 days |
| Entitlements, sign-in, AI provider admin, campaign tracking | 5 to 8 days |
| Record access policy | 1.5 to 3 weeks |
| Verification and security review | 3 to 4 days |

**Total:** about 6 to 9 weeks for one senior engineer. Agents can do much of the mechanical work in parallel. The access policy, review and legal process set the real timeline.

**Ongoing:** 1 to 3 days per upstream release, more when Twenty changes record sharing. They are actively developing it; versions 2.43 and 2.45 both ship upgrade commands for it.

## Risks

- **Privacy regression in the access policy.** Mitigate with the characterization matrix and a security review before switching.
- **Upstream moving more core code behind the marker.** The cost per sync grows. The seam diff makes this visible at each sync, so it can't creep in silently.
- **Legal.** Reimplementing an interface that the open-source callers dictate is generally defensible, but get a lawyer to approve the clean-room process before step 1, not after.
- **Database compatibility.** Keep the 11 Enterprise tables (empty) so upstream migrations keep applying.
