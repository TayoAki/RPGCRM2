# Magpie sign-up

The site people sign up on, one level above the CRM. A sign-up becomes a workspace of its own: a Railway project with a Postgres database and the CRM app, built from this repository. The person who signs up is the workspace's first admin and gets their set-password link on the progress page once it's running.

## Running it

```bash
cd agentic-crm/platform && bun install
DATABASE_URL=postgres://... PLATFORM_SECRET=<32+ characters> bun src/index.ts
bun test                       # needs TEST_DATABASE_URL, or the local openbot_test database
bun run check:railway          # checks the provisioner's queries against Railway's schema
```

| Variable | |
|---|---|
| `DATABASE_URL`, `PLATFORM_SECRET` | Required. The secret seals each workspace's setup token and derives its database password. |
| `PUBLIC_URL` | The site's own address. |
| `RAILWAY_API_TOKEN` | An account or workspace token. Without it, sign-ups are recorded and wait. |
| `RAILWAY_WORKSPACE_ID` | The Railway workspace new projects go in. |
| `WORKSPACE_REPO`, `WORKSPACE_BRANCH` | What each workspace builds from. Defaults to `TayoAki/RPGCRM2` on `main`. |
| `OPENAI_API_KEY`, `INTELLIGENCE_API_KEY`, ... | Copied into every workspace, so they share the operator's keys. |
| `MAX_WORKSPACES`, `CONTACT_EMAIL` | A cap on sign-ups (default 50), and the address the Enterprise plan links to. |

Each workspace builds from source, so it takes about 15 minutes to be ready. Every step records what it made, so a restart carries on instead of making a second project.
