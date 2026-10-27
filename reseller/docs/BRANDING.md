# Branding

## Runtime settings (per deployment, no rebuild)

Set these as environment variables on the server **and** the worker. The worker sends the emails. They are env-only, and changes apply on restart.

| Variable | Default | Where it shows |
|---|---|---|
| `BRAND_NAME` | `RPG CRM` | Every UI string and email that said "Twenty" (all languages), page titles, the 2FA issuer, invitation senders ("Jane (via RPG CRM)") |
| `BRAND_LOGO_URL` | bundled icon | Sign-in page, default workspace logo, email header. Use an absolute URL to a square PNG. |
| `BRAND_WEBSITE_URL` | hidden | Email footer, Settings → Community |
| `BRAND_SUPPORT_URL` | hidden | Settings → Support (`https://…` or `mailto:…`). A configured Front chat (`SUPPORT_DRIVER=FRONT`) takes precedence. |
| `BRAND_DOCUMENTATION_URL` | Twenty's docs in the app, hidden in emails | Settings → Documentation, in-app help links, email footer |
| `BRAND_TERMS_OF_SERVICE_URL`, `BRAND_PRIVACY_POLICY_URL` | hidden | Sign-in page footer |
| `BRAND_LEGAL_ENTITY` | hidden | Email footer, e.g. `Acme Inc., 1 Main St, Austin, TX` |
| `SOURCE_CODE_URL` | `/source-code` serves the bundled archive | Sign-in footer and Settings → Source code (AGPL) |
| `EMAIL_FROM_NAME` | `RPG CRM` | Sender name of system emails. Set it alongside `BRAND_NAME`. |

How it works: the server renders the branding into `index.html` (`<script id="white-label-branding">`) and rewrites `<title>`. The frontend reads it before any module runs. Translation catalogs keep Twenty's wording, and `rebrandMessages` (in `twenty-shared/i18n`) swaps the product name when each language loads. That rebrands all languages without forking the translation files, so upstream translation updates keep flowing in.

## Logo and icon files (per image build)

The favicon, PWA/app icons and the in-app logo used during onboarding are static files. Regenerate all of them from your logo, then commit:

```bash
pip install pillow   # if needed
python3 reseller/scripts/apply-brand-assets.py --logo path/to/logo-1024.png --svg path/to/logo.svg
```

`--logo` must be a square PNG of at least 1024 px. `--svg` is optional. Without it, the in-app SVG embeds the PNG. With no arguments, the script redraws the default "R" monogram.

## Build-time default name

`RPG CRM` is the fallback when `BRAND_NAME` is unset. It's also used during local frontend development. To change the default, edit these files:

- `packages/twenty-shared/src/constants/DefaultBranding.ts`
- `packages/twenty-front/index.html` (`<title>`, `og:title`, `twitter:title`)
- `packages/twenty-front/public/manifest.json` (installed-app name; not rewritten at runtime)
- `reseller/deploy/.env.example` and `reseller/deploy/docker-compose.yml` defaults
- `packages/twenty-server/.../twenty-config/config-variables.ts` uses `DEFAULT_BRANDING`, so no edit is needed there

## What is not rebranded

See `reseller/branding-allowlist.txt` for the full list, maintained by `reseller/scripts/check-branding.sh`. In short:

- **API contracts:** webhook headers `X-Twenty-Webhook-*` and package names.
- **AI prompts and help:** some AI-assistant system prompts mention Twenty. The assistant's help search queries Twenty's docs.
- **Developer-facing names:** the OpenAPI document title, the MCP server card title and the `.well-known` metadata.
- **Seed data:** example values in new workspaces, such as a sample link to twenty.com in a demo workflow.
