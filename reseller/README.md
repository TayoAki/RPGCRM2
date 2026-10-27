# Reseller playbook

What you need to know to sell this CRM under your own brand. The detailed guides:

| Guide | Read it when |
|---|---|
| [docs/LICENSING.md](docs/LICENSING.md) | **Before your first sale.** What the licenses require of you, and the one open question to settle with Twenty. |
| [docs/BRANDING.md](docs/BRANDING.md) | Setting your name, logo and links. |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Deploying, upgrading and backing up customer instances. |
| [docs/UPSTREAM.md](docs/UPSTREAM.md) | Pulling in new Twenty releases. |

## What you are selling

A full CRM with companies, people, opportunities, tasks and notes. It also has custom objects and fields, kanban and table views, dashboards, workflows, email and calendar sync (Google, Microsoft, IMAP), an AI assistant, a REST/GraphQL API, webhooks and an MCP server. All of it runs under your brand.

Features Twenty reserves for its paid Enterprise edition stay locked: SSO, row-level permissions, record sharing, validation rules, audit logs and Twenty's built-in subscription billing. Custom AI providers also lock above 25 users. To sell those, see [docs/LICENSING.md](docs/LICENSING.md#enterprise-licensed-code).

## Business models

1. **Managed hosting, one instance per customer** (what this repo is set up for). Each customer gets its own isolated stack (app, worker, Postgres, Redis, HTTPS) on its own domain, created with one command. You bill outside the app, e.g. Stripe subscriptions or invoices, per seat or flat per month. Isolation keeps security reviews, backups and offboarding simple.
2. **Shared multi-workspace SaaS.** One instance hosts many customers on `<customer>.yourdomain.com` (`IS_MULTIWORKSPACE_ENABLED=true` and a wildcard DNS record and certificate). It's cheaper to run, but anyone can sign up: you need your own layer to gate sign-ups behind payment, because Twenty's built-in billing is Enterprise-licensed. Not turnkey here.
3. **Services on top.** Setup, data migration, custom objects and workflows, training and support retainers. These sell well alongside either model, and the AGPL places no limits on charging for them.

Whatever the model, customers get the AGPL rights to the source code. You compete on hosting, support, setup and your brand, not on exclusivity of the code.

## Before your first customer

- [ ] Settle the Enterprise-code question in [docs/LICENSING.md](docs/LICENSING.md#enterprise-licensed-code), ideally in writing with Twenty, or with a lawyer.
- [ ] Pick a product name and domain that do not contain "Twenty" ([trademark policy](../.github/TRADEMARK.md)).
- [ ] Replace the default logo: `python3 reseller/scripts/apply-brand-assets.py --logo your-logo.png --svg your-logo.svg`, commit, and let CI publish the image.
- [ ] Publish your own terms of service, privacy policy and DPA, then set `BRAND_TERMS_OF_SERVICE_URL` and `BRAND_PRIVACY_POLICY_URL`.
- [ ] Set up transactional email (SMTP) and S3-compatible storage for uploads.
- [ ] Merge this branch into `main` so the publish workflow builds `ghcr.io/tayoaki/rpgcrm2`, then deploy a test instance and walk through sign-up, invitations and password reset.
- [ ] Decide your backup schedule and test a restore ([docs/OPERATIONS.md](docs/OPERATIONS.md#backups)).
