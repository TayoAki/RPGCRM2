#!/usr/bin/env bash
# Builds and starts one customer's deployment, or updates it to this checkout. The first time, it
# also prints the link the first admin opens to set their password.
#
#   agentic-crm/deploy/up.sh <customer>
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
customer="${1:?Usage: up.sh <customer>}"
folder="$here/customers/$customer"
envfile="$folder/.env"
[ -f "$envfile" ] || { echo "No $envfile. Run new-customer.ts first." >&2; exit 1; }
grep -q '^INTELLIGENCE_API_KEY=.' "$envfile" || {
  echo "Set INTELLIGENCE_API_KEY in $envfile first." >&2
  exit 1
}

compose=(docker compose --project-name "crm-$customer" --env-file "$envfile" -f "$here/compose.yml")
"${compose[@]}" up --detach --build --wait

if [ ! -f "$folder/.first-admin-invited" ]; then
  admin="$(sed -n 's/^INITIAL_ADMIN_EMAILS=\([^,]*\).*/\1/p' "$envfile")"
  domain="$(sed -n 's/^DOMAIN=//p' "$envfile")"
  link="$("${compose[@]}" run --rm --no-deps --entrypoint sh \
    -e APP_PUBLIC_URL="https://$domain" app \
    -c 'cd /app/server && exec bun scripts/add-person.ts "$0" "$1"' "$admin" "${admin%%@*}" | tail -n 1)"
  touch "$folder/.first-admin-invited"
  echo "The first admin, $admin, sets a password here (valid 3 days): $link"
fi
echo "Running at https://$(sed -n 's/^DOMAIN=//p' "$envfile")"
