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

## Kept apart from the Twenty product

This folder is excluded from Twenty's Nx workspace (`.nxignore`) and from Twenty's Docker build context (`.dockerignore`). Twenty's CI and license checks only look at `packages/`.
