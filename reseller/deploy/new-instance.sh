#!/usr/bin/env bash
# Creates reseller/deploy/instances/<name>/.env for a new customer instance with
# fresh secrets. The instances/ directory is gitignored: it holds secrets.
#
# Usage: reseller/deploy/new-instance.sh <name> <domain>
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <name> <domain>   e.g. $0 acme crm.acme.com" >&2
  exit 1
fi

name="$1"
domain="$2"

if ! [[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Name must be lowercase letters, digits and dashes (it becomes the compose project name)." >&2
  exit 1
fi

deploy_dir=$(cd "$(dirname "$0")" && pwd)
instance_dir="$deploy_dir/instances/$name"

if [ -e "$instance_dir/.env" ]; then
  echo "$instance_dir/.env already exists; refusing to overwrite its secrets." >&2
  exit 1
fi

mkdir -p "$instance_dir"
umask 077

sed \
  -e "s|^DOMAIN=.*|DOMAIN=$domain|" \
  -e "s|^PG_DATABASE_PASSWORD=.*|PG_DATABASE_PASSWORD=$(openssl rand -hex 32)|" \
  -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 32)|" \
  -e "s|^EMAIL_FROM_ADDRESS=.*|EMAIL_FROM_ADDRESS=noreply@$domain|" \
  "$deploy_dir/.env.example" >"$instance_dir/.env"

cat <<NEXT
Created $instance_dir/.env

Next:
  1. Point DNS for $domain at this host (A/AAAA record).
  2. Review $instance_dir/.env (branding, SMTP, storage).
  3. Start it:
       docker compose -f $deploy_dir/docker-compose.yml --env-file $instance_dir/.env -p $name up -d
  4. Open https://$domain and sign up yourself first: the first account becomes server
     admin. Then invite the customer's admin from Settings > Members.

Back up $instance_dir/.env: ENCRYPTION_KEY cannot be recovered and encrypts stored credentials.
NEXT
