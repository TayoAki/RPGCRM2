#!/usr/bin/env bash
# Fails when this fork adds or modifies a file marked "/* @license Enterprise */".
# Those files are not AGPL: Twenty owns patches to them and production use needs a
# Twenty Enterprise subscription. Diffs against the last vendor snapshot, so only
# changes made in this fork are checked. See reseller/docs/LICENSING.md.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

vendor_commit=$(git log -n1 --format=%H --grep='^Vendor-Snapshot: twentyhq/twenty@' HEAD)
if [ -z "$vendor_commit" ]; then
  echo "No vendor snapshot commit found (see reseller/scripts/sync-upstream.sh)." >&2
  exit 1
fi

violations=()
while IFS= read -r -d '' file; do
  # Some files place the marker below their imports, so scan the whole file.
  if grep -qF '/* @license Enterprise */' "$file"; then
    violations+=("$file")
  fi
done < <(git diff -z --name-only --diff-filter=AM "$vendor_commit" HEAD -- packages)

enterprise_file_count=$(git grep -lF '/* @license Enterprise */' -- packages | wc -l | tr -d ' ')

if [ ${#violations[@]} -gt 0 ]; then
  echo "These Enterprise-licensed files were added or modified in this fork:" >&2
  printf '  %s\n' "${violations[@]}" >&2
  echo "Revert them, or keep the change upstream-only (see reseller/docs/LICENSING.md)." >&2
  exit 1
fi

echo "OK: no Enterprise-licensed file modified since $(git log -n1 --format=%s "$vendor_commit")."
echo "    $enterprise_file_count Enterprise-licensed files ship unmodified (see reseller/docs/LICENSING.md)."
