import { afterAll, beforeAll, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { createWorkspaceStore, type Database } from "../src/db";
import type { Provisioning } from "../src/provision";
import { slugFrom } from "../src/signup";
import { testConfig, testDatabase } from "./support";

const run = crypto.randomUUID().slice(0, 8);
let sql: Database;
let app: ReturnType<typeof createApp>;
const started: string[] = [];
const pending: Promise<void>[] = [];

beforeAll(async () => {
  sql = await testDatabase();
  const store = createWorkspaceStore(sql);
  const provisioning = {
    start: (id: string) => {
      started.push(id);
      const done = store.update(id, { status: "ready", app_url: "https://acme.example", ready: true });
      pending.push(done);
      return done;
    },
    resume: async () => {},
  } as Provisioning;
  app = createApp({
    config: testConfig(),
    store,
    provisioning,
    ownerLink: async () => ({ link: "https://acme.example/set-password?token=abc" }),
  });
});

afterAll(async () => {
  await sql`DELETE FROM platform.workspaces WHERE slug LIKE ${`%${run}`}`;
  await sql.end({ timeout: 5 });
});

const signup = (body: Record<string, string>, client = run) =>
  app.request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": client },
    body: JSON.stringify(body),
  });
const form = (slug: string) => ({
  company: "Acme",
  name: "Dana Admin",
  email: "dana@acme.test",
  slug,
});

test("signing up starts a workspace, and only the person who signed up sees its progress and password link", async () => {
  const created = await signup(form(`acme-${run}`));
  const { id, next } = (await created.json()) as { id: string; next: string };
  const cookie = created.headers.get("set-cookie")?.split(";")[0] ?? "";
  await Promise.all(pending);
  const mine = await app.request(`/api/workspaces/${id}`, { headers: { cookie } });
  const theirs = await app.request(`/api/workspaces/${id}`);
  const page = await app.request(next, { headers: { cookie } });

  expect(created.status).toBe(201);
  expect(started).toContain(id);
  expect(await mine.json()).toMatchObject({
    status: "ready",
    owner_email: "dana@acme.test",
    owner_link: "https://acme.example/set-password?token=abc",
  });
  expect(theirs.status).toBe(404);
  expect(await page.text()).toContain("Setting up Acme");
});

test("an address can only be taken once, and a bad one is explained", async () => {
  await signup(form(`taken-${run}`));
  const again = await signup(form(`taken-${run}`));
  const bad = await signup(form("9-lives"));

  expect(again.status).toBe(409);
  expect(((await bad.json()) as { field: string }).field).toBe("slug");
});

test("log in sends people to their own workspace", async () => {
  await signup(form(`login-${run}`));
  await Promise.all(pending);
  const found = await app.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: `login-${run}` }),
  });
  const missing = await app.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: `nobody-${run}` }),
  });

  expect(await found.json()).toEqual({ url: "https://acme.example/sign" });
  expect(missing.status).toBe(404);
});

test("one address can't make more than a handful of workspaces an hour", async () => {
  const client = `flood-${run}`;
  const statuses = [];
  for (let index = 0; index < 6; index++) {
    statuses.push((await signup(form(`flood${index}-${run}`), client)).status);
  }

  expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true);
  expect(statuses[5]).toBe(429);
});

test("a company name becomes a workspace address", () => {
  expect(slugFrom("Acme Corp.")).toBe("acme-corp");
  expect(slugFrom("3M Café & Co")).toBe("m-cafe-co");
});
