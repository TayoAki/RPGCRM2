import { afterAll, beforeAll, expect, test } from "bun:test";
import { createWorkspaceStore, type Database } from "../src/db";
import { createProvisioning } from "../src/provision";
import { encrypt, hashOf } from "../src/secrets";
import { fakeProvisioner, testConfig, testDatabase } from "./support";

const run = crypto.randomUUID().slice(0, 8);
let sql: Database;

beforeAll(async () => {
  sql = await testDatabase();
});

afterAll(async () => {
  await sql`DELETE FROM platform.workspaces WHERE slug LIKE ${`%${run}`}`;
  await sql.end({ timeout: 5 });
});

const newWorkspace = (store: ReturnType<typeof createWorkspaceStore>, name: string) =>
  store.create({
    slug: `${name}-${run}`,
    company: "Acme",
    ownerName: "Dana Admin",
    ownerEmail: `dana-${run}@acme.test`,
    claimHash: hashOf("claim"),
    setupTokenSealed: encrypt(testConfig().secret, "setup-token"),
  });

test("a sign-up becomes a running workspace whose owner is its admin", async () => {
  const store = createWorkspaceStore(sql);
  const fake = fakeProvisioner();
  const provisioning = createProvisioning({
    config: testConfig(),
    store,
    provisioner: fake.provisioner,
    probe: async () => true,
  });
  const workspace = await newWorkspace(store, "ready");

  await provisioning.start(workspace.id);
  const done = await store.get(workspace.id);

  expect(done).toMatchObject({ status: "ready", app_url: "https://magpie-test.up.railway.app" });
  expect(fake.calls).toEqual([
    "createProject",
    "createDatabaseService",
    "addDatabaseVolume",
    "createAppService",
    "configureApp",
    "addDomain",
    "setVariables",
    "deployFromRepo",
  ]);
  expect(fake.variables[0]).toMatchObject({
    INITIAL_ADMIN_EMAILS: `dana-${run}@acme.test`,
    WORKSPACE_OWNER_EMAIL: `dana-${run}@acme.test`,
    WORKSPACE_SETUP_TOKEN: "setup-token",
    BETTER_AUTH_URL: "https://magpie-test.up.railway.app",
    OPENAI_API_KEY: "sk-test",
  });
});

test("after a failure, starting again carries on without making anything twice", async () => {
  const store = createWorkspaceStore(sql);
  const fake = fakeProvisioner("configureApp");
  const provisioning = createProvisioning({
    config: testConfig(),
    store,
    provisioner: fake.provisioner,
    probe: async () => true,
  });
  const workspace = await newWorkspace(store, "retry");

  await provisioning.start(workspace.id);
  const failed = await store.get(workspace.id);
  await provisioning.start(workspace.id);
  const done = await store.get(workspace.id);

  expect(failed).toMatchObject({ status: "failed", error: "configureApp broke" });
  expect(done?.status).toBe("ready");
  expect(fake.calls.filter((call) => call === "createProject")).toHaveLength(1);
  expect(fake.calls.filter((call) => call === "createAppService")).toHaveLength(1);
  expect(fake.calls.filter((call) => call === "configureApp")).toHaveLength(2);
});

test("a build that never comes up is reported, not waited on for ever", async () => {
  const store = createWorkspaceStore(sql);
  const provisioning = createProvisioning({
    config: testConfig(),
    store,
    provisioner: fakeProvisioner().provisioner,
    probe: async () => false,
    sleep: async () => {},
    buildTimeoutMs: 0,
  });
  const workspace = await newWorkspace(store, "slow");

  await provisioning.start(workspace.id);

  expect((await store.get(workspace.id))?.status).toBe("failed");
});

test("without hosting connected, a sign-up waits instead of failing", async () => {
  const store = createWorkspaceStore(sql);
  const provisioning = createProvisioning({ config: testConfig(), store });
  const workspace = await newWorkspace(store, "paused");

  await provisioning.start(workspace.id);

  expect(await store.get(workspace.id)).toMatchObject({ status: "queued", step: "waiting" });
});
