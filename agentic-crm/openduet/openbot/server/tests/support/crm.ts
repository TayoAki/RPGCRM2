import { inArray, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../../src/auth/guards";
import { createCrmRoutes } from "../../src/crm/routes";
import type { Database } from "../../src/db/client";
import { users } from "../../src/db/schema";

export type Json = Record<string, unknown>;
export type As = "admin" | "member";

/**
 * The CRM API as an admin and a member signed in, over a test database. `setUp` adds the two people,
 * `tearDown` removes them; records they made stay, named with `run` so tests never collide.
 */
export function crmTestClient(database: Database) {
  const run = crypto.randomUUID().slice(0, 8);
  const people = {
    admin: {
      id: `crm-admin-${run}`,
      email: `admin-${run}@acme.test`,
      name: "Ada Admin",
    },
    member: {
      id: `crm-member-${run}`,
      email: `member-${run}@acme.test`,
      name: "Max Member",
    },
  };
  const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
    context,
    next,
  ) => {
    const member = context.req.header("x-member") === "1";
    context.set("actor", {
      ...(member ? people.member : people.admin),
      role: member ? "user" : "admin",
    });
    await next();
  };
  const routes = createCrmRoutes({ requireUser, database });

  async function call(
    method: string,
    path: string,
    body?: unknown,
    as: As = "admin",
  ): Promise<{ status: number; json: Json }> {
    const response = await routes.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(as === "member" ? { "x-member": "1" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: (await response.json()) as Json };
  }

  return {
    run,
    people,
    routes,
    call,
    async list(resource: string, filter: Json, extra = "", as: As = "admin") {
      const { json } = await call(
        "GET",
        `/${resource}?filter=${encodeURIComponent(JSON.stringify(filter))}&perPage=100${extra}`,
        undefined,
        as,
      );
      return json as { data: Json[]; total: number };
    },
    async create(resource: string, data: Json, as: As = "admin") {
      const { status, json } = await call("POST", `/${resource}`, data, as);
      if (status !== 201) {
        throw new Error(
          `create ${resource}: ${status} ${JSON.stringify(json)}`,
        );
      }
      return json.data as Json;
    },
    async update(resource: string, id: unknown, data: Json, as: As = "admin") {
      return (await call("PUT", `/${resource}/${id}`, data, as)).json
        .data as Json;
    },
    async setUp() {
      await database.insert(users).values([
        { ...people.admin, emailVerified: false },
        { ...people.member, emailVerified: false },
      ]);
    },
    async tearDown() {
      await database
        .delete(users)
        .where(inArray(users.id, [people.admin.id, people.member.id]));
    },
  };
}

// Sets a record's date updated, which the database otherwise keeps itself.
export async function setUpdatedAt(
  database: Database,
  table: string,
  id: unknown,
  at: string,
) {
  await database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('crm.manual_dates', 'on', true)`,
    );
    await transaction.execute(
      sql`update ${sql.identifier("crm")}.${sql.identifier(table)} set updated_at = ${at} where id = ${Number(id)}`,
    );
  });
}
