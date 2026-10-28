import { afterAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createEnterpriseStore } from "../src/admin/settings-store";
import { createAuth } from "../src/auth";
import { createPasswordPeople } from "../src/auth/email-password";
import type { DeploymentConfig } from "../src/config";
import { createDatabase } from "../src/db/client";
import { userRoles } from "../src/db/schema";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const BASE_URL = "http://127.0.0.1:3000";
const run = crypto.randomUUID().slice(0, 8);
const address = (name: string) => `${name}-${run}@acme.test`;
const ADMIN = address("owner");
const PASSWORD = "correct horse battery staple";

const config = {
  auth: {
    baseUrl: BASE_URL,
    secret: "x".repeat(40),
    trustedOrigins: [],
    initialAdminEmails: [ADMIN],
    allowedEmailDomains: ["acme.test"],
    emailPassword: true,
  },
  keyEncryptionKey: Buffer.alloc(32, 7).toString("base64"),
} as unknown as DeploymentConfig;

const auth = createAuth(config, database);
const people = createPasswordPeople(auth);

const post = (path: string, body: unknown) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify(body),
    }),
  );

const addWithPassword = async (email: string) => {
  const { userId, token } = await people.add({ email, name: "Ada Lovelace" });
  await auth.api.resetPassword({ body: { token, newPassword: PASSWORD } });
  return userId;
};

afterAll(async () => {
  await createEnterpriseStore(database).setSetting(
    "ssoRequired",
    false,
    "test",
  );
  await database.$client.end({ timeout: 5 });
});

test("a person an admin added signs in with the password they set from the link", async () => {
  const email = address("ada");
  await addWithPassword(email);

  const response = await post("/sign-in/email", { email, password: PASSWORD });

  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("session_token");
});

test("a wrong password does not sign in", async () => {
  const email = address("grace");
  await addWithPassword(email);

  const response = await post("/sign-in/email", {
    email,
    password: "not the password at all",
  });

  expect(response.status).toBe(401);
});

test("a set-password link works once", async () => {
  const { token } = await people.add({
    email: address("alan"),
    name: "Alan Turing",
  });
  await auth.api.resetPassword({ body: { token, newPassword: PASSWORD } });

  await expect(
    auth.api.resetPassword({ body: { token, newPassword: PASSWORD } }),
  ).rejects.toThrow();
});

test("nobody can sign themselves up", async () => {
  const response = await post("/sign-up/email", {
    email: address("stranger"),
    password: PASSWORD,
    name: "Stranger",
  });

  expect(response.status).toBeGreaterThanOrEqual(400);
});

test("a visitor cannot ask for a reset link", async () => {
  const response = await post("/request-password-reset", {
    email: address("ada"),
  });

  expect(response.status).toBe(404);
});

test("an address named in INITIAL_ADMIN_EMAILS is added as an admin", async () => {
  const userId = await addWithPassword(ADMIN);

  const roles = await database
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  expect(roles.map((row) => row.role)).toContain("admin");
});

test("an address outside the admitted domains cannot be added", async () => {
  await expect(
    people.add({ email: `eve-${run}@elsewhere.test`, name: "Eve" }),
  ).rejects.toThrow();
});

test("the same address cannot be added twice", async () => {
  const email = address("twice");
  await people.add({ email, name: "Twice" });

  await expect(people.add({ email, name: "Twice" })).rejects.toThrow(
    "already here",
  );
});

test("while SSO is required, only an admin named in INITIAL_ADMIN_EMAILS signs in with a password", async () => {
  const email = address("member");
  await addWithPassword(email);
  const enterprise = createEnterpriseStore(database);
  await enterprise.setSetting("ssoRequired", true, "test");
  try {
    const member = await post("/sign-in/email", {
      email,
      password: PASSWORD,
    });
    const admin = await post("/sign-in/email", {
      email: ADMIN,
      password: PASSWORD,
    });

    expect(member.status).toBe(403);
    expect(admin.status).toBe(200);
  } finally {
    await enterprise.setSetting("ssoRequired", false, "test");
  }
});
