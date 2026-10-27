# Operations

## The image

`.github/workflows/publish-image.yaml` builds `packages/twenty-docker/twenty/Dockerfile` (target `twenty`: server and frontend) on every push to `main` and every `v*` tag. It pushes the result to `ghcr.io/tayoaki/rpgcrm2` with the tags `latest`, `sha-<commit>` and the version for tags. The image contains `/app/source-code.tar.gz`, which `/source-code` serves.

The GHCR package is private by default. On each host, either log in with a token that has `read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
```

or make the package public in GitHub → Packages. That's fine: the source is AGPL anyway.

## Sizing

As a starting point, give each instance 2 vCPU and 4 GB RAM, then watch usage. The server, worker, Postgres and Redis share the host. Instances with heavy email/calendar sync or workflows need more. Several small customers can share one host if each gets its own `HTTP_PORT`/`HTTPS_PORT`, but then put one reverse proxy in front instead of one Caddy per instance.

## New customer instance

```bash
reseller/deploy/new-instance.sh acme crm.acme.com
$EDITOR reseller/deploy/instances/acme/.env           # branding, SMTP, S3
docker compose -f reseller/deploy/docker-compose.yml \
  --env-file reseller/deploy/instances/acme/.env -p acme up -d
docker compose -p acme logs -f server                 # first start runs migrations
```

1. Before starting, point an A/AAAA record for the domain at the host. Caddy then gets a Let's Encrypt certificate on first request.
2. Open `https://crm.acme.com` and sign up **yourself first**, with an operator address you control. The first account on an instance becomes server admin: it gets the admin panel, instance config and user impersonation, and only it can create more workspaces (`IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS` defaults to true). Then invite the customer's admin from Settings → Members and give them the Admin role.
3. Keep `instances/acme/.env` safe and out of git (it's gitignored). `ENCRYPTION_KEY` encrypts stored OAuth tokens and secrets. Losing it means users must reconnect every account.

Settings you will want in production:

| Setting | Why |
|---|---|
| `EMAIL_DRIVER=smtp` + `EMAIL_SMTP_*`, `EMAIL_FROM_ADDRESS` | Invitations, password resets and verification emails. The default `logger` driver only prints emails to the log. |
| `STORAGE_TYPE=s3` + `STORAGE_S3_*` | Uploaded files survive host loss and are easier to back up than the local volume. |
| `AUTH_GOOGLE_*` / `AUTH_MICROSOFT_*` | Sign-in and mail/calendar sync. Register one OAuth app per instance domain. The callback URLs are set in `docker-compose.yml`. |
| `BRAND_*` | See [BRANDING.md](BRANDING.md). |

Other settings (AI providers, captcha, rate limits…) are listed with descriptions in **Settings → Admin Panel** of any running instance. Only the server admin sees it.

## Upgrades

Upgrade after merging an upstream sync ([UPSTREAM.md](UPSTREAM.md)) or a fork change, once CI has published the image:

```bash
docker compose -p acme pull && docker compose -p acme up -d
```

On start, the server applies database migrations and upgrade commands automatically (`packages/twenty-docker/twenty/entrypoint.sh`). Back up first. Pin `TAG=sha-<commit>` in an instance's `.env` to hold it on a known version.

## Backups

```bash
docker compose -p acme exec -T db pg_dump -U postgres -Fc default > acme-$(date +%F).dump
```

Run that daily (cron) and copy the dump off the host. With `STORAGE_TYPE=local`, also back up the `acme_server-local-data` volume. With S3, enable bucket versioning instead.

Restore into a fresh instance with the **same `.env`**:

```bash
docker compose -p acme up -d db
docker compose -p acme exec -T db pg_restore -U postgres -d default --clean --if-exists < acme-2026-10-27.dump
docker compose -p acme up -d
```

## Offboarding a customer

Export their data (the Export action on each object's list view, or a final `pg_dump`), then remove the instance:

```bash
docker compose -p acme down -v
```

## Railway instead of a VM

If you prefer a managed platform, create one Railway project per customer:

1. Add a Postgres and a Redis service.
2. Add two services from the image `ghcr.io/tayoaki/rpgcrm2:latest`:
   - `server`, exposed on port 3000.
   - `worker`, with start command `yarn worker:prod` and `DISABLE_DB_MIGRATIONS=true` and `DISABLE_CRON_JOBS_REGISTRATION=true`.
3. Give both the same variables as `x-app-environment` in `reseller/deploy/docker-compose.yml`. Use `PG_DATABASE_URL`/`REDIS_URL` from the Railway services and `SERVER_URL=https://<railway or custom domain>`.
4. Attach a volume at `/app/packages/twenty-server/.local-storage`, or use S3 storage.
