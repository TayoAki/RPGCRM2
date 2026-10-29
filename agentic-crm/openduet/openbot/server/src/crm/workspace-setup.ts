import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppVariables } from "../auth/guards";
import { type PasswordPeople, setPasswordPath } from "../auth/email-password";
import type { Database } from "../db/client";
import { accounts, users } from "../db/schema";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Lets the sign-up service hand a new workspace's owner their set-password link, so nobody copies it
 * out of the logs. Answers only with WORKSPACE_SETUP_TOKEN, and only until the owner has a password.
 */
export function createWorkspaceSetupRoutes(deps: {
  database: Database;
  passwordPeople: PasswordPeople;
  env?: Record<string, string | undefined>;
}) {
  const env = deps.env ?? process.env;
  const routes = new Hono<{ Variables: AppVariables }>();

  routes.post("/owner-link", async (context) => {
    const token = env.WORKSPACE_SETUP_TOKEN?.trim();
    const email = env.WORKSPACE_OWNER_EMAIL?.trim().toLowerCase();
    if (!token || !email) return context.json({ error: "Not found." }, 404);
    const given = (context.req.header("authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!timingSafeEqual(digest(given), digest(token))) {
      return context.json({ error: "Not allowed." }, 401);
    }

    const [owner] = await deps.database
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email));
    if (owner) {
      const [withPassword] = await deps.database
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(eq(accounts.userId, owner.id), isNotNull(accounts.password)),
        );
      if (withPassword) {
        return context.json(
          { error: "The owner has set a password already." },
          409,
        );
      }
    }
    const setPasswordToken = owner
      ? await deps.passwordPeople.issueLink(email)
      : (
          await deps.passwordPeople.add({
            email,
            name: env.WORKSPACE_OWNER_NAME?.trim() || email.split("@")[0],
          })
        ).token;
    const base = (env.APP_PUBLIC_URL ?? env.BETTER_AUTH_URL ?? "").replace(
      /\/$/,
      "",
    );
    return context.json({
      link: `${base}${setPasswordPath(setPasswordToken)}`,
    });
  });

  return routes;
}
