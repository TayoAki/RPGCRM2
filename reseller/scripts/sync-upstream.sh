#!/usr/bin/env bash
# Imports a pristine Twenty snapshot as a "vendor" commit, then merges it into the
# current branch. Vendor commits chain onto each other, so every sync is a real
# 3-way merge against the last imported upstream state. See reseller/docs/UPSTREAM.md.
#
# Usage: reseller/scripts/sync-upstream.sh [git-ref]   (branch or tag, default: main)
set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/twentyhq/twenty.git}"
UPSTREAM_REF="${1:-main}"
TRAILER="Vendor-Snapshot"

# Twenty's marketing site, its branded docs and its CI automation are never shipped.
EXCLUDED_PATHSPECS=(
  ':!packages/twenty-website'
  ':!packages/twenty-docs'
  ':!.github'
)
# The LICENSE links to the trademark policy, so it is kept for reference.
KEPT_PATHS=(.github/TRADEMARK.md)

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty; commit or stash first." >&2
  exit 1
fi

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

echo "Fetching $UPSTREAM_URL ($UPSTREAM_REF)..."
git clone -q --depth 1 --branch "$UPSTREAM_REF" "$UPSTREAM_URL" "$scratch/src"
upstream_sha=$(git -C "$scratch/src" rev-parse HEAD)

# update-index hashes straight from the upstream checkout, so modes, symlinks and
# tracked-but-gitignored files come across exactly.
git_dir=$(git rev-parse --absolute-git-dir)
{
  git -C "$scratch/src" ls-files -z -- . "${EXCLUDED_PATHSPECS[@]}"
  git -C "$scratch/src" ls-files -z -- "${KEPT_PATHS[@]}"
} | GIT_INDEX_FILE="$scratch/index" git -C "$scratch/src" --git-dir="$git_dir" \
  --work-tree="$scratch/src" update-index --add -z --stdin
tree=$(GIT_INDEX_FILE="$scratch/index" git write-tree)

has_head=false
previous_vendor_commit=""
if git rev-parse -q --verify HEAD >/dev/null; then
  has_head=true
  previous_vendor_commit=$(git log -n1 --format=%H --grep="^${TRAILER}: " HEAD)
fi

if [ -n "$previous_vendor_commit" ] &&
  [ "$(git rev-parse "$previous_vendor_commit^{tree}")" = "$tree" ]; then
  echo "Already up to date with twentyhq/twenty@${upstream_sha}."
  exit 0
fi

message="Import Twenty upstream snapshot ${upstream_sha:0:12}

Pristine copy of twentyhq/twenty (${UPSTREAM_REF}) without packages/twenty-website,
packages/twenty-docs and .github (except .github/TRADEMARK.md).

${TRAILER}: twentyhq/twenty@${upstream_sha}"

vendor_commit=$(git commit-tree "$tree" ${previous_vendor_commit:+-p "$previous_vendor_commit"} -m "$message")
echo "Created vendor commit ${vendor_commit:0:12} for twentyhq/twenty@${upstream_sha:0:12}."

if [ "$has_head" = false ]; then
  git reset -q --hard "$vendor_commit"
  echo "Initialized branch from the vendor commit."
  exit 0
fi

if ! git merge --no-ff --no-edit -m "Merge Twenty upstream ${upstream_sha:0:12} (${UPSTREAM_REF})" "$vendor_commit"; then
  cat >&2 <<HELP

Merge stopped on conflicts. Typical resolution:
  - yarn.lock:  git checkout --theirs yarn.lock && yarn install && git add yarn.lock
  - branding:   keep our side, then re-run: node reseller/scripts/check-branding.mjs
  - then:       git commit
HELP
  exit 1
fi
echo "Merged. Run 'yarn install' and the checks in reseller/docs/UPSTREAM.md before pushing."
