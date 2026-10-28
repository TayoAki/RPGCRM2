import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../auth/guards";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { roleRules, rulesObject } from "./access";
import { EXTENSIBLE } from "./metadata";
import { type CrmRecords, CrmRefusal } from "./records";
import { CRM_RESOURCES } from "./resources";
import { recordEvents, recordNotes, roles, views } from "./schema";

type Variables = { Variables: AppVariables };

const adminOnly = (actor: AppVariables["actor"]) => {
  if (actor.role !== "admin")
    throw new CrmRefusal("Only an admin can change this.", 403);
};

const idOf = (raw: string) => {
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new CrmRefusal("Not found.", 404);
  return id;
};

const roleInput = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(500).default(""),
  rules: roleRules,
});

const viewInput = z.object({
  object: z.string().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["table", "kanban", "calendar"]).default("table"),
  config: z
    .object({
      filter: z.record(z.string(), z.unknown()).optional(),
      sort: z
        .object({ field: z.string(), order: z.enum(["ASC", "DESC"]) })
        .optional(),
      columns: z.array(z.string()).max(60).optional(),
      group_by: z.string().optional(),
      date_field: z.string().optional(),
    })
    .default({}),
  shared: z.boolean().default(false),
  position: z.number().int().min(0).max(10_000).optional(),
});

// The table whose changes a resource's history shows.
const historyTable = (name: string) =>
  CRM_RESOURCES[name] ? rulesObject(name).replace(/_summary$/, "") : "records";

/**
 * The data model (objects and fields), roles, saved views, notes on custom records and each record's
 * history, under /api/crm. Changing the model and roles is an admin's; views are their owner's.
 */
