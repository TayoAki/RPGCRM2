import { count, eq, getTableColumns, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppVariables } from "../auth/guards";
import type { Database } from "../db/client";
import { CrmQueryError, listQuery, MAX_PAGE_SIZE } from "./filters";
import { CRM_RESOURCES, type CrmResource } from "./resources";
import { type Sale, saleFor } from "./sales";
import { globalSearch, SEARCH_RESOURCES, type SearchResource } from "./search";

type Variables = { Variables: AppVariables };
type Row = Record<string, unknown>;

// Attachments travel inside the record as data URLs until they move to file storage.
const MAX_BODY_BYTES = 10 * 1024 * 1024;

// A non-admin may change these on their own CRM user, from the profile page.
const OWN_PROFILE_FIELDS = new Set(["first_name", "last_name", "avatar"]);

const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseId(raw: string): number | string {
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

function parseIds(raw: string | undefined): number[] {
  return (raw ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isSafeInteger);
}

const idOf = (table: PgTable) =>
  (getTableColumns(table) as Record<string, PgColumn>).id as PgColumn;

/**
 * The CRM's data API: the list, read and write operations react-admin's data provider makes, for every
 * resource in CRM_RESOURCES, plus global search. Everybody signed in reads everything; sales and the
 * configuration are changed by admins only, as in Atomic CRM. Mounted at /api/crm.
 */
export function createCrmRoutes(deps: {
  requireUser: MiddlewareHandler<Variables>;
  database: Database;
}) {
  const { database } = deps;
  const routes = new Hono<Variables>();
  routes.use("*", deps.requireUser);
  routes.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (context) =>
        context.json(
          { error: "That's too large. Keep files under 7 MB." },
          413,
        ),
    }),
  );

  const sale = (context: Context<Variables>) =>
    saleFor(database, context.var.actor);

  const resourceOf = (context: Context<Variables>) =>
    CRM_RESOURCES[context.req.param("resource") ?? ""];

  const readRows = (resource: CrmResource, ids: (number | string)[]) =>
    database
      .select()
      .from(resource.source)
      .where(inArray(resource.columns.id as PgColumn, ids)) as Promise<Row[]>;

  // The columns a write may set, and whether this person may make it.
  const writeOf = async (
    context: Context<Variables>,
    resource: CrmResource,
    body: unknown,
    id?: number | string,
  ): Promise<Row | Response> => {
    if (!resource.table) {
      return context.json({ error: "This can't be changed." }, 405);
    }
    if (!isRecord(body)) {
      return context.json({ error: "Send the record as an object." }, 400);
    }
    const values = Object.fromEntries(
      Object.entries(body).filter(([key]) => resource.writable.has(key)),
    );
    if (!resource.adminOnly || context.var.actor.role === "admin") {
      return values;
    }
    const own: Sale = await sale(context);
    const editsOwnProfile =
      resource === CRM_RESOURCES.sales &&
      id === own.id &&
      Object.keys(values).every((key) => OWN_PROFILE_FIELDS.has(key));
    return editsOwnProfile
      ? values
      : context.json({ error: "Only an admin can change this." }, 403);
  };

  routes.get("/me", async (context) =>
    context.json({ data: await sale(context) }),
  );

  routes.get("/search", async (context) => {
    const requested = (context.req.query("resources") ?? "")
      .split(",")
      .filter((name): name is SearchResource =>
        (SEARCH_RESOURCES as readonly string[]).includes(name),
      );
    const limit = Math.min(
      200,
      Math.max(1, Number(context.req.query("max")) || 50),
    );
    return context.json({
      data: await globalSearch(
        database,
        context.req.query("q") ?? "",
        requested.length ? requested : SEARCH_RESOURCES,
        limit,
      ),
    });
  });

  routes.get("/:resource", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const query = listQuery(
      resource.columns,
      new URL(context.req.url).searchParams,
    );
    const [rows, [total]] = await Promise.all([
      database
        .select()
        .from(resource.source)
        .where(query.where)
        .orderBy(...query.orderBy)
        .limit(query.limit)
        .offset(query.offset),
      database
        .select({ total: count() })
        .from(resource.source)
        .where(query.where),
    ]);
    return context.json({ data: rows, total: total?.total ?? 0 });
  });

  routes.get("/:resource/:id", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const [row] = await readRows(resource, [parseId(context.req.param("id"))]);
    return row
      ? context.json({ data: row })
      : context.json({ error: "Not found." }, 404);
  });

  routes.post("/:resource", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const values = await writeOf(
      context,
      resource,
      await context.req.json().catch(() => null),
    );
    if (values instanceof Response) return values;
    if (resource.ownedBySales && values.sales_id == null) {
      values.sales_id = (await sale(context)).id;
    }
    const table = resource.table as PgTable;
    const [created] = (await database
      .insert(table)
      .values(values as never)
      .returning({ id: idOf(table) })) as { id: number }[];
    const [row] = created ? await readRows(resource, [created.id]) : [];
    return context.json({ data: row }, 201);
  });

  routes.put("/:resource/:id", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const id = parseId(context.req.param("id"));
    const values = await writeOf(
      context,
      resource,
      await context.req.json().catch(() => null),
      id,
    );
    if (values instanceof Response) return values;
    if (resource === CRM_RESOURCES.deals) {
      values.updated_at = new Date().toISOString();
    }
    const table = resource.table as PgTable;
    if (Object.keys(values).length > 0) {
      await database
        .update(table)
        .set(values as never)
        .where(eq(idOf(table), id));
    }
    const [row] = await readRows(resource, [id]);
    return row
      ? context.json({ data: row })
      : context.json({ error: "Not found." }, 404);
  });

  routes.put("/:resource", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const ids = parseIds(context.req.query("ids"));
    const values = await writeOf(
      context,
      resource,
      await context.req.json().catch(() => null),
    );
    if (values instanceof Response) return values;
    const table = resource.table as PgTable;
    if (ids.length && Object.keys(values).length) {
      await database
        .update(table)
        .set(values as never)
        .where(inArray(idOf(table), ids));
    }
    return context.json({ data: ids });
  });

  routes.delete("/:resource/:id", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const id = parseId(context.req.param("id"));
    const denied = await writeOf(context, resource, {});
    if (denied instanceof Response) return denied;
    const [row] = await readRows(resource, [id]);
    if (!row) return context.json({ error: "Not found." }, 404);
    const table = resource.table as PgTable;
    await database.delete(table).where(eq(idOf(table), id));
    return context.json({ data: row });
  });

  routes.delete("/:resource", async (context) => {
    const resource = resourceOf(context);
    if (!resource) return context.json({ error: "Unknown resource." }, 404);
    const ids = parseIds(context.req.query("ids")).slice(0, MAX_PAGE_SIZE);
    const denied = await writeOf(context, resource, {});
    if (denied instanceof Response) return denied;
    const table = resource.table as PgTable;
    if (ids.length) {
      await database.delete(table).where(inArray(idOf(table), ids));
    }
    return context.json({ data: ids });
  });

  routes.onError((error, context) => {
    if (error instanceof CrmQueryError) {
      return context.json({ error: error.message }, 400);
    }
    const cause = (error as { cause?: Record<string, unknown> }).cause;
    const postgresCode = String(cause?.errno ?? cause?.code ?? "");
    if (postgresCode.startsWith("22") || postgresCode.startsWith("23")) {
      console.error(
        JSON.stringify({
          type: "crm-write-refused",
          path: context.req.path,
          code: postgresCode,
          detail: String(cause?.message ?? ""),
        }),
      );
    }
    if (postgresCode === "23503") {
      return context.json(
        { error: "It's linked to other records, so it can't change." },
        409,
      );
    }
    if (postgresCode.startsWith("22") || postgresCode.startsWith("23")) {
      return context.json(
        { error: "Some of those values don't fit. Check the form." },
        400,
      );
    }
    throw error;
  });

  return routes;
}
