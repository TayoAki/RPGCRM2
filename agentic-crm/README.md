# Agentic CRM

The second product in this repository: an AI-agent-first CRM built on OpenDuet and Atomic CRM. It's separate from the Twenty-based CRM in `packages/`, and shares no code with it.

| Path | What | License |
|---|---|---|
| [PLAN.md](PLAN.md) | Architecture, phases, risks | |
| [FEATURES.md](FEATURES.md) | Feature tracker: tier, starting point, status | |
| `openduet/` | [CopilotKit/OpenDuet](https://github.com/CopilotKit/OpenDuet), the agent platform and host app | MIT, `openduet/LICENSE` |
| `atomic-crm/` | [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm), the CRM screens being ported into OpenDuet | MIT, `atomic-crm/LICENSE.md` |
| `scripts/sync-vendor.sh` | Pulls upstream updates into `openduet/` or `atomic-crm/` | |

The repository's root `LICENSE` (Twenty's AGPL) doesn't apply to this folder. The two upstream projects keep their MIT licenses and copyright notices. The license for your own additions is still to be decided (see PLAN.md, "Decisions needed").

**Never copy code from `packages/` (Twenty) into this folder.** That code is AGPL with Enterprise-licensed parts. Twenty is a behavior reference only.

## Upstream updates

Both projects are imported as pristine "vendor" snapshots, and our changes are made directly in their folders. To pull a new upstream version, start from a clean working tree:

```bash
agentic-crm/scripts/sync-vendor.sh openduet          # latest main
agentic-crm/scripts/sync-vendor.sh atomic-crm v1.7.0 # or a tag
```

Each snapshot commit carries a `Vendor-Snapshot: <owner/repo>@<sha>` trailer and chains onto the previous one. That makes every sync a normal 3-way merge, where conflicts appear only where both sides changed the same lines. Upstream `.github` folders are left out, because GitHub only runs workflows from the repository root.

| Project | Imported at |
|---|---|
| OpenDuet | `60fd4c7` (2026-10-27) |
| Atomic CRM | `1d96561` (2026-10-27) |

OpenDuet changes fast, so pin it and sync about monthly.

## How the CRM runs inside OpenDuet

OpenDuet's app compiles Atomic's screens into itself and serves them at `/crm`, behind OpenDuet's sign-in.

| Piece | Where |
|---|---|
| Mount point: a `/crm/*` route, its screen, and the menu entry | `openduet/openbot/app/src/routes/_authed/_app/crm.$.tsx`, `openduet/openbot/app/src/crm/`, `menu-sheet.tsx` |
| Build wiring: resolves Atomic's `@/` imports and packages, keeps one React, swaps out what the host replaces | `openduet/openbot/app/vite-crm.ts`, used by `vite.config.ts` |
| Embed entry: runs Atomic's `<CRM>` on OpenDuet's URL, user, theme and data | `atomic-crm/src/embed/` |
| CRM data: tables, views, API, search | `openduet/openbot/server/src/crm/`, migrations in `openduet/openbot/server/drizzle-crm/` |
| Routes this product adds to OpenDuet's server | `openduet/openbot/server/src/extra-routes.ts` |
| The agent's CRM tools, set up at boot | `openduet/openbot/server/src/crm/agent-tools.ts`, `crm/install.ts` |

- **Routing.** Atomic keeps its own react-router, which reads and writes the URL through OpenDuet's TanStack Router history (`hostHistory.ts`). Links, deep links, Back and Forward work across both routers.
- **Sign-in.** It's OpenDuet's: the CRM identifies the signed-in user and never shows its own login (`hostAuthProvider.ts`). The CRM's Log out signs out of OpenDuet.
- **Theme.** OpenDuet's theme tokens style the CRM, and its light or dark mode drives the CRM's. The CRM's own theme switch is hidden.
- **What's left out.** OpenDuet's build serves Atomic's Supabase sign-in, data provider and pages, and its theme switch, as `embed/standIns.tsx`, so Supabase's client isn't bundled. A test fails if an Atomic update changes what those modules export.
- **Data.** In OpenDuet's Postgres, in a separate `crm` schema with its own migrations. OpenDuet's migrate script applies them after its own. The tables and views follow Atomic's Supabase schema, and `/api/crm` speaks the filter language Atomic's screens already use (`hostDataProvider.ts`). So the screens didn't change.
- **Who sees what.** Everybody signed in reads and edits all records, as in Atomic. Only admins change the CRM's settings or other people's CRM profiles. Each person's CRM user is created on their first visit, with their OpenDuet role.
- **Files.** Attachments, logos and avatars go to the `crm.files` table, up to 20 MB each, and records keep links to them. Only signed-in people can download them. Only PNG, JPEG, GIF and WebP pictures display in the page; other files download. A note's files are deleted with the note, or when they're taken off it.
- **The agent.** Bots reach the CRM through a built-in plugin, "CRM", with the same rules as the screens. The first boot adds it, grants its tools to every Bot, and adds a team approval rule so a Bot asks before any CRM write. After that, admins manage it like any plugin at `/admin/plugins`, and a Bot added later needs its tools granted there. The morning brief also lists the person's CRM follow-ups.
- **Changing the CRM's tables.** Edit `server/src/crm/schema.ts`, then run `bunx drizzle-kit generate --config=drizzle-crm.config.ts` from `openduet/openbot/server`. Never add CRM tables to OpenDuet's own `drizzle/` folder.

