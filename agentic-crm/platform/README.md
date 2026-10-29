# Magpie sign-up

The site people sign up on, one level above the CRM. A sign-up becomes a workspace of its own: a Railway project with a Postgres database and the CRM app, run from a prebuilt image. The person who signs up is the workspace's first admin and gets their set-password link on the progress page once it's running.

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
| `WORKSPACE_IMAGE` | The CRM release workspaces run. Defaults to `ghcr.io/tayoaki/magpie-crm:edge`, the latest build; pin a tag such as `:sha-5f6bfe1` to choose when customers update. |
| `OPENAI_API_KEY`, `INTELLIGENCE_API_KEY`, ... | Copied into every workspace, so they share the operator's keys. Changing one here updates running workspaces when the service restarts. |
| `MAX_WORKSPACES`, `CONTACT_EMAIL` | A cap on sign-ups (default 50), and the address the Enterprise plan links to. |

Every step records what it made, so a restart carries on instead of making a second project.

## Releases

`.github/workflows/magpie-image.yaml` builds the CRM image on every push that changes `agentic-crm/`, tagged `sha-<commit>`, plus `edge` on the default branch and `<version>` for a `magpie-v<version>` git tag. A new workspace starts from it in a few minutes instead of building for fifteen.

Workspaces share one CopilotKit Intelligence project. Each gets its own `DEPLOYMENT_ID` so it only sees its own conversations, and automatic Learning is off so one client's learned skills never reach another. The separation is kept by the app, not by Intelligence: every workspace's server holds a key that can read the whole project. Give a client its own Intelligence project when they need it enforced.

To ship a release to customers, try the image on your own CRM, then set `WORKSPACE_IMAGE` to it. The service restarts and moves running workspaces over one at a time. Railway only switches a workspace once the new release passes its health check, so a release that doesn't start leaves customers on the old one.
