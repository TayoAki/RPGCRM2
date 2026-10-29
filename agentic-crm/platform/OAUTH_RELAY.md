# One Google return address for every workspace

**Status: planned.** Until it ships, customer workspaces show Google apps and Gmail as Coming soon (`OPENBOT_SETUP_COMING_SOON`, set by the sign-up service).

## The problem

Google only sends people back to return addresses listed on the Google app, matched exactly, with no wildcards. Every Magpie workspace has its own address (`magpie-<slug>.up.railway.app`), and Google offers no API to add one. With one shared Google app, every new customer would mean a manual edit in Google Cloud.

Two flows need it:

| Flow | Workspace callback today | Code |
|---|---|---|
| Sign in with Google | `/api/auth/callback/google` | Better Auth, `server/src/auth/index.ts` (`socialProviders.google`) |
| Gmail and Calendar connector | `/api/plugins/oauth/callback` | `server/src/plugins/oauth.ts`, sealed state with a 10-minute life, PKCE S256 |

## The design

The sign-up site becomes the only address Google knows: `https://<platform>/oauth/google/callback`. It looks up which workspace started the flow and forwards the browser there. It never sees a token. The workspace still exchanges the code itself, with its own copy of the client secret.

```
browser ──▶ workspace: "connect Gmail"
workspace ──▶ browser: https://<platform>/oauth/start?workspace=<slug>&kind=connector&url=<Google authorize URL>
platform: check, remember state → (slug, kind) for 10 minutes ──▶ 302 to Google
Google ──▶ https://<platform>/oauth/google/callback?code=…&state=…
platform: look up state, forget it ──▶ 302 to https://magpie-<slug>.up.railway.app/api/plugins/oauth/callback?code=…&state=…
workspace: exchange the code (redirect_uri = the platform callback) and finish as today
```

Why it keys on `state` and not a cookie: both flows already put a random `state` on the Google URL, so the relay reads it there without changing either flow's format. Two flows open at once in one browser, even in different workspaces, don't clash.

### Sign-up site (`agentic-crm/platform`)

- **Table** `platform.oauth_relays (state text primary key, workspace_id uuid, kind text, expires_at timestamptz)`, as a new migration. Expired rows are deleted on read and hourly.
- **`GET /oauth/start`**, which redirects only when every check passes:
  - `workspace` is a `ready` workspace;
  - `kind` is `connector` or `signin`;
  - `url` is `https://accounts.google.com/o/oauth2/...`;
  - its `client_id` is the matching Magpie client;
  - its `redirect_uri` is exactly the platform callback;
  - it carries a `state`.
  Anything else is a 400 page, never a redirect.
- **`GET /oauth/google/callback`** finds the row, deletes it so it works once, and redirects to the workspace's `app_url` plus the fixed path for its `kind`, passing Google's query string through untouched. That covers both `code` and `error=access_denied`. An unknown or expired state gets a page that says to start again from the CRM.
- **No open redirect.** The destination is always the workspace's stored `app_url` plus a path from a closed set. Nothing in the request names it.
- **Shared to workspaces** through `fleetVariables`:
  - `OAUTH_RELAY_URL`;
  - the sign-in client: `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`;
  - the connector client: `GOOGLE_WORKSPACE_CLIENT_ID` and `GOOGLE_WORKSPACE_CLIENT_SECRET`.

  Rotating a secret is one change on the sign-up service.

### Workspace (OpenDuet fork)

- **Connector** (`plugins/oauth.ts`): with `OAUTH_RELAY_URL` set, use it as `redirect_uri` in both the authorize URL and the token exchange, and hand the browser the `/oauth/start` URL instead of Google's.
- **Connector client from settings:** the connector's client ID and secret come from `GOOGLE_WORKSPACE_CLIENT_*` when set. Today an admin pastes them on `/admin/plugins/google-workspace`. The connector is then on for customers without an admin step.
- **Sign-in:** `socialProviders.google.redirectURI = OAUTH_RELAY_URL`. The browser goes through `/oauth/start`, either by wrapping the URL Better Auth returns from `signIn.social` or in an `after` hook on that route. Better Auth's own state check still runs at the workspace, with the browser's cookie for that workspace.
- **Coming soon off:** remove `google` and `gmail` from `OPENBOT_SETUP_COMING_SOON` in `fleetVariables`. The next restart rolls it out.

### Why this is safe

- **Codes stay useless elsewhere.** The connector uses PKCE, so a code that reached the wrong workspace can't be exchanged. Sign-in codes are bound to Better Auth's state, which lives in that workspace's cookie and database.
- **The relay holds nothing worth stealing.** It keeps a state-to-workspace mapping for 10 minutes and never sees tokens or the client secret's use.
- **The real limit is the shared app itself.** Every customer's consent screen names the same Magpie app, so a hostile workspace could send people a consent link for itself. The relay doesn't change that. Only per-customer Google apps would, and that's an Enterprise option.

## Google Cloud setup (operator, once)

1. **A domain of your own for the sign-up site** (for example `magpiecrm.com`), added to the `web` service as a custom domain. Google only accepts return addresses and consent-screen links on domains you can verify. `up.railway.app` isn't yours to verify.
2. **One Google Cloud project, consent screen External**, with your name, logo, home page and privacy policy on that domain.
3. **Two OAuth clients, type Web application.** Each has one return address, `https://<domain>/oauth/google/callback`.
   - **Magpie sign-in:** scopes `openid`, `email`, `profile`.
   - **Magpie Gmail and Calendar:** scopes `gmail.readonly`, `gmail.send`, `calendar.readonly`. It must stay separate from the sign-in client, because Google revokes per client.
4. **Verification.**
   - Sign-in scopes need only brand verification, which is quick.
   - `gmail.send` and `calendar.readonly` are sensitive scopes and need Google's review.
   - `gmail.readonly` is restricted. It also needs a yearly third-party security assessment (CASA), which takes weeks and costs money.
   - Ship sign-in first. Ship the connector when its review is done.

## Order of work

1. Domain on the sign-up site.
2. Relay table, endpoints and tests, including the bad `url`, bad `redirect_uri`, unknown state, expired state, reused state and `error=access_denied` cases.
3. Sign in with Google through the relay. Test end to end against a fake Google, the way `crm-sso.integration.test.ts` fakes an identity provider.
4. Connector through the relay, with its client from settings.
5. Google verification for the Gmail scopes, then turn Coming soon off.

Microsoft (sign-in and Outlook) can reuse the same relay later, with `kind` values of its own and `login.microsoftonline.com` as the allowed authorize host.
