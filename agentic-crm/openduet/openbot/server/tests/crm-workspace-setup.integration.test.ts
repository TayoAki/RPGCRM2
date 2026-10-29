import { afterAll, expect, test } from "bun:test";
import { like } from "drizzle-orm";
import { createAuth } from "../src/auth";
import { createPasswordPeople } from "../src/auth/email-password";
import type { DeploymentConfig } from "../src/config";
import { createWorkspaceSetupRoutes } from "../src/crm/workspace-setup";
import { createDatabase } from "../src/db/client";
import { users } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const BASE_URL = "http://127.0.0.1:3000";
const run = crypto.randomUUID().slice(0, 8);
const OWNER = `owner-${run}@acme.test`;
const TOKEN = `setup-${run}`;

const auth = createAuth(
  {
    auth: {
      baseUrl: BASE_URL,
      secret: "x".repeat(40),
      trustedOrigins: [],
      initialAdminEmails: [OWNER],
      allowedEmailDomains: [],
      emailPassword: true,
    },
    keyEncryptionKey: Buffer.alloc(32, 7).toString("base64"),
  } as unknown as DeploymentConfig,
  database,
);
const routes = createWorkspaceSetupRoutes({
  database,
  passwordPeople: createPasswordPeople(auth),
  env: {
    WORKSPACE_SETUP_TOKEN: TOKEN,
    WORKSPACE_OWNER_EMAIL: OWNER,
    WORKSPACE_OWNER_NAME: "Olive Owner",
    APP_PUBLIC_URL: "https://acme.example",
  },
});
const ownerLink = (token: string) =>
  routes.request("/owner-link", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });

afterAll(async () => {
  await database.delete(users).where(like(users.email, `%${run}%`));
  await database.$client.end({ timeout: 5 });
});

test("the sign-up service gets the owner's set-password link until they've set a password", async () => {
  const wrongToken = await ownerLink("wrong");
  const first = await ownerLink(TOKEN);
  const again = await ownerLink(TOKEN);
  const { link } = (await again.json()) as { link: string };
  const token = new URL(link).searchParams.get("token") ?? "";
  await auth.api.resetPassword({
    body: { token, newPassword: "correct horse battery staple" },
  });
  const afterPassword = await ownerLink(TOKEN);

  expect(wrongToken.status).toBe(401);
  expect(first.status).toBe(200);
  expect(link).toStartWith("https://acme.example/set-password?token=");
  expect(afterPassword.status).toBe(409);
});
