import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ZodError } from "zod";
import type { AppVariables } from "../auth/guards";
import type { Database } from "../db/client";
import { fileResponse, MAX_CRM_FILE_BYTES, storeFile } from "./files";
import { CrmQueryError, listParamsFrom } from "./filters";
import type { CrmMail } from "./mail";
import { createMailRoutes } from "./mail-routes";
import { CrmRefusal, createCrmRecords } from "./records";
import { globalSearch, SEARCH_RESOURCES, type SearchResource } from "./search";

type Variables = { Variables: AppVariables };

const MAX_RECORD_BYTES = 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

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

/**
 * The CRM's data API: the list, read and write operations react-admin's data provider makes, for every
 * resource in CRM_RESOURCES, plus global search. Everybody signed in reads everything; sales and the
 * configuration are changed by admins only, as in Atomic CRM. Mounted at /api/crm.
 */
export function createCrmRoutes(deps: {
  requireUser: MiddlewareHandler<Variables>;
  database: Database;
  mail?: CrmMail;
}) {
  const { database } = deps;
  const routes = new Hono<Variables>();
  routes.use("*", deps.requireUser);
  const recordLimit = bodyLimit({
    maxSize: MAX_RECORD_BYTES,
    onError: (context) =>
      context.json({ error: "That's too large to save." }, 413),
  });
  const fileLimit = bodyLimit({
    maxSize: MAX_CRM_FILE_BYTES + MULTIPART_OVERHEAD_BYTES,
    onError: (context) =>
      context.json({ error: "Files must be 20 MB or smaller." }, 413),
  });
  routes.use("*", (context, next) =>
    (context.req.path.endsWith("/files") ? fileLimit : recordLimit)(
      context,
      next,
    ),
  );

  const records = createCrmRecords(database);
  const notFound = { error: "Not found." };

  if (deps.mail) {
    routes.route("/mail", createMailRoutes({ mail: deps.mail, records }));
  }

  routes.get("/me", async (context) =>
    context.json({ data: await records.sale(context.var.actor) }),
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

  routes.post("/files", async (context) => {
    const form = await context.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return context.json({ error: "Send a file in the 'file' field." }, 400);
    }
    if (file.size > MAX_CRM_FILE_BYTES) {
      return context.json({ error: "Files must be 20 MB or smaller." }, 413);
    }
    const sale = await records.sale(context.var.actor);
    return context.json(
      { data: await storeFile(database, file, sale.id) },
      201,
    );
  });

  routes.get(
    "/files/:id",
    async (context) =>
      (await fileResponse(database, context.req.param("id"))) ??
      context.json(notFound, 404),
  );

  routes.get("/:resource", async (context) =>
    context.json(
      await records.list(
        context.req.param("resource"),
        listParamsFrom(new URL(context.req.url).searchParams),
      ),
    ),
  );

  routes.get("/:resource/:id", async (context) => {
    const row = await records.get(
      context.req.param("resource"),
      parseId(context.req.param("id")),
    );
    return row ? context.json({ data: row }) : context.json(notFound, 404);
  });

  routes.post("/:resource", async (context) => {
    const row = await records.create(
      context.var.actor,
      context.req.param("resource"),
      await context.req.json().catch(() => null),
    );
    return context.json({ data: row }, 201);
  });

  routes.put("/:resource/:id", async (context) => {
    const row = await records.update(
      context.var.actor,
      context.req.param("resource"),
      parseId(context.req.param("id")),
      await context.req.json().catch(() => null),
    );
    return row ? context.json({ data: row }) : context.json(notFound, 404);
  });

  routes.put("/:resource", async (context) => {
    const ids = await records.updateMany(
      context.var.actor,
      context.req.param("resource"),
      parseIds(context.req.query("ids")),
      await context.req.json().catch(() => null),
    );
    return context.json({ data: ids });
  });

  routes.delete("/:resource/:id", async (context) => {
    const row = await records.remove(
      context.var.actor,
      context.req.param("resource"),
      parseId(context.req.param("id")),
    );
    return row ? context.json({ data: row }) : context.json(notFound, 404);
  });

  routes.delete("/:resource", async (context) => {
    const ids = await records.removeMany(
      context.var.actor,
      context.req.param("resource"),
      parseIds(context.req.query("ids")),
    );
    return context.json({ data: ids });
  });

  routes.onError((error, context) => {
    if (error instanceof CrmRefusal) {
      return context.json({ error: error.message }, error.status);
    }
    if (error instanceof CrmQueryError) {
      return context.json({ error: error.message }, 400);
    }
    if (error instanceof ZodError) {
      const [issue] = error.issues;
      const field = issue?.path.join(".");
      return context.json(
        {
          error: issue
            ? `${field ? `${field}: ` : ""}${issue.message}`
            : "Check the form.",
        },
        400,
      );
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
