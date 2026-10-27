#!/usr/bin/env bash
# Lists hard-coded upstream branding (twenty.com links, "Twenty" string literals)
# in shipped source that is not in reseller/branding-allowlist.txt. Run it after
# every upstream sync; translated strings need no action (rebranded at runtime).
#
# Usage: reseller/scripts/check-branding.sh            # report new occurrences
#        reseller/scripts/check-branding.sh --update   # accept the current set
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
allowlist=reseller/branding-allowlist.txt

pathspecs=(
  'packages/twenty-front/src' 'packages/twenty-server/src' 'packages/twenty-emails/src'
  'packages/twenty-ui/src' 'packages/twenty-shared/src' 'packages/twenty-front/index.html'
  ':!*__tests__*' ':!*__stories__*' ':!*.spec.ts' ':!*.test.ts' ':!*.test.tsx' ':!*.stories.tsx'
  ':!*/locales/*' ':!*/generated*' ':!*/testing/*' ':!*/test/*' ':!*/dev-seeder/*'
  ':!*/upgrade-version-command/*' ':!packages/twenty-server/src/engine/core-modules/dpa/*'
)

current=$(
  git grep -h -o -I -E \
    -e "https?://[a-z0-9.-]*twenty\.com[^'\"\` )]*" \
    -e "['\"\`][^'\"\`]*\bTwenty\b[^'\"\`]*['\"\`]" \
    -- "${pathspecs[@]}" | LC_ALL=C sort -u
)

if [ "${1:-}" = "--update" ]; then
  printf '%s\n' "$current" >"$allowlist"
  echo "Accepted $(wc -l <"$allowlist" | tr -d ' ') occurrences into $allowlist."
  exit 0
fi

new=$(LC_ALL=C comm -23 <(printf '%s\n' "$current") <(LC_ALL=C sort -u "$allowlist"))

if [ -n "$new" ]; then
  echo "New hard-coded upstream branding (rebrand it, or accept with --update):"
  printf '%s\n' "$new" | sed 's/^/  /'
  echo
  echo "Locate each with: git grep -n -F '<text>'"
  exit 1
fi

echo "OK: no new hard-coded upstream branding."
