import { afterAll, beforeAll, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { createAuth } from "../src/auth";
import { createPasswordPeople } from "../src/auth/email-password";
import type { DeploymentConfig } from "../src/config";
import { actorForApiKey, createApiKey } from "../src/crm/api-keys";
import { addMissingSales } from "../src/crm/directory";
import { sales } from "../src/crm/schema";
import { createScimToken, revokeScimToken } from "../src/crm/scim-tokens";
import { withProviderBeingRegistered } from "../src/crm/sso-origins";
import { createDatabase } from "../src/db/client";
import { ssoProviders, userRoles, users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const BASE_URL = "http://127.0.0.1:3000";
const run = crypto.randomUUID().slice(0, 8);
const DOMAIN = `idp-${run}.test`;
const ADMIN = `owner-${run}@acme.test`;
const PASSWORD = "correct horse battery staple";
const CLIENT = { id: `client-${run}`, secret: `secret-${run}` };

// A small OpenID provider: it signs in whoever the test names, with a real signed id_token.
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = {
  ...keys.publicKey.export({ format: "jwk" }),
  kid: "test",
  alg: "RS256",
  use: "sig",
};
const codes = new Map<string, { email: string; nonce?: string }>();
let signInAs = "";
const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");
const idToken = (claims: Record<string, unknown>) => {
  const head = base64url(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test" }),
  );
  const body = base64url(JSON.stringify(claims));
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${head}.${body}`),
    keys.privateKey,
  );
  return `${head}.${body}.${base64url(signature)}`;
};
const idp = Bun.serve({
  port: 0,
  fetch: async (request) => {
    const url = new URL(request.url);
    const issuer = `http://127.0.0.1:${idp.port}`;
    switch (url.pathname) {
      case "/.well-known/openid-configuration":
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "client_secret_post",
          ],
        });
      case "/jwks":
        return Response.json({ keys: [jwk] });
      case "/authorize": {
        const code = crypto.randomUUID();
        codes.set(code, {
          email: signInAs,
          nonce: url.searchParams.get("nonce") ?? undefined,
        });
        const back = new URL(url.searchParams.get("redirect_uri") ?? "");
        back.searchParams.set("code", code);
        back.searchParams.set("state", url.searchParams.get("state") ?? "");
        return Response.redirect(back.toString(), 302);
      }
      case "/token": {
        const form = new URLSearchParams(await request.text());
        const grant = codes.get(form.get("code") ?? "");
        if (!grant)
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        const now = Math.floor(Date.now() / 1000);
        return Response.json({
          access_token: `access-${grant.email}`,
          token_type: "Bearer",
          expires_in: 3600,
          id_token: idToken({
            iss: issuer,
            aud: CLIENT.id,
            sub: `sub-${grant.email}`,
            email: grant.email,
            email_verified: true,
            name: "Sam Directory",
            iat: now,
            exp: now + 3600,
            ...(grant.nonce ? { nonce: grant.nonce } : {}),
          }),
        });
      }
      case "/userinfo": {
        const email = (request.headers.get("authorization") ?? "").replace(
          "Bearer access-",
          "",
        );
        return Response.json({
          sub: `sub-${email}`,
          email,
          email_verified: true,
          name: "Sam Directory",
        });
      }
      default:
        return new Response("Not found", { status: 404 });
    }
  },
});
const ISSUER = `http://127.0.0.1:${idp.port}`;

const auth = createAuth(
  {
    auth: {
      baseUrl: BASE_URL,
      secret: "x".repeat(40),
      trustedOrigins: [ISSUER],
      initialAdminEmails: [ADMIN],
      allowedEmailDomains: [],
      emailPassword: true,
    },
    keyEncryptionKey: Buffer.alloc(32, 7).toString("base64"),
  } as unknown as DeploymentConfig,
  database,
);

const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
// As app.ts mounts Better Auth: the body is read first, and the issuer being registered passed on.
const handle = async (request: Request) => {
  await request.clone().text();
  return withProviderBeingRegistered(request, () => auth.handler(request));
};
const call = (
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
) =>
  handle(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        origin: BASE_URL,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    }),
  );

// Signs in through the provider the way a browser would, and returns the session cookie.
async function ssoSignIn(email: string, providerId?: string) {
  signInAs = email;
  const started = await call("/sign-in/sso", {
    body: { ...(providerId ? { providerId } : { email }), callbackURL: "/crm" },
  });
  const { url } = (await started.json()) as { url: string };
  const atProvider = await fetch(url, { redirect: "manual" });
  const callback = new URL(atProvider.headers.get("location") ?? "");
  const finished = await auth.handler(
    new Request(callback, { headers: { cookie: cookiesOf(started) } }),
  );
  return { finished, cookie: cookiesOf(finished) };
}

