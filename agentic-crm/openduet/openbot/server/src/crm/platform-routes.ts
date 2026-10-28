import { and, asc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../auth/guards";
import type { Database } from "../db/client";
import { createApiKey, listApiKeys, revokeApiKey } from "./api-keys";
import { mergeContacts } from "./merge";
import {
  AGGREGATES,
  type CrmActor,
  type CrmRecords,
  DATE_BUCKETS,
} from "./records";
import { CrmRefusal } from "./refusal";
import { dashboards } from "./schema";

type Variables = { Variables: AppVariables };

const idOf = (raw: string) => {
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new CrmRefusal("Not found.", 404);
  return id;
};

export const reportInput = z.object({
  object: z.string().min(1).max(60),
  filter: z.record(z.string(), z.unknown()).optional(),
  group_by: z.string().max(80).optional(),
  bucket: z.enum(DATE_BUCKETS).optional(),
  fn: z.enum(AGGREGATES).default("count"),
  field: z.string().max(80).optional(),
});

export const chartInput = reportInput.extend({
  id: z.string().min(1).max(40),
  title: z.string().trim().max(80).default(""),
  type: z.enum(["number", "bar", "line", "pie", "list"]),
  width: z.number().int().min(1).max(3).default(1),
});

const dashboardInput = z.object({
  name: z.string().trim().min(1).max(80),
  shared: z.boolean().default(false),
  widgets: z.array(chartInput).max(40).default([]),
});

/** A report over an object of the data model, through the person's own access. */
export async function runReport(
  records: CrmRecords,
  actor: CrmActor,
  body: unknown,
) {
  const input = reportInput.parse(body);
  const known = (await records.metadata.objects()).some(
    (object) => object.name === input.object,
  );
  if (!known) throw new CrmRefusal("Unknown object.", 404);
  return records.aggregate(actor, input.object, {
    ...(input.filter ? { filter: input.filter } : {}),
    ...(input.group_by ? { groupBy: input.group_by } : {}),
    ...(input.bucket ? { bucket: input.bucket } : {}),
    fn: input.fn,
    ...(input.field ? { field: input.field } : {}),
  });
}

/**
 * API keys, dashboards, reports and merging contacts, under /api/crm. Keys and dashboards are their
 * owner's; an admin sees and revokes every key and changes any dashboard.
 */
export function createPlatformRoutes(deps: {
  database: Database;
  records: CrmRecords;
}) {
  const { database, records } = deps;
  const routes = new Hono<Variables>();
  const isAdmin = (actor: AppVariables["actor"]) => actor.role === "admin";

  routes.get("/api-keys", async (context) => {
    const actor = context.var.actor;
    const sale = await records.sale(actor);
    return context.json({
      data: await listApiKeys(database, isAdmin(actor) ? null : sale.id),
    });
  });

  routes.post("/api-keys", async (context) => {
    const { name } = z
      .object({ name: z.string().trim().min(1).max(80) })
      .parse(await context.req.json().catch(() => null));
    const sale = await records.sale(context.var.actor);
    const { key, row } = await createApiKey(database, sale.id, name);
    return context.json({ data: { ...row, key } }, 201);
  });

  routes.delete("/api-keys/:id", async (context) => {
    const actor = context.var.actor;
    const sale = await records.sale(actor);
    const row = await revokeApiKey(
      database,
      idOf(context.req.param("id")),
      isAdmin(actor) ? null : sale.id,
    );
    if (!row) throw new CrmRefusal("Not found.", 404);
    return context.json({ data: row });
  });

  routes.post("/reports", async (context) =>
    context.json({
      data: await runReport(
        records,
        context.var.actor,
        await context.req.json().catch(() => null),
      ),
    }),
  );

  routes.get("/dashboards", async (context) => {
    const sale = await records.sale(context.var.actor);
    return context.json({
      data: await database
        .select()
        .from(dashboards)
        .where(
          or(eq(dashboards.sales_id, sale.id), eq(dashboards.shared, true)),
        )
        .orderBy(asc(dashboards.position), asc(dashboards.id)),
    });
  });

  routes.get("/dashboards/:id", async (context) => {
    const sale = await records.sale(context.var.actor);
    const [dashboard] = await database
      .select()
      .from(dashboards)
      .where(
        and(
          eq(dashboards.id, idOf(context.req.param("id"))),
          or(eq(dashboards.sales_id, sale.id), eq(dashboards.shared, true)),
        ),
      );
    if (!dashboard) throw new CrmRefusal("Not found.", 404);
    return context.json({ data: dashboard });
  });

  routes.post("/dashboards", async (context) => {
    const sale = await records.sale(context.var.actor);
    const input = dashboardInput.parse(
      await context.req.json().catch(() => null),
    );
    const [dashboard] = await database
      .insert(dashboards)
      .values({ ...input, sales_id: sale.id })
      .returning();
    return context.json({ data: dashboard }, 201);
  });

  const ownDashboard = async (actor: AppVariables["actor"], raw: string) => {
    const [dashboard] = await database
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, idOf(raw)));
    if (!dashboard) throw new CrmRefusal("Not found.", 404);
    if (
      !isAdmin(actor) &&
      dashboard.sales_id !== (await records.sale(actor)).id
    ) {
      throw new CrmRefusal("That's someone else's dashboard.", 403);
    }
    return dashboard;
  };

  routes.put("/dashboards/:id", async (context) => {
    const dashboard = await ownDashboard(
      context.var.actor,
      context.req.param("id"),
    );
    const input = dashboardInput
      .partial()
      .parse(await context.req.json().catch(() => null));
    const [updated] = await database
      .update(dashboards)
      .set(input)
      .where(eq(dashboards.id, dashboard.id))
      .returning();
    return context.json({ data: updated });
  });

  routes.delete("/dashboards/:id", async (context) => {
    const dashboard = await ownDashboard(
      context.var.actor,
      context.req.param("id"),
    );
    await database.delete(dashboards).where(eq(dashboards.id, dashboard.id));
    return context.json({ data: null });
  });

  routes.post("/contacts/:id/merge", async (context) => {
    const { duplicate_id } = z
      .object({ duplicate_id: z.number().int() })
      .parse(await context.req.json().catch(() => null));
    return context.json({
      data: await mergeContacts(
        database,
        records,
        context.var.actor,
        idOf(context.req.param("id")),
        duplicate_id,
      ),
    });
  });

  return routes;
}
