import {
  and,
  count,
  eq,
  getTableColumns,
  inArray,
  type SQL,
  sql,
} from "drizzle-orm";
import type { PgColumn, PgTable, PgView } from "drizzle-orm/pg-core";
import type { AuthenticatedActor } from "../auth/guards";
import type { Database } from "../db/client";
import { type Access, accessOf, fullAccess, rulesObject } from "./access";
import {
  type Columns,
  CrmQueryError,
  type ListParams,
  listQuery,
  MAX_PAGE_SIZE,
  whereOf,
} from "./filters";
import {
  createMetadata,
  EXTENSIBLE,
  type FieldDefinition,
  fieldValue,
  type Metadata,
} from "./metadata";
import { CrmRefusal } from "./refusal";
import { CRM_RESOURCES, type CrmResource } from "./resources";
import { saleFor } from "./sales";
import { contacts, deals, records } from "./schema";

export type CrmRow = Record<string, unknown>;
export type CrmId = number | string;

/**
 * The CRM itself writing, not a person: an automation's run, or a client answering a proposal link.
 * Allowed what an admin is, and named on every change it makes. New records go to `salesId`.
 */
export type ServiceActor = {
  service: string;
  salesId: number | null;
  workflow?: { id: number; runId: number };
};
export type CrmActor = AuthenticatedActor | ServiceActor;

export const AGGREGATES = ["count", "sum", "avg", "min", "max"] as const;
export const DATE_BUCKETS = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const;

export type AggregateParams = {
  filter?: unknown;
  groupBy?: string;
  bucket?: (typeof DATE_BUCKETS)[number];
  fn: (typeof AGGREGATES)[number];
  field?: string;
};

const MAX_GROUPS = 100;

export const isService = (actor: CrmActor): actor is ServiceActor =>
  "service" in actor;

// Read by the record_events trigger, so automations know who made each change.
export const originOf = (actor: CrmActor) =>
  isService(actor)
    ? actor.workflow
      ? `workflow:${actor.workflow.id}:${actor.workflow.runId}`
      : `service:${actor.service}`
    : `user:${actor.id}`;

export { CrmRefusal } from "./refusal";

// A non-admin may change these on their own CRM user, from the profile page.
const OWN_PROFILE_FIELDS = new Set(["first_name", "last_name", "avatar"]);
// Everybody signed in reads these; who changes them is the resource's own rule.
const UNRESTRICTED = new Set(["sales", "configuration", "tags"]);
// Records whose owner is their parent's.
const PARENT: Record<
  string,
  [string, PgTable & { id: PgColumn; sales_id: PgColumn }]
> = {
  contact_notes: ["contact_id", contacts],
  emails: ["contact_id", contacts],
  deal_notes: ["deal_id", deals],
  deal_stage_history: ["deal_id", deals],
};

const isRecord = (value: unknown): value is CrmRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A custom field, as SQL over the JSON that holds it, typed so filters and sorts compare right. */
export function fieldExpression(
  json: SQL | PgColumn,
  field: FieldDefinition,
): SQL {
  const text = sql`(${json} ->> ${field.name})`;
  switch (field.type) {
    case "number":
    case "currency":
    case "rating":
      return sql`(${text})::numeric`;
    case "date":
      return sql`(${text})::date`;
    case "datetime":
      return sql`(${text})::timestamptz`;
    case "boolean":
      return sql`(${text})::boolean`;
    case "relation":
      return sql`(${text})::bigint`;
    case "multi_select":
      return sql`array(select jsonb_array_elements_text(${json} -> ${field.name}))`;
    default:
      return text;
  }
}

type Target = {
  // The resource asked for, and the object whose rules it follows.
  name: string;
  object: string;
  resource: CrmResource;
  columns: Columns;
  // A custom object's fields; its rows live in crm.records.
  custom?: FieldDefinition[];
  // A standard object's custom fields, in its custom_fields column.
  customFields?: FieldDefinition[];
};

