#!/usr/bin/env bash
# Imports a pristine snapshot of an upstream project into agentic-crm/<name> as a
# vendor commit, then merges it. Each project's vendor commits chain onto each
# other, so every sync is a real 3-way merge (same idea as
# reseller/scripts/sync-upstream.sh for Twenty, but scoped to a subfolder).
#
# Usage: agentic-crm/scripts/sync-vendor.sh <openduet|atomic-crm> [git-ref]
set -euo pipefail

case "${1:-}" in
  openduet)
    upstream_url=https://github.com/CopilotKit/OpenDuet.git
    upstream_slug=CopilotKit/OpenDuet
    ;;
  atomic-crm)
    upstream_url=https://github.com/marmelab/atomic-crm.git
    upstream_slug=marmelab/atomic-crm
    ;;
  *)
    echo "Usage: $0 <openduet|atomic-crm> [git-ref]" >&2
    exit 1
    ;;
esac

name="$1"
upstream_ref="${2:-main}"
prefix="agentic-crm/$name"
trailer="Vendor-Snapshot: $upstream_slug@"
# Upstream CI only runs from the repository root, so it would be dead weight here.
excluded_pathspecs=(':!.github')

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty; commit or stash first." >&2
  exit 1
fi

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

echo "Fetching $upstream_url ($upstream_ref)..."
git clone -q --depth 1 --branch "$upstream_ref" "$upstream_url" "$scratch/src"
upstream_sha=$(git -C "$scratch/src" rev-parse HEAD)

# Lay the files out under the prefix in a plain directory, then hash them from
# there: update-index keeps modes and symlinks, and ignores .gitignore rules.
mkdir -p "$scratch/tree/$prefix"
git -C "$scratch/src" ls-files -z -- . "${excluded_pathspecs[@]}" >"$scratch/files"
(cd "$scratch/src" && xargs -0 -a "$scratch/files" cp --parents -P -t "$scratch/tree/$prefix")

git_dir=$(git rev-parse --absolute-git-dir)
sed -z "s|^|$prefix/|" "$scratch/files" |
  GIT_INDEX_FILE="$scratch/index" git -C "$scratch/tree" --git-dir="$git_dir" \
    --work-tree="$scratch/tree" update-index --add -z --stdin
tree=$(GIT_INDEX_FILE="$scratch/index" git write-tree)

previous_vendor_commit=$(git log -n1 --format=%H -F --grep="$trailer" HEAD)

if [ -n "$previous_vendor_commit" ] &&
  [ "$(git rev-parse "$previous_vendor_commit^{tree}")" = "$tree" ]; then
  echo "Already up to date with $upstream_slug@$upstream_sha."
  exit 0
fi

message="Import $upstream_slug snapshot ${upstream_sha:0:12} into $prefix

Pristine copy of $upstream_slug ($upstream_ref) without .github.

$trailer$upstream_sha"

vendor_commit=$(git commit-tree "$tree" ${previous_vendor_commit:+-p "$previous_vendor_commit"} -m "$message")
echo "Created vendor commit ${vendor_commit:0:12} for $upstream_slug@${upstream_sha:0:12}."

merge_options=(--no-ff --no-edit)
[ -z "$previous_vendor_commit" ] && merge_options+=(--allow-unrelated-histories)

if ! git merge "${merge_options[@]}" -m "Merge $upstream_slug ${upstream_sha:0:12} into $prefix" "$vendor_commit"; then
  echo "Merge stopped on conflicts in $prefix; resolve them, then git commit." >&2
  exit 1
fi
echo "Merged into $prefix."
