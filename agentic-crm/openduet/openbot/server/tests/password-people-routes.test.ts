import { expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../src/auth/guards";
import { createPasswordPeopleRoutes } from "../src/people/password-routes";
import type { PeopleStore, Person } from "../src/people/store";

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  email: `${id}@acme.test`,
  name: null,
  image: null,
  role: "user",
  providers: ["credential"],
  lastSignedInAt: null,
  revoked: false,
  configuredAdmin: false,
  ...overrides,
});

const everybody: Record<string, Person> = {
  ada: person("ada"),
  new: person("new", { providers: [] }),
  google: person("google", { providers: ["google"] }),
  removed: person("removed", { revoked: true }),
};

// Signs the request in as whoever the `x-role` header says.
const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
  context,
  next,
) => {
  context.set("actor", {
    id: "actor",
    email: "actor@acme.test",
    role: context.req.header("x-role") === "admin" ? "admin" : "user",
  });
  await next();
};

const routes = createPasswordPeopleRoutes({
  requireUser,
  passwordPeople: {
    add: async () => ({ userId: "new", token: "first-token" }),
    issueLink: async () => "next-token",
  },
  peopleStore: {
    find: async (id: string) => everybody[id],
  } as unknown as PeopleStore,
});

const post = (path: string, role: "admin" | "user", body?: unknown) =>
  routes.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-role": role },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("an admin adds a person and gets their set-password link", async () => {
  const response = await post("/", "admin", {
    email: "New@Acme.test",
    name: "New Person",
  });

  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    person: { id: "new" },
    setPasswordPath: "/set-password?token=first-token",
  });
});

test("only an admin can add a person", async () => {
  const response = await post("/", "user", {
    email: "new@acme.test",
    name: "New Person",
  });

  expect(response.status).toBe(403);
});

test("adding a person needs a name and a valid address", async () => {
  const response = await post("/", "admin", { email: "not-an-address" });

  expect(response.status).toBe(400);
});

test("an admin gets a new link for somebody who signs in with a password", async () => {
  const response = await post("/ada/password-link", "admin");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    setPasswordPath: "/set-password?token=next-token",
  });
});

test("no password link is made for somebody who signs in through an identity provider", async () => {
  const response = await post("/google/password-link", "admin");

  expect(response.status).toBe(409);
});

test("no password link is made for somebody whose access is removed", async () => {
  const response = await post("/removed/password-link", "admin");

  expect(response.status).toBe(409);
});

test("a password link for somebody unknown is not found", async () => {
  const response = await post("/nobody/password-link", "admin");

  expect(response.status).toBe(404);
});