/**
 * Every read and write of the CRM's records, for the API, the agent and automations alike, so who may
 * see and change what is decided in one place: an admin everything, everybody else what their role
 * allows (access.ts). Sales and the configuration are changed by admins only, as in Atomic CRM.
 */
export function createCrmRecords(
  database: Database,
  metadata: Metadata = createMetadata(database),
) {
  async function resolve(name: string): Promise<Target> {
    const resource = CRM_RESOURCES[name];
    if (resource) {
      const object = rulesObject(name);
      if (!EXTENSIBLE.has(object))
        return { name, object, resource, columns: resource.columns };
      const customFields = await metadata.fieldsOf(object, "custom");
      const json = resource.columns.custom_fields as PgColumn;
      return {
        name,
        object,
        resource,
        customFields,
        columns: {
          ...resource.columns,
          ...Object.fromEntries(
            customFields.map((field) => [
              `custom_fields.${field.name}`,
              fieldExpression(json, field),
            ]),
          ),
        },
      };
    }
    const definition = (await metadata.objects()).find(
      (object) => object.name === name && !object.standard,
    );
    if (!definition) throw new CrmRefusal("Unknown resource.", 404);
    const custom = await metadata.fieldsOf(name);
    return {
      name,
      object: name,
      custom,
      resource: {
        source: records,
        table: records,
        columns: getTableColumns(records) as Columns,
        writable: new Set(),
        ownedBySales: true,
      },
      columns: {
        id: records.id,
        created_at: records.created_at,
        updated_at: records.updated_at,
        sales_id: records.sales_id,
        ...Object.fromEntries(
          custom.map((field) => [
            field.name,
            fieldExpression(records.data, field),
          ]),
        ),
      },
    };
  }

  const accessFor = (actor: CrmActor): Promise<Access> =>
    isService(actor)
      ? Promise.resolve(fullAccess(actor.salesId))
      : accessOf(database, actor);

  const idColumn = (target: Target) => target.columns.id as PgColumn;

  // Which rows a person may reach for an action, as a condition: all, their own, or none.
  function reachable(
    target: Target,
    access: Access,
    action: "read" | "update" | "delete",
  ) {
    if (UNRESTRICTED.has(target.name)) return undefined;
    const reach = access.reach(target.object, action);
    if (reach === "all" || access.full) return undefined;
    if (reach === "none") {
      throw new CrmRefusal(
        `Your role doesn't let you ${action === "read" ? "see" : action} ${target.object.replaceAll("_", " ")}.`,
        403,
      );
    }
    const parent = PARENT[target.name];
    if (parent) {
      const [key, table] = parent;
      return sql`${target.columns[key]} in (select ${table.id} from ${table} where ${table.sales_id} = ${access.salesId})`;
    }
    const owner = target.columns.sales_id;
    return owner ? sql`${owner} = ${access.salesId}` : sql`false`;
  }

  // A row as this person may see it: hidden fields left out, custom objects' data flattened.
  function shape(target: Target, access: Access, row: CrmRow): CrmRow {
    let shaped = row;
    if (target.custom) {
      const { data, object: _, ...rest } = row as CrmRow & { data: CrmRow };
      shaped = { ...data, ...rest };
    }
    if (access.full) return shaped;
    const hidden = access.hidden(target.object);
    if (!hidden.length) return shaped;
    const visible = Object.fromEntries(
      Object.entries(shaped).filter(([key]) => !hidden.includes(key)),
    );
    if (isRecord(visible.custom_fields)) {
      visible.custom_fields = Object.fromEntries(
        Object.entries(visible.custom_fields).filter(
          ([key]) => !hidden.includes(key),
        ),
      );
    }
    return visible;
  }

  // The activity log carries whole records: each is shaped by its own object's rules.
  function shapeActivity(access: Access, row: CrmRow): CrmRow | null {
    if (access.full) return row;
    const nested: [string, string][] = [
      ["company", "companies"],
      ["contact", "contacts"],
      ["deal", "deals"],
      ["contact_note", "contacts"],
      ["deal_note", "deals"],
    ];
    const out: CrmRow = { ...row };
    for (const [key, object] of nested) {
      const value = row[key];
      if (!isRecord(value)) continue;
      if (access.reach(object, "read") === "none") return null;
      const hidden = access.hidden(object);
      out[key] = Object.fromEntries(
        Object.entries(value).filter(([field]) => !hidden.includes(field)),
      );
    }
    return out;
  }

  const readRows = async (target: Target, ids: CrmId[], extra?: SQL) =>
    (await database
      .select()
      .from(target.resource.source as PgTable | PgView)
      .where(
        and(
          inArray(idColumn(target), ids),
          target.custom ? eq(records.object, target.object) : undefined,
          extra,
        ),
      )) as CrmRow[];

  // Removing a sale or the configuration is an admin's.
  function removable(actor: CrmActor, target: Target): PgTable {
    const table = target.resource.table;
    if (!table) throw new CrmRefusal("This can't be changed.", 405);
    if (
      target.resource.adminOnly &&
      !isService(actor) &&
      actor.role !== "admin"
    ) {
      throw new CrmRefusal("Only an admin can change this.", 403);
    }
    return table;
  }

  // The columns a write may set, once this person is allowed to make it.
  async function writable(
    actor: CrmActor,
    access: Access,
    target: Target,
    body: unknown,
    existing?: CrmRow,
  ): Promise<{ table: PgTable; values: CrmRow }> {
    const { resource } = target;
    const table = resource.table;
    if (!table) throw new CrmRefusal("This can't be changed.", 405);
    if (!isRecord(body))
      throw new CrmRefusal("Send the record as an object.", 400);
    const allowed = (field: string) =>
      access.full || access.rule(target.object, field) === undefined;

    if (target.custom) {
      const data: CrmRow = {};
      for (const field of target.custom) {
        if (!(field.name in body) && existing) continue;
        if (!allowed(field.name)) continue;
        data[field.name] = fieldValue(field, body[field.name]);
      }
      const values: CrmRow = {
        object: target.object,
        data: existing
          ? sql`jsonb_strip_nulls(${records.data} || ${data}::jsonb)`
          : stripNulls(data),
      };
      if ("sales_id" in body && allowed("sales_id"))
        values.sales_id = body.sales_id;
      return { table, values };
    }

    const values = Object.fromEntries(
      Object.entries(body).filter(
        ([key]) => resource.writable.has(key) && allowed(key),
      ),
    );
    if (target.customFields && isRecord(body.custom_fields)) {
      const changes: CrmRow = {};
      for (const field of target.customFields) {
        if (!(field.name in body.custom_fields) || !allowed(field.name))
          continue;
        changes[field.name] = fieldValue(field, body.custom_fields[field.name]);
      }
      const json = (getTableColumns(table) as Record<string, PgColumn>)
        .custom_fields as PgColumn;
      values.custom_fields = existing
        ? sql`jsonb_strip_nulls(coalesce(${json}, '{}'::jsonb) || ${changes}::jsonb)`
        : stripNulls(changes);
    } else if (target.customFields) {
      delete values.custom_fields;
    }
    if (!resource.adminOnly || isService(actor) || actor.role === "admin") {
      return { table, values };
    }
    const own = await saleFor(database, actor);
    const editsOwnProfile =
      resource === CRM_RESOURCES.sales &&
      existing?.id === own.id &&
      Object.keys(values).every((key) => OWN_PROFILE_FIELDS.has(key));
    if (!editsOwnProfile)
      throw new CrmRefusal("Only an admin can change this.", 403);
    return { table, values };
  }

  const ownerOf = async (actor: CrmActor) =>
    isService(actor) ? actor.salesId : (await saleFor(database, actor)).id;

  // One write, in a transaction that says who made it.
  const writeAs = <TResult>(
    actor: CrmActor,
    work: (transaction: Database) => Promise<TResult>,
  ) =>
    database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select set_config('crm.actor', ${originOf(actor)}, true)`,
      );
      return work(transaction as unknown as Database);
    });

  // The rows a write may touch: they exist, and the person's role reaches them.
  async function reachableRows(
    target: Target,
    access: Access,
    action: "update" | "delete",
    ids: CrmId[],
  ) {
    return readRows(target, ids, reachable(target, access, action));
  }

  return {
    sale: (actor: AuthenticatedActor) => saleFor(database, actor),
    metadata,
    accessFor,

    async list(
      actor: CrmActor,
      name: string,
      params: ListParams,
    ): Promise<{ data: CrmRow[]; total: number }> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const hidden = access.full ? [] : access.hidden(target.object);
      const columns = Object.fromEntries(
        Object.entries(target.columns).filter(
          ([key]) => !hidden.includes(key.replace(/^custom_fields\./, "")),
        ),
      );
      const query = listQuery(columns, params);
      const where = and(
        query.where,
        target.custom ? eq(records.object, target.object) : undefined,
        reachable(target, access, "read"),
      );
      const source = target.resource.source as PgTable | PgView;
      const [rows, [total]] = await Promise.all([
        database
          .select()
          .from(source)
          .where(where)
          .orderBy(...query.orderBy)
          .limit(query.limit)
          .offset(query.offset),
        database.select({ total: count() }).from(source).where(where),
      ]);
      const data: CrmRow[] =
        name === "activity_log"
          ? (rows as CrmRow[]).flatMap((row) => {
              const shaped = shapeActivity(access, row);
              return shaped ? [shaped] : [];
            })
          : (rows as CrmRow[]).map((row) => shape(target, access, row));
      return { data, total: total?.total ?? 0 };
    },

    /** A count, sum, average, minimum or maximum over the rows a person may see, overall or per group. */
    async aggregate(
      actor: CrmActor,
      name: string,
      params: AggregateParams,
    ): Promise<{ key: unknown; value: number }[]> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const hidden = access.full ? [] : access.hidden(target.object);
      const columns = Object.fromEntries(
        Object.entries(target.columns).filter(
          ([key]) => !hidden.includes(key.replace(/^custom_fields\./, "")),
        ),
      );
      const column = (key: string) => {
        const found = columns[key];
        if (!found) throw new CrmQueryError(`Unknown field: ${key}`);
        return found;
      };
      const measured = params.field ? column(params.field) : undefined;
      const numeric = measured && sql`(${measured})::numeric`;
      const value =
        params.fn === "count" || !numeric
          ? sql<number>`count(*)::float8`
          : params.fn === "sum"
            ? sql<number>`coalesce(sum(${numeric}), 0)::float8`
            : params.fn === "avg"
              ? sql<number>`coalesce(avg(${numeric}), 0)::float8`
              : params.fn === "min"
                ? sql<number>`coalesce(min(${numeric}), 0)::float8`
                : sql<number>`coalesce(max(${numeric}), 0)::float8`;
      const where = and(
        whereOf(columns, params.filter),
        target.custom ? eq(records.object, target.object) : undefined,
        reachable(target, access, "read"),
      );
      const source = target.resource.source as PgTable | PgView;
      if (!params.groupBy) {
        const [row] = await database
          .select({ value })
          .from(source)
          .where(where);
        return [{ key: null, value: Number(row?.value ?? 0) }];
      }
      const grouped = column(params.groupBy);
      const key = params.bucket
        ? sql`date_trunc(${params.bucket}, ${grouped})`
        : sql`${grouped}`;
      const rows = await database
        .select({ key, value })
        .from(source)
        .where(params.bucket ? and(where, sql`${grouped} is not null`) : where)
        .groupBy(sql`1`)
        .orderBy(params.bucket ? sql`1` : sql`2 desc`)
        .limit(MAX_GROUPS);
      return rows.map((row) => ({
        key: row.key instanceof Date ? row.key.toISOString() : row.key,
        value: Number(row.value),
      }));
    },

    /** Whether this person's role reaches a record for an action. */
    async reaches(
      actor: CrmActor,
      name: string,
      id: CrmId,
      action: "read" | "update" | "delete",
    ): Promise<boolean> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      try {
        return (
          (await readRows(target, [id], reachable(target, access, action)))
            .length > 0
        );
      } catch (error) {
        if (error instanceof CrmRefusal) return false;
        throw error;
      }
    },

    async get(
      actor: CrmActor,
      name: string,
      id: CrmId,
    ): Promise<CrmRow | undefined> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const [row] = await readRows(
        target,
        [id],
        reachable(target, access, "read"),
      );
      return row ? shape(target, access, row) : undefined;
    },

    async create(
      actor: CrmActor,
      name: string,
      body: unknown,
    ): Promise<CrmRow | undefined> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      if (!access.full && !access.canCreate(target.object)) {
        throw new CrmRefusal(
          `Your role doesn't let you add ${target.object.replaceAll("_", " ")}.`,
          403,
        );
      }
      const { table, values } = await writable(actor, access, target, body);
      if (target.resource.ownedBySales && values.sales_id == null) {
        values.sales_id = await ownerOf(actor);
      }
      const [created] = (await writeAs(actor, (transaction) =>
        transaction
          .insert(table)
          .values(values as never)
          .returning({
            id: (getTableColumns(table) as Record<string, PgColumn>)
              .id as PgColumn,
          }),
      )) as { id: number }[];
      const [row] = created ? await readRows(target, [created.id]) : [];
      return row ? shape(target, access, row) : undefined;
    },

    async update(
      actor: CrmActor,
      name: string,
      id: CrmId,
      body: unknown,
    ): Promise<CrmRow | undefined> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const [existing] = await reachableRows(target, access, "update", [id]);
      if (!existing) return undefined;
      const { table, values } = await writable(
        actor,
        access,
        target,
        body,
        existing,
      );
      if (Object.keys(values).length > 0) {
        await writeAs(actor, (transaction) =>
          transaction
            .update(table)
            .set(values as never)
            .where(
              eq(
                (getTableColumns(table) as Record<string, PgColumn>)
                  .id as PgColumn,
                id,
              ),
            ),
        );
      }
      const [row] = await readRows(target, [id]);
      return row ? shape(target, access, row) : undefined;
    },

    async updateMany(
      actor: CrmActor,
      name: string,
      ids: number[],
      body: unknown,
    ) {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const rows = await reachableRows(target, access, "update", ids);
      const reached = rows.map((row) => Number(row.id));
      for (const row of rows) {
        const { table, values } = await writable(
          actor,
          access,
          target,
          body,
          row,
        );
        if (!Object.keys(values).length) continue;
        await writeAs(actor, (transaction) =>
          transaction
            .update(table)
            .set(values as never)
            .where(
              eq(
                (getTableColumns(table) as Record<string, PgColumn>)
                  .id as PgColumn,
                row.id,
              ),
            ),
        );
      }
      return reached;
    },

    async remove(
      actor: CrmActor,
      name: string,
      id: CrmId,
    ): Promise<CrmRow | undefined> {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const table = removable(actor, target);
      const [row] = await reachableRows(target, access, "delete", [id]);
      if (row) {
        await writeAs(actor, (transaction) =>
          transaction
            .delete(table)
            .where(
              eq(
                (getTableColumns(table) as Record<string, PgColumn>)
                  .id as PgColumn,
                id,
              ),
            ),
        );
      }
      return row ? shape(target, access, row) : undefined;
    },

    async removeMany(actor: CrmActor, name: string, ids: number[]) {
      const access = await accessFor(actor);
      const target = await resolve(name);
      const table = removable(actor, target);
      const rows = await reachableRows(
        target,
        access,
        "delete",
        ids.slice(0, MAX_PAGE_SIZE),
      );
      const some = rows.map((row) => Number(row.id));
      if (some.length) {
        await writeAs(actor, (transaction) =>
          transaction
            .delete(table)
            .where(
              inArray(
                (getTableColumns(table) as Record<string, PgColumn>)
                  .id as PgColumn,
                some,
              ),
            ),
        );
      }
      return some;
    },
  };
}

const stripNulls = (values: CrmRow) =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== null),
  );

export type CrmRecords = ReturnType<typeof createCrmRecords>;
