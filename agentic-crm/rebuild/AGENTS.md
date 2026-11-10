# AGENTS.md

Instructions for AI coding agents building Magpie. Copy this file to the repository root (and as `CLAUDE.md` if your tool reads that name).

## What you are building

Magpie is a multi-tenant SaaS CRM for small contractors who bid public work. Its Bots find bids, read the documents, price the job, chase subcontractor quotes and draft proposals. The owner approves everything by text. The full spec is in `docs/spec/`.

Read in this order before writing code:
1. `docs/spec/PRD.md`: what and why
2. `docs/spec/ARCHITECTURE.md`: how, and the stack
3. `docs/spec/DATA_MODEL.md`: every table
4. `docs/spec/BUILD_PLAN.md`: the milestone you're on
5. Then, as the milestone needs them, `API.md`, `AGENT_RUNTIME.md`, `INTEGRATIONS.md`, `SECURITY.md`, `BILLING.md` and `UX.md`

If two docs disagree, ARCHITECTURE.md and DATA_MODEL.md win. If the spec is silent, choose the simplest option that fits it and write a short ADR in `docs/decisions/NNNN-title.md`.

## Rules you must not break

1. **Tenant data only through `withTenant()`.** Never import the raw pool outside `packages/db`. Every tenant table has `tenant_id`, forced RLS, the standard policy and a leading `tenant_id` index. Add every new table to the isolation fixtures in the same PR.
2. **Every model call through `packages/llm`.** No provider SDK imports anywhere else. Every call is metered.
3. **External effects need approval.** A tool that emails, texts or submits anything to someone outside the workspace has `effect: 'external'` and can never run without an approved approval row.
4. **No citation, no claim.** Bot outputs that state facts from documents carry `{documentId, page, quote}`, and the citations validator runs on them.
5. **Money and totals are computed in code.** Models suggest lines; code adds them up.
6. **Don't guess outside APIs.** Before calling DBOS, Better Auth, the AI SDK, Stripe, Twilio, Telegram, Postmark, Kontract, Google or Microsoft, read the current docs, then pin the version. Record anything surprising in an ADR.
7. **Never log secrets, tokens, passwords, message bodies or document text.** Log ids.
8. **Webhooks verify signatures and dedupe** through `webhook_receipts` before doing work.
9. **Keep the build green.** Don't skip, disable or loosen a test to pass CI. Fix the cause.

## Code conventions

- TypeScript strict and ESM. No `any`; use `unknown` and narrow. Prefer `type` over `interface` unless extending a third-party interface.
- Validate at boundaries with zod: HTTP input, webhook payloads, LLM tool arguments, jsonb columns, environment variables. Shared schemas live in `packages/shared` as named exports.
- Named exports only. One main export per file. File names are kebab-case.
- Use full names (`fieldDefinition`, not `fd`), constants in SCREAMING_SNAKE_CASE, and descriptive generic names (`TResult`, not `T`).
- Use string literal unions, not TypeScript enums. Database enumerations are `text` with check constraints.
- Business logic lives in `packages/core`. Routes and workflows are thin.
- React: function components only. Data through TanStack Query `queryOptions` factories per entity in `apps/web/src/lib/<entity>/queries.ts`, and `mutationOptions` in `mutations.ts`. No `fetch` in components. Prefer event handlers over `useEffect` for state changes.
- Forms use react-hook-form with zod resolvers. UI uses shadcn/ui components from `packages/ui`.
- Comments explain why, never what. Keep them to two or three lines at most. No JSDoc blocks.
- No dead code, no commented-out code, no TODOs without an issue reference.

## Product copy

Follow PRD §9:
- Say **Bot**, **bid**, **match**, **approve**, **skip**, **edit**, **workspace**, **connect** and **admin**.
- Use short sentences and second person.
- Say what happened, then what to do.
- Use sentence case, and make buttons verbs.
- No em dashes, no internals (token, OAuth, webhook, RLS) outside admin screens, no emojis.
- All strings go in the message catalog.

## Testing

| Kind | Tool | Rule |
|---|---|---|
| Unit | Vitest | Pure functions (scoring, grammar parser, pricing math, citation validator) have table-driven tests. |
| Integration | Vitest against real Postgres | Core services and routes run inside `withTenant` against the docker database. No mocking of the database. |
| Isolation | `pnpm test:isolation` | Two tenants, every table, every route. Must pass on every PR. |
| HTTP fakes | MSW | Outside services are faked from recorded fixtures under `packages/integrations/test/fixtures/<provider>`. |
| LLM | AI SDK mock model; recorded responses | PR CI uses recorded responses. Nightly runs use live models. |
| Evals | `pnpm eval` | Thresholds in AGENT_RUNTIME.md. A drop below threshold fails CI. |
| E2E | Playwright | One test per milestone demo script, plus sign-up and approvals. Run with `--trace off` unless debugging. |

Write the test with the code, in the same PR.

## Migrations

- Drizzle schema in `packages/db/src/schema/<module>.ts`. Generate SQL with drizzle-kit, then add RLS, policies, grants, triggers and functions by hand in the same migration.
- Migrations must work with the previous app version still running: add first, backfill, switch, then remove in a later release.
- Never edit a migration that has run on staging. Add a new one.

## Commands

```
pnpm install          pnpm infra:up         pnpm db:migrate       pnpm db:seed
pnpm dev              pnpm lint             pnpm typecheck        pnpm test
pnpm test:isolation   pnpm test:e2e         pnpm eval             pnpm build
```

## Commits and pull requests

- Keep commits small, one logical change each. Messages are imperative and specific ("Add quote request reply routing"), with no AI attribution, co-author trailers or tool signatures.
- A PR lists the FR ids it covers, the tests added, and any ADRs written.
- Before marking a milestone done, run its demo script from BUILD_PLAN.md end to end and attach the recording or screenshots.

## When you are unsure

- Read the spec section again, then the referenced provider docs.
- If the spec is wrong or impossible, don't work around it silently. Write an ADR with the problem, options and your choice, and flag it in the PR.
- If a choice affects money, security, data retention, what customers see or legal compliance, stop and ask the founder.
