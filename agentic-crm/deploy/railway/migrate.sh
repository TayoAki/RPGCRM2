#!/bin/sh
# Railway runs one replica against its own Postgres, so migrating on start can't race another
# replica. Then the first admin gets their set-password link, printed to the deploy logs.
set -eu
cd /app/server
export HOME=/home/apiuser
s6-setuidgid apiuser /usr/local/bin/bun scripts/migrate.ts
[ -n "${FIRST_ADMIN_EMAIL:-}" ] || exit 0
exec s6-setuidgid apiuser /usr/local/bin/bun scripts/first-admin.ts "$FIRST_ADMIN_EMAIL"
