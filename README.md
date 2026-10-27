<p align="center">
  <img src="./reseller/brand/logo.png" width="96px" alt="Logo" />
</p>

<h2 align="center">RPG CRM</h2>

<p align="center">A white-label CRM you can host and sell under your own brand, built on <a href="https://github.com/twentyhq/twenty">Twenty</a>.</p>

---

This repository is a fork of [Twenty](https://github.com/twentyhq/twenty), the open-source CRM, set up for resale:

- **Your brand everywhere, set by environment variables.** Product name, logo, website, support, documentation, legal links and email footer come from `BRAND_*` settings. Every interface language is rebranded at runtime, so translations keep working. See [reseller/docs/BRANDING.md](reseller/docs/BRANDING.md).
- **Twenty-only surfaces removed.** Twenty's DPA generator, compliance badges, community links and contributor photos are gone. Telemetry to Twenty is off by default.
- **AGPL compliance built in.** Every deployment links to, and can serve, its exact source code. CI blocks changes to Twenty's Enterprise-licensed files. See [reseller/docs/LICENSING.md](reseller/docs/LICENSING.md).
- **One command per customer.** A Docker Compose stack with automatic HTTPS, plus a script that generates each instance's secrets. See [reseller/docs/OPERATIONS.md](reseller/docs/OPERATIONS.md).
- **Upstream updates stay mergeable.** Fork changes are small and isolated, and a sync script merges new Twenty releases as real 3-way merges. See [reseller/docs/UPSTREAM.md](reseller/docs/UPSTREAM.md).

Start with [reseller/README.md](reseller/README.md), the reseller playbook.

## Quick start: one customer instance

```bash
reseller/deploy/new-instance.sh acme crm.acme.com     # writes reseller/deploy/instances/acme/.env
# edit that .env: branding, SMTP, S3
docker compose -f reseller/deploy/docker-compose.yml \
  --env-file reseller/deploy/instances/acme/.env -p acme up -d
```

The image is built and pushed to `ghcr.io/tayoaki/rpgcrm2` by [.github/workflows/publish-image.yaml](.github/workflows/publish-image.yaml) on every push to `main`.

## Development

The codebase is Twenty's Nx/Yarn monorepo. See [CLAUDE.md](CLAUDE.md) for commands and conventions. Fork-specific code lives in:

| Path | What |
|---|---|
| `packages/twenty-shared/src/{types/Branding.ts,constants/DefaultBranding.ts,i18n/rebrand-messages.ts}` | Branding type, defaults, catalog rebranding |
| `packages/twenty-server/src/engine/core-modules/white-label/` | Branding config, HTML injection, `/source-code` |
| `packages/twenty-front/src/modules/white-label/` | Branding read from the served page |
| `packages/twenty-emails/src/utils/email-branding.ts` | Branding for transactional emails |
| `reseller/` | Scripts, deploy kit, brand assets, docs |

## License

AGPL-3.0, like Twenty, except the files Twenty marks `/* @license Enterprise */`, which remain under Twenty's commercial license. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [reseller/docs/LICENSING.md](reseller/docs/LICENSING.md). "Twenty" is a trademark of Twenty.com, PBC. This project is not affiliated with or endorsed by Twenty.
