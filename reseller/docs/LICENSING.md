# Licensing

This is a practical summary, not legal advice. Before you sell, have a lawyer read `LICENSE` and confirm the Enterprise-code point below with Twenty.

The codebase is under three licenses (see the top of [LICENSE](../../LICENSE)):

| Part | License | What it means for you |
|---|---|---|
| Most of the code | AGPL-3.0 plus Twenty's application exception | You may host it, modify it and charge for it. You must offer your users the source code of the version they use. |
| `twenty-ui`, `twenty-shared`, the SDKs/CLI, `packages/twenty-apps` | MIT | Keep the copyright notice. That's all. |
| 576 files marked `/* @license Enterprise */` | Twenty.com Commercial License | See [Enterprise-licensed code](#enterprise-licensed-code). |

## AGPL obligations, and how this repo meets them

| Obligation | How it's handled |
|---|---|
| Offer the corresponding source to every user who interacts with your hosted version (section 13) | The sign-in page and **Settings → Source code** link to `/source-code`. That serves the source archive baked into the image at build time, or redirects to `SOURCE_CODE_URL` if you set one. This works even if your repository is private. |
| Keep the license and copyright notices | `LICENSE` and file headers are untouched. Don't remove them. |
| Mark your modifications and their date (section 5) | [NOTICE](../../NOTICE) plus the git history. Keep NOTICE current when you make big changes. |
| License your modifications under the AGPL too | Everything in this fork is AGPL. You can't add restrictions such as "no redistribution" to what you hand customers. |
| If you ship copies (on-premise installs), include the source or a written offer (section 6) | The image itself contains `/app/source-code.tar.gz`. |

What the AGPL does **not** stop: charging for hosting, support, setup and customization, or keeping a separate proprietary product. Twenty's application exception lets apps that talk to the CRM only through its APIs, SDK or app platform stay closed-source. Build proprietary add-ons that way, not by editing this codebase.

## Enterprise-licensed code

Twenty ships 576 files under its commercial license inside the same repository. They implement SSO, row-level permissions, record sharing, validation rules, audit logs, usage metering, Stripe-based subscription billing, and parts of the workspace migration and auth code. Without an `ENTERPRISE_KEY` from Twenty, the Enterprise features stay locked. The exception is custom AI providers, which Twenty leaves free up to 25 users per instance. [ENTERPRISE_FILES.md](ENTERPRISE_FILES.md) breaks the files down by feature and lists which ones run on every request even with the features off.

What this fork does:

- Never modifies these files. `reseller/scripts/check-license-boundary.sh` runs in CI and fails if a fork commit adds or edits one. Under the commercial license, Twenty owns any patch to them.
- Leaves `ENTERPRISE_KEY` and `IS_BILLING_ENABLED` unset everywhere. Don't turn on Twenty's billing to charge your customers. Bill them outside the app.

**The open question.** Twenty's own free self-hosted edition contains these same files, so running them with the features locked is how Twenty intends self-hosting to work. But the commercial license text says the files may be used in production only with a Twenty subscription, and forbids selling or distributing them. A reseller hosting it for paying customers falls in a gray area. Settle it before you sell, in one of these ways:

1. **Ask Twenty for written confirmation** that hosting the free edition for your customers is fine, or join their partner program. Twenty lists implementation partners, so they have a channel for this. This is the cheapest path.
2. **Buy Twenty Enterprise** for the instances that need SSO, row-level permissions and so on. Set `ENTERPRISE_KEY` per instance. Price that into what you charge.
3. **Remove the Enterprise code** ([ENTERPRISE_REMOVAL_PLAN.md](ENTERPRISE_REMOVAL_PLAN.md)). This is a substantial engineering project, because billing, SSO and permissions are wired into the auth flow, entities and migrations. It also makes upstream syncs much harder.

## Trademark

"Twenty" and its logo are Twenty's trademarks ([policy](../../.github/TRADEMARK.md)). The product name, logo, page titles, emails and links are already replaced. Your obligations:

- Don't use "Twenty" in your product name, company name, domain or app store listing, and don't use their logo.
- Do feel free to say truthfully "built on Twenty" or "powered by Twenty".

Remaining technical references are allowed and truthful, but be aware of them. They include internal package names (`twenty-server`…), webhook headers (`X-Twenty-Webhook-*`, which renaming would break integrations), the OpenAPI title, and some AI-assistant prompts. `reseller/branding-allowlist.txt` lists them all.

## Third-party services the app contacts

List any you keep enabled as sub-processors in your own DPA.

| Service | Purpose | Turn off |
|---|---|---|
| `twenty-icons.com` (run by Twenty) | Company logos from domains. It learns which company domains are in a CRM. | `ALLOW_REQUESTS_TO_TWENTY_ICONS=false` |
| `docs.twenty.com` | Help links and the AI assistant's help search, when `BRAND_DOCUMENTATION_URL` is unset | Set `BRAND_DOCUMENTATION_URL` (covers the help links) |
| Docker Hub API | Admin panel "new version available" check | Not configurable. It only reads public tags. |
| `twenty-telemetry.com` | Sign-up events, including names and emails | **Off by default in this fork.** Keep `TELEMETRY_ENABLED=false`. |
| AI providers, Google, Microsoft, your SMTP and S3 | Only when you configure them | Leave them unconfigured |

## Your own contracts

You are the service provider to your customers. You need your own terms of service, privacy policy and data processing agreement. Twenty's DPA generator was removed because it pre-signs agreements in Twenty's name.