export function createModelRoutes(deps: {
  database: Database;
  records: CrmRecords;
}) {
  const { database, records } = deps;
  const { metadata } = records;
  const routes = new Hono<Variables>();

  routes.get("/metadata", async (context) => {
    const { objects, fields } = await metadata.load();
    return context.json({ data: { objects, fields } });
  });

  routes.post("/metadata/objects", async (context) => {
    adminOnly(context.var.actor);
    return context.json(
      {
        data: await metadata.createObject(
          await context.req.json().catch(() => null),
        ),
      },
      201,
    );
  });

  routes.put("/metadata/objects/:name", async (context) => {
    adminOnly(context.var.actor);
    const body = await context.req.json().catch(() => null);
    return context.json({
      data: await metadata.updateObject(context.req.param("name"), body),
    });
  });

  routes.delete("/metadata/objects/:name", async (context) => {
    adminOnly(context.var.actor);
    await metadata.removeObject(context.req.param("name"));
    return context.json({ data: null });
  });

  routes.post("/metadata/objects/:name/fields", async (context) => {
    adminOnly(context.var.actor);
    const body = await context.req.json().catch(() => null);
    return context.json(
      { data: await metadata.createField(context.req.param("name"), body) },
      201,
    );
  });

  routes.put("/metadata/objects/:name/fields/:field", async (context) => {
    adminOnly(context.var.actor);
    const body = await context.req.json().catch(() => null);
    return context.json({
      data: await metadata.updateField(
        context.req.param("name"),
        context.req.param("field"),
        body,
      ),
    });
  });

  routes.delete("/metadata/objects/:name/fields/:field", async (context) => {
    adminOnly(context.var.actor);
    await metadata.removeField(
      context.req.param("name"),
      context.req.param("field"),
    );
    return context.json({ data: null });
  });

  // What the signed-in person may do, so the screens hide what their role doesn't allow.
  routes.get("/me/access", async (context) => {
    const access = await records.accessFor(context.var.actor);
    const objects = await metadata.objects();
    const { fields } = await metadata.load();
    return context.json({
      data: {
        full: access.full,
        objects: Object.fromEntries(
          objects.map((object) => [
            object.name,
            {
              read: access.reach(object.name, "read"),
              create: access.canCreate(object.name),
              update: access.reach(object.name, "update"),
              delete: access.reach(object.name, "delete"),
              hidden: access.hidden(object.name),
              read_only: fields
                .filter(
                  (field) =>
                    field.object === object.name &&
                    access.rule(object.name, field.name) === "read_only",
                )
                .map((field) => field.name),
            },
          ]),
        ),
      },
    });
  });

  routes.get("/roles", async (context) => {
    adminOnly(context.var.actor);
    return context.json({
      data: await database.select().from(roles).orderBy(asc(roles.id)),
    });
  });

  routes.post("/roles", async (context) => {
    adminOnly(context.var.actor);
    const input = roleInput.parse(await context.req.json().catch(() => null));
    const [role] = await database.insert(roles).values(input).returning();
    return context.json({ data: role }, 201);
  });

  routes.put("/roles/:id", async (context) => {
    adminOnly(context.var.actor);
    const input = roleInput.parse(await context.req.json().catch(() => null));
    const [role] = await database
      .update(roles)
      .set(input)
      .where(eq(roles.id, idOf(context.req.param("id"))))
      .returning();
    if (!role) throw new CrmRefusal("Not found.", 404);
    return context.json({ data: role });
  });

  routes.delete("/roles/:id", async (context) => {
    adminOnly(context.var.actor);
    await database
      .delete(roles)
      .where(eq(roles.id, idOf(context.req.param("id"))));
    return context.json({ data: null });
  });

  routes.get("/views", async (context) => {
    const sale = await records.sale(context.var.actor);
    const object = context.req.query("object");
    const rows = await database
      .select()
      .from(views)
      .where(
        and(
          object ? eq(views.object, object) : undefined,
          or(eq(views.sales_id, sale.id), eq(views.shared, true)),
        ),
      )
      .orderBy(asc(views.position), asc(views.id));
    return context.json({ data: rows });
  });

  routes.post("/views", async (context) => {
    const sale = await records.sale(context.var.actor);
    const input = viewInput.parse(await context.req.json().catch(() => null));
    const [view] = await database
      .insert(views)
      .values({ ...input, sales_id: sale.id })
      .returning();
    return context.json({ data: view }, 201);
  });

  // A view is changed by whoever made it, or an admin.
  const ownView = async (actor: AppVariables["actor"], raw: string) => {
    const [view] = await database
      .select()
      .from(views)
      .where(eq(views.id, idOf(raw)));
    if (!view) throw new CrmRefusal("Not found.", 404);
    if (
      actor.role !== "admin" &&
      view.sales_id !== (await records.sale(actor)).id
    ) {
      throw new CrmRefusal("That's someone else's view.", 403);
    }
    return view;
  };

  routes.put("/views/:id", async (context) => {
    const view = await ownView(context.var.actor, context.req.param("id"));
    const input = viewInput
      .partial()
      .parse(await context.req.json().catch(() => null));
    const [updated] = await database
      .update(views)
      .set(input)
      .where(eq(views.id, view.id))
      .returning();
    return context.json({ data: updated });
  });

  routes.delete("/views/:id", async (context) => {
    const view = await ownView(context.var.actor, context.req.param("id"));
    await database.delete(views).where(eq(views.id, view.id));
    return context.json({ data: null });
  });

  // Notes on a custom object's record: anyone who can see the record reads them; who can change it adds them.
  routes.get("/notes/:object/:id", async (context) => {
    const id = idOf(context.req.param("id"));
    const record = await records.get(
      context.var.actor,
      context.req.param("object"),
      id,
    );
    if (!record) throw new CrmRefusal("Not found.", 404);
    const notes = await database
      .select()
      .from(recordNotes)
      .where(eq(recordNotes.record_id, id))
      .orderBy(desc(recordNotes.date));
    return context.json({ data: notes });
  });

  routes.post("/notes/:object/:id", async (context) => {
    const object = context.req.param("object");
    const id = idOf(context.req.param("id"));
    const body = (await context.req.json().catch(() => ({}))) as {
      text?: unknown;
    };
    const text =
      typeof body.text === "string" ? body.text.trim().slice(0, 100_000) : "";
    if (!text) throw new CrmRefusal("Write the note first.", 400);
    if (!(await records.reaches(context.var.actor, object, id, "update"))) {
      throw new CrmRefusal("Not found.", 404);
    }
    const sale = await records.sale(context.var.actor);
    const [note] = await database
      .insert(recordNotes)
      .values({ record_id: id, text, sales_id: sale.id })
      .returning();
    return context.json({ data: note }, 201);
  });

  routes.get("/linked/:object/:id", async (context) =>
    context.json({
      data: await linkedRecords(
        records,
        context.var.actor,
        context.req.param("object"),
        idOf(context.req.param("id")),
      ),
    }),
  );

  // A record's changes, newest first: who made each one, and what changed, minus hidden fields.
  routes.get("/history/:resource/:id", async (context) => {
    const name = context.req.param("resource");
    const id = idOf(context.req.param("id"));
    const actor = context.var.actor;
    const record = await records.get(actor, name, id);
    if (!record) throw new CrmRefusal("Not found.", 404);
    const access = await records.accessFor(actor);
    const object = CRM_RESOURCES[name] ? rulesObject(name) : name;
    const hidden = new Set(access.full ? [] : access.hidden(object));
    const table = historyTable(name);
    const events = await database
      .select()
      .from(recordEvents)
      .where(
        and(eq(recordEvents.object, table), eq(recordEvents.record_id, id)),
      )
      .orderBy(desc(recordEvents.id))
      .limit(200);
    const userIds = [
      ...new Set(
        events.flatMap((event) =>
          event.actor?.startsWith("user:") ? [event.actor.slice(5)] : [],
        ),
      ),
    ];
    const people = userIds.length
      ? await database
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const nameOf = new Map(people.map((person) => [person.id, person.name]));
    const custom = table === "records";
    const fieldsOf = (row: unknown) => {
      const value = (row ?? {}) as Record<string, unknown>;
      const flat = custom
        ? ((value.data as Record<string, unknown> | undefined) ?? {})
        : EXTENSIBLE.has(object)
          ? {
              ...value,
              ...((value.custom_fields as Record<string, unknown>) ?? {}),
            }
          : value;
      return flat;
    };
    const IGNORED = new Set(["updated_at", "custom_fields", "data", "index"]);
    const data = events.map((event) => {
      const before = fieldsOf(event.old);
      const after = fieldsOf(event.new);
      const changes =
        event.action === "updated"
          ? [...new Set([...Object.keys(before), ...Object.keys(after)])]
              .filter(
                (field) =>
                  !IGNORED.has(field) &&
                  !hidden.has(field) &&
                  JSON.stringify(before[field] ?? null) !==
                    JSON.stringify(after[field] ?? null),
              )
              .map((field) => ({
                field,
                from: before[field] ?? null,
                to: after[field] ?? null,
              }))
          : [];
      const actorText = event.actor ?? "";
      return {
        id: event.id,
        at: event.at,
        action: event.action,
        by: actorText.startsWith("user:")
          ? {
              kind: "person",
              name: nameOf.get(actorText.slice(5)) ?? "Someone",
            }
          : actorText.startsWith("workflow:")
            ? { kind: "automation", id: Number(actorText.split(":")[1]) }
            : actorText.startsWith("service:")
              ? { kind: "system", name: actorText.slice(8) }
              : { kind: "unknown" },
        changes,
      };
    });
    return context.json({ data });
  });

  return routes;
}

// Custom records whose relation fields point at a record, for its page's "Linked records".
export async function linkedRecords(
  records: CrmRecords,
  actor: AppVariables["actor"],
  object: string,
  id: number,
) {
  const relations = (await records.metadata.load()).fields.filter(
    (field) =>
      field.type === "relation" &&
      field.options.target === object &&
      !field.standard,
  );
  const groups = [];
  for (const field of relations) {
    const filter = EXTENSIBLE.has(field.object)
      ? { [`custom_fields.${field.name}`]: id }
      : { [field.name]: id };
    try {
      const { data, total } = await records.list(actor, field.object, {
        filter,
        perPage: 50,
      });
      groups.push({
        object: field.object,
        field: field.name,
        label: field.label,
        total,
        data,
      });
    } catch (error) {
      if (!(error instanceof CrmRefusal)) throw error;
    }
  }
  return groups;
}
