import { count, eq, getTableColumns, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { AuthenticatedActor } from "../auth/guards";
import type { Database } from "../db/client";
import { type ListParams, listQuery, MAX_PAGE_SIZE } from "./filters";
import { CRM_RESOURCES, type CrmResource } from "./resources";
import { saleFor } from "./sales";

export type CrmRow = Record<string, unknown>;
export type CrmId = number | string;

/** A request the CRM turns down, with the HTTP status that says why. */
export class CrmRefusal extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 405,
  ) {
    super(message);
  }
}

// A non-admin may change these on their own CRM user, from the profile page.
const OWN_PROFILE_FIELDS = new Set(["first_name", "last_name", "avatar"]);

const isRecord = (value: unknown): value is CrmRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const idOf = (table: PgTable) =>
  (getTableColumns(table) as Record<string, PgColumn>).id as PgColumn;

/**
 * Every read and write of the CRM's records, for the API and the agent alike, so who may change what is
 * decided in one place. Everybody signed in reads everything; sales and the configuration are changed by
 * admins only, as in Atomic CRM.
 */
export function createCrmRecords(database: Database) {
  const resourceNamed = (name: string): CrmResource => {
    const resource = CRM_RESOURCES[name];
    if (!resource) throw new CrmRefusal("Unknown resource.", 404);
    return resource;
  };

  const readRows = (resource: CrmResource, ids: CrmId[]) =>
    database
      .select()
      .from(resource.source)
      .where(inArray(resource.columns.id as PgColumn, ids)) as Promise<
      CrmRow[]
    >;

  // The columns a write may set, once this person is allowed to make it.
  const writable = async (
    actor: AuthenticatedActor,
    resource: CrmResource,
    body: unknown,
    id?: CrmId,
  ): Promise<{ table: PgTable; values: CrmRow }> => {
    const { table } = resource;
    if (!table) throw new CrmRefusal("This can't be changed.", 405);
    if (!isRecord(body)) {
      throw new CrmRefusal("Send the record as an object.", 400);
    }
    const values = Object.fromEntries(
      Object.entries(body).filter(([key]) => resource.writable.has(key)),
    );
    if (!resource.adminOnly || actor.role === "admin") return { table, values };
    const own = await saleFor(database, actor);
    const editsOwnProfile =
      resource === CRM_RESOURCES.sales &&
      id === own.id &&
      Object.keys(values).every((key) => OWN_PROFILE_FIELDS.has(key));
    if (!editsOwnProfile) {
      throw new CrmRefusal("Only an admin can change this.", 403);
    }
    return { table, values };
  };

  return {
    sale: (actor: AuthenticatedActor) => saleFor(database, actor),

    async list(name: string, params: ListParams) {
      const resource = resourceNamed(name);
      const query = listQuery(resource.columns, params);
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
      return { data: rows as CrmRow[], total: total?.total ?? 0 };
    },

    async get(name: string, id: CrmId): Promise<CrmRow | undefined> {
      const [row] = await readRows(resourceNamed(name), [id]);
      return row;
    },

    async create(
      actor: AuthenticatedActor,
      name: string,
      body: unknown,
    ): Promise<CrmRow | undefined> {
      const resource = resourceNamed(name);
      const { table, values } = await writable(actor, resource, body);
      if (resource.ownedBySales && values.sales_id == null) {
        values.sales_id = (await saleFor(database, actor)).id;
      }
      const [created] = (await database
        .insert(table)
        .values(values as never)
        .returning({ id: idOf(table) })) as { id: number }[];
      const [row] = created ? await readRows(resource, [created.id]) : [];
      return row;
    },

    async update(
      actor: AuthenticatedActor,
      name: string,
      id: CrmId,
      body: unknown,
    ): Promise<CrmRow | undefined> {
      const resource = resourceNamed(name);
      const { table, values } = await writable(actor, resource, body, id);
      if (resource === CRM_RESOURCES.deals) {
        values.updated_at = new Date().toISOString();
      }
      if (Object.keys(values).length > 0) {
        await database
          .update(table)
          .set(values as never)
          .where(eq(idOf(table), id));
      }
      const [row] = await readRows(resource, [id]);
      return row;
    },

    async updateMany(
      actor: AuthenticatedActor,
      name: string,
      ids: number[],
      body: unknown,
    ) {
      const { table, values } = await writable(
        actor,
        resourceNamed(name),
        body,
      );
      if (ids.length && Object.keys(values).length) {
        await database
          .update(table)
          .set(values as never)
          .where(inArray(idOf(table), ids));
      }
      return ids;
    },

    async remove(
      actor: AuthenticatedActor,
      name: string,
      id: CrmId,
    ): Promise<CrmRow | undefined> {
      const resource = resourceNamed(name);
      const { table } = await writable(actor, resource, {});
      const [row] = await readRows(resource, [id]);
      if (row) await database.delete(table).where(eq(idOf(table), id));
      return row;
    },

    async removeMany(actor: AuthenticatedActor, name: string, ids: number[]) {
      const { table } = await writable(actor, resourceNamed(name), {});
      const some = ids.slice(0, MAX_PAGE_SIZE);
      if (some.length) {
        await database.delete(table).where(inArray(idOf(table), some));
      }
      return some;
    },
  };
}

export type CrmRecords = ReturnType<typeof createCrmRecords>;