const scim = (token: string, method: string, path: string, body?: unknown) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth/scim/v2${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/scim+json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );

beforeAll(async () => {
  const { token } = await createPasswordPeople(auth).add({
    email: ADMIN,
    name: "Olive Owner",
  });
  await auth.api.resetPassword({ body: { token, newPassword: PASSWORD } });
  const signedIn = await call("/sign-in/email", {
    body: { email: ADMIN, password: PASSWORD },
  });
  const registered = await call("/sso/register", {
    cookie: cookiesOf(signedIn),
    body: {
      providerId: `acme-${run}`,
      issuer: ISSUER,
      domain: DOMAIN,
      oidcConfig: {
        clientId: CLIENT.id,
        clientSecret: CLIENT.secret,
        discoveryEndpoint: `${ISSUER}/.well-known/openid-configuration`,
      },
    },
  });
  expect(registered.status, await registered.clone().text()).toBe(200);
});

afterAll(async () => {
  idp.stop(true);
  await database
    .delete(ssoProviders)
    .where(eq(ssoProviders.providerId, `acme-${run}`));
  await database.delete(users).where(like(users.email, `%${run}%`));
  await database.$client.end({ timeout: 5 });
});

test("somebody at the company's domain signs in through its identity provider", async () => {
  const email = `sam-${run}@${DOMAIN}`;

  const { finished, cookie } = await ssoSignIn(email);
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });

  expect(finished.status).toBe(302);
  expect(finished.headers.get("location")).toBe("/crm");
  expect(session?.user.email).toBe(email);
  const [role] = await database
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, session?.user.id ?? ""));
  expect(role?.role).toBe("user");
});

test("a person the directory added signs in through SSO, and turning them off there ends their CRM access", async () => {
  const email = `dana-${run}@${DOMAIN}`;
  const { token, row } = await createScimToken(database, "test");
  const created = await scim(token, "POST", "/Users", {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    userName: email,
    externalId: `ext-${run}`,
    name: { givenName: "Dana", familyName: "Directory" },
    emails: [{ value: email, primary: true }],
    active: true,
  });
  const scimUser = (await created.json()) as { id: string };
  await addMissingSales(database);
  const [sale] = await database
    .select()
    .from(sales)
    .where(eq(sales.email, email));
  const { key } = await createApiKey(database, sale?.id ?? 0, "Dana's key");

  const { cookie } = await ssoSignIn(email);
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  const keyWorked = await actorForApiKey(database, key);
  await scim(token, "PATCH", `/Users/${scimUser.id}`, {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    Operations: [{ op: "replace", value: { active: false } }],
  });
  const [turnedOff] = await database
    .select()
    .from(sales)
    .where(eq(sales.email, email));
  const keyAfter = await actorForApiKey(database, key);
  await revokeScimToken(database, row?.id ?? 0);
  const afterRevoke = await scim(token, "GET", "/Users");

  expect(created.status).toBe(201);
  expect(sale).toMatchObject({ first_name: "Dana", disabled: false });
  expect(session?.user.email).toBe(email);
  expect(keyWorked?.actor.email).toBe(email);
  expect(turnedOff?.disabled).toBe(true);
  expect(keyAfter).toBeNull();
  expect(afterRevoke.status).toBe(401);
});

test("the provider can't sign anybody in as a person outside its own domain", async () => {
  const { finished, cookie } = await ssoSignIn(ADMIN, `acme-${run}`);
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });

  expect(finished.headers.get("location")).toContain("error=account");
  expect(session).toBeNull();
});

test("an admin can register a public identity provider without adding it to TRUSTED_ORIGINS", async () => {
  const signedIn = await call("/sign-in/email", {
    body: { email: ADMIN, password: PASSWORD },
  });
  const register = (issuer: string) =>
    call("/sso/register", {
      cookie: cookiesOf(signedIn),
      body: {
        providerId: `elsewhere-${run}-${crypto.randomUUID().slice(0, 4)}`,
        issuer,
        domain: `elsewhere-${run}.test`,
        oidcConfig: {
          clientId: "id",
          clientSecret: "secret",
          discoveryEndpoint: `${issuer}/.well-known/openid-configuration`,
        },
      },
    }).then((response) => response.text());

  const publicIssuer = await register("https://login.example.invalid");
  const privateIssuer = await register("https://10.1.2.3");

  expect(publicIssuer).toContain("discovery");
  expect(publicIssuer).not.toContain("not trusted");
  expect(privateIssuer).toContain("not publicly routable");
});
