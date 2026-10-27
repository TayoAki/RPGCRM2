# Staying current with Twenty

## How the history is laid out

```
vendor:  V1 ──────────── V2 ──────────── V3        pristine Twenty snapshots
           \               \               \
fork:       F ─ F ─ F ───── M ─ F ─ F ───── M      your changes and merges
```

Each `V` is a commit whose tree is Twenty at one upstream commit, minus `packages/twenty-website`, `packages/twenty-docs` and `.github` (it keeps `.github/TRADEMARK.md`). A `Vendor-Snapshot: twentyhq/twenty@<sha>` trailer marks it. Each new snapshot's parent is the previous one, so merging it into the fork is an ordinary 3-way merge. Git only shows conflicts where both sides changed the same lines.

## Syncing

On a clean working tree, on a new branch:

```bash
git switch -c sync-upstream
reseller/scripts/sync-upstream.sh            # latest main
reseller/scripts/sync-upstream.sh v2.54.0    # or a release tag (preferred for production)
```

The script resolves conflicts in fork-owned files (`README.md`) automatically. For anything else it stops and prints hints. Common cases:

| Conflict | Resolution |
|---|---|
| `yarn.lock` | `git checkout --theirs yarn.lock && yarn install && git add yarn.lock` |
| `package.json` workspaces | Keep upstream's changes, keep `twenty-website`/`twenty-docs` removed |
| A file the fork edited (see the list in the root README) | Keep both intents. The fork's edits are small, usually one import plus one call. |
| A file the fork deleted (DPA pages, trust badges) | Keep it deleted: `git rm <file>` |

Then, before pushing:

```bash
yarn install
reseller/scripts/check-license-boundary.sh   # must pass
reseller/scripts/check-branding.sh           # review new upstream branding (see below)
npx nx run-many -t build -p twenty-shared twenty-emails twenty-ui twenty-client-sdk twenty-sdk twenty-front-component-renderer
npx tsgo -p packages/twenty-server/tsconfig.json --noEmit
npx tsgo -p packages/twenty-front/tsconfig.json --noEmit
```

Open a pull request. CI runs the same checks. After merging, the image is published and you can upgrade instances ([OPERATIONS.md](OPERATIONS.md#upgrades)).

## New branding from upstream

Translated UI strings need no work: the product name in them is swapped at runtime. `check-branding.sh` lists only new **hard-coded** `twenty.com` links and "Twenty" string literals in shipped code. For each one:

- If users see it, route it through branding. Use `BRANDING` from `@/white-label/constants/Branding` in the frontend, `BRAND_NAME`/`WhiteLabelService` on the server, or `getEmailBranding()` in emails.
- Otherwise (an API contract, internal name or AI prompt), accept it with `reseller/scripts/check-branding.sh --update`.

## Rules that keep syncs cheap

- Put new fork code in the `white-label` modules or under `reseller/`, not scattered across upstream files.
- When an upstream file must change, keep the edit to a line or two.
- Never edit a file marked `/* @license Enterprise */`. CI enforces this. See [LICENSING.md](LICENSING.md).
- Don't commit regenerated translation catalogs (`locales/**`). The image build regenerates them (`lingui:extract` + `lingui:compile` in the Dockerfile). New fork strings fall back to English in other languages until translated.
