import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppVariables } from "../auth/guards";
import type { Database } from "../db/client";
import { actorForApiKey } from "./api-keys";
import { crmErrorResponse } from "./errors";
import { openApiDocument } from "./openapi";
import { runReport } from "./platform-routes";
import type { CrmRecords } from "./records";
import { CrmRefusal } from "./refusal";

type Variables = { Variables: AppVariables };

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_PER_PAGE = 200;
const WINDOW_MS = 60_000;
export const REQUESTS_PER_MINUTE = 600;

// Resources beyond the data model's objects that integrations need: notes, tags and the team.
const EXTRA_RESOURCES = new Set([
  "contact_notes",
  "deal_notes",
  "tags",
  "sales",
]);

const idOf = (raw: string) => {
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new CrmRefusal("Not found.", 404);
  return id;
};

/**
 * The public API, under /api/v1: the CRM's records for other software, with an API key instead of a
 * session. The same records layer as the app, so a key can do exactly what its owner's role allows.
 */
export function createPublicApi(deps: {
  database: Database;
  records: CrmRecords;
  apiUrl: string;
  productName: string;
}) {
  const { database, records } = deps;
  const routes = new Hono<Variables>();
  const windows = new Map<number, { start: number; count: number }>();

  routes.use("*", async (context, next) => {
    const header = context.req.header("authorization") ?? "";
    const key = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : "";
    const found = key ? await actorForApiKey(database, key) : null;
    if (!found) {
      return context.json(
        { error: "Send a valid API key: Authorization: Bearer <key>." },
        401,
      );
    }
    const now = Date.now();
    const current = windows.get(found.keyId);
    const window =
      current && now - current.start < WINDOW_MS
        ? { ...current, count: current.count + 1 }
        : { start: now, count: 1 };
    windows.set(found.keyId, window);
    if (window.count > REQUESTS_PER_MINUTE) {
      context.header(
        "Retry-After",
        String(Math.ceil((window.start + WINDOW_MS - now) / 1000)),
      );
      return context.json(
        {
          error: `Slow down: ${REQUESTS_PER_MINUTE} requests a minute per key.`,
        },
        429,
      );
    }
    context.set("actor", found.actor);
    await next();
  });
  routes.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (context) =>
        context.json({ error: "That's too large to save." }, 413),
    }),
  );

  const resource = async (name: string) => {
    if (EXTRA_RESOURCES.has(name)) return name;
    const objects = await records.metadata.objects();
    if (!objects.some((object) => object.name === name)) {
      throw new CrmRefusal("Unknown object.", 404);
    }
    return name;
  };

  // The data model as the key's owner may see it: objects they can read, minus hidden fields.
  const model = async (actor: AppVariables["actor"]) => {
    const access = await records.accessFor(actor);
    const { objects, fields } = await records.metadata.load();
    const readable = objects.filter(
      (object) => access.reach(object.name, "read") !== "none",
    );
    return {
      objects: readable,
      fields: fields.filter(
        (field) =>
          readable.some((object) => object.name === field.object) &&
          !access.hidden(field.object).includes(field.name),
      ),
    };
  };

  routes.get("/", (context) =>
    context.json({
      data: {
        name: `${deps.productName} API`,
        openapi: `${deps.apiUrl}/api/v1/openapi.json`,
      },
    }),
  );

  routes.get("/openapi.json", async (context) => {
    const { objects, fields } = await model(context.var.actor);
    return context.json(
      openApiDocument(
        objects,
        fields,
        `${deps.apiUrl}/api/v1`,
        deps.productName,
      ),
    );
  });

  routes.get("/me", async (context) =>
    context.json({ data: await records.sale(context.var.actor) }),
  );

  routes.get("/objects", async (context) =>
    context.json({ data: await model(context.var.actor) }),
  );

  routes.post("/reports", async (context) =>
    context.json({
      data: await runReport(
        records,
        context.var.actor,
        await context.req.json().catch(() => null),
      ),
    }),
  );

  routes.get("/:object", async (context) => {
    const name = await resource(context.req.param("object"));
    const query = new URL(context.req.url).searchParams;
    const page = Math.max(1, Number(query.get("page")) || 1);
    const perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, Number(query.get("per_page")) || 50),
    );
    let filter: unknown = {};
    try {
      filter = JSON.parse(query.get("filter") ?? "{}");
    } catch {
      throw new CrmRefusal("The filter is not valid JSON.", 400);
    }
    const { data, total } = await records.list(context.var.actor, name, {
      filter,
      sort: query.get("sort"),
      order: query.get("order"),
      page,
      perPage,
    });
    return context.json({ data, total, page, per_page: perPage });
  });

  routes.get("/:object/:id", async (context) => {
    const name = await resource(context.req.param("object"));
    const row = await records.get(
      context.var.actor,
      name,
      idOf(context.req.param("id")),
    );
    if (!row) throw new CrmRefusal("Not found.", 404);
    return context.json({ data: row });
  });

  routes.post("/:object", async (context) => {
    const name = await resource(context.req.param("object"));
    const row = await records.create(
      context.var.actor,
      name,
      await context.req.json().catch(() => null),
    );
    return context.json({ data: row }, 201);
  });

  for (const method of ["patch", "put"] as const) {
    routes[method]("/:object/:id", async (context) => {
      const name = await resource(context.req.param("object"));
      const row = await records.update(
        context.var.actor,
        name,
        idOf(context.req.param("id")),
        await context.req.json().catch(() => null),
      );
      if (!row) throw new CrmRefusal("Not found.", 404);
      return context.json({ data: row });
    });
  }

  routes.delete("/:object/:id", async (context) => {
    const name = await resource(context.req.param("object"));
    const row = await records.remove(
      context.var.actor,
      name,
      idOf(context.req.param("id")),
    );
    if (!row) throw new CrmRefusal("Not found.", 404);
    return context.json({ data: row });
  });

  routes.onError(crmErrorResponse);
  return routes;
}
