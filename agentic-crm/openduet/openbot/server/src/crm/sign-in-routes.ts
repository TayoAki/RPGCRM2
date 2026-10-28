import { Hono } from "hono";
import type { AppVariables } from "../auth/guards";
import type { Database } from "../db/client";
import { CrmRefusal } from "./refusal";
import {
  createScimToken,
  listScimTokens,
  revokeScimToken,
} from "./scim-tokens";

type Variables = { Variables: AppVariables };

/**
 * What the CRM's sign-in settings need beyond OpenDuet's own identity-provider routes: the URLs to give
 * a company's identity provider, and the SCIM tokens for its directory. Admins only.
 */
export function createSignInRoutes(deps: {
  database: Database;
  publicUrl?: string;
  env?: Record<string, string | undefined>;
}) {
  const { database } = deps;
  const env = deps.env ?? process.env;
  const routes = new Hono<Variables>();

  routes.use("/sign-in/*", async (context, next) => {
    if (context.var.actor.role !== "admin") {
      throw new CrmRefusal("Only an admin can change how people sign in.", 403);
    }
    await next();
  });

  routes.get("/sign-in/setup", async (context) => {
    const base = (deps.publicUrl ?? env.BETTER_AUTH_URL ?? "").replace(
      /\/$/,
      "",
    );
    return context.json({
      data: {
        auth_url: `${base}/api/auth`,
        scim_url: `${base}/api/auth/scim/v2`,
        scim_from_environment: Boolean(env.SCIM_BEARER_TOKEN?.trim()),
        scim_tokens: await listScimTokens(database),
      },
    });
  });

  routes.post("/sign-in/scim-tokens", async (context) => {
    const { token, row } = await createScimToken(
      database,
      context.var.actor.id,
    );
    return context.json({ data: { ...row, token } }, 201);
  });

  routes.delete("/sign-in/scim-tokens/:id", async (context) => {
    const id = Number(context.req.param("id"));
    const row = Number.isSafeInteger(id)
      ? await revokeScimToken(database, id)
      : undefined;
    if (!row) throw new CrmRefusal("Not found.", 404);
    return context.json({ data: row });
  });

  return routes;
}