### Running it locally

1. Install the dependencies:
   - `npm ci` in `atomic-crm/`
   - `bun install` in `openduet/openbot/`
2. Set up the database: PostgreSQL with the pgvector extension, plus a database matching `DATABASE_URL`.
3. Write `openduet/openbot/.env`:
   - Copy `.env.example`.
   - Set `INTELLIGENCE_API_KEY`, which the server requires.
   - Choose how people sign in:
     - **Quickest, for one person:** clear `OPENBOT_PUBLIC_URL`. `OPENBOT_SINGLE_USER=true` then signs you in as a local admin.
     - **Email and password, as customers use it:** set `SIGNIN_EMAIL_PASSWORD=true`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `INITIAL_ADMIN_EMAILS`, and `TRUSTED_ORIGINS` (include `http://127.0.0.1:3010`). After step 4, add the first admin from `openduet/openbot/server` with `APP_PUBLIC_URL=http://127.0.0.1:3010 bun --env-file=../.env scripts/add-person.ts <email> <name>`, and open the link it prints.
4. Start the server: in `openduet/openbot/server`, run `bun --env-file=../.env scripts/migrate.ts`, then `bun --env-file=../.env src/index.ts`.
5. Start the app: in `openduet/openbot/app`, run `bun run dev`.
6. Open `http://127.0.0.1:3010/crm`, after finishing OpenDuet's onboarding once.

### Running the tests

- **OpenDuet's tests.** Run them from `openduet/openbot` with `TEST_DATABASE_URL` set to a separate database, migrated like the main one. `bun test app` runs the app's and `bun test server` the server's. The server's agent tests also need `bun install` in `agent-bot`, `agent-langgraph` and `agent-mastra`.
- **Atomic's tests.** In `atomic-crm`, run `npx vitest run`.

## Deploying for a customer

One instance per customer, on a machine with Docker, from this checkout. `deploy/` holds the kit:

| File | What |
|---|---|
| `new-customer.ts` | Writes `deploy/customers/<customer>/`: an `.env` with fresh secrets, and the customer's tenant package (see "Branding a deployment"). Git ignores the folder; keep it private and backed up. |
| `up.sh` | Builds and starts the deployment, or updates it to this checkout. The first time, it prints the link the first admin opens to set a password. |
| `compose.yml` | The services: Postgres with pgvector, a migration step that runs before every start, OpenDuet's image with the CRM in it, and Caddy, which gets the HTTPS certificate. |

```bash
bun agentic-crm/deploy/new-customer.ts --customer acme --name "Acme CRM" \
  --domain crm.acme.com --admin owner@acme.com
# Fill in INTELLIGENCE_API_KEY and a model key in deploy/customers/acme/.env, point crm.acme.com
# at the machine, then:
agentic-crm/deploy/up.sh acme
```

- **Sign-in** is by email and password. The first admin adds the others from Admin, People.
- **Turned off for every customer:** OpenDuet's self-hosting banner and CopilotKit's telemetry.
- **Ports.** Caddy takes 80 and 443. To run several customers on one machine, set `HTTP_PORT` and `HTTPS_PORT` in each `.env` and put your own proxy in front.
- **Backups.** The data is in the `db` volume: `docker compose -p crm-acme exec db pg_dump -U crm crm`.
- **Building the image** needs Atomic's sources beside OpenDuet's. Compose passes them as the `atomic-crm` build context, and the customer's tenant package as `tenant`. Without a `tenant` context, OpenDuet's own package is used.

## Branding a deployment

Each deployment carries its own name, through an OpenDuet tenant package. `scripts/make-tenant.ts` writes one from OpenDuet's own (`openduet/openbot/examples/openduet`), with the product's name everywhere in the app and the assistant's name in chat:

```bash
bun agentic-crm/scripts/make-tenant.ts --name "Acme CRM" --assistant "Ava" --out <dir>
```

- **Using it.** Set `TENANT_PACKAGE_DIR=<dir>` in `openduet/openbot/.env`, then build or start the app. The name is read when the app is built.
- **The CRM.** Its header shows the product's name with a letter mark, and its setup checklist names the product. An admin can still set the CRM's own name and logos in its Settings.
- **After a vendor sync,** run the script again with `--force`, so OpenDuet's changes to its package come through. It stops if a line it rewrites has moved.
- **Still OpenDuet's or CopilotKit's,** until the paid plans are in place:
  - The "Self-host OpenDuet" banner shows until the deployment's CopilotKit Intelligence plan is a paid one.
  - CopilotKit's "Powered by CopilotKit" badge shows until a CopilotKit license key is set.

## Kept apart from the Twenty product

This folder is excluded from Twenty's Nx workspace (`.nxignore`) and from Twenty's Docker build context (`.dockerignore`). Twenty's CI and license checks only look at `packages/`.
