import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { AuthenticatedActor } from "../auth/guards";
import type { Database } from "../db/client";
import { userRoles, users } from "../db/schema";
import { apiKeys, sales } from "./schema";

const KEY = /^mgp_([a-z0-9]{10})_([a-z0-9]{40})$/;
const USED_EVERY_MS = 60_000;

const hashOf = (key: string) => createHash("sha256").update(key).digest("hex");
const random = (bytes: number, length: number) =>
  randomBytes(bytes).toString("hex").slice(0, length);

export type ApiKeyRow = Omit<typeof apiKeys.$inferSelect, "hash">;

const visible = {
  id: apiKeys.id,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  sales_id: apiKeys.sales_id,
  last_used_at: apiKeys.last_used_at,
  revoked_at: apiKeys.revoked_at,
  created_at: apiKeys.created_at,
  updated_at: apiKeys.updated_at,
};

/** A new key for a person: the whole key is returned once, and only its hash is kept. */
export async function createApiKey(
  database: Database,
  salesId: number,
  name: string,
) {
  const prefix = random(5, 10);
  const key = `mgp_${prefix}_${random(20, 40)}`;
  const [row] = await database
    .insert(apiKeys)
    .values({ name, prefix, hash: hashOf(key), sales_id: salesId })
    .returning(visible);
  return { key, row };
}

/** A person's keys, or everyone's for an admin, newest first, with whose they are. */
export function listApiKeys(database: Database, salesId: number | null) {
  return database
    .select({
      ...visible,
      owner_first_name: sales.first_name,
      owner_last_name: sales.last_name,
    })
    .from(apiKeys)
    .innerJoin(sales, eq(sales.id, apiKeys.sales_id))
    .where(salesId === null ? undefined : eq(apiKeys.sales_id, salesId))
    .orderBy(desc(apiKeys.id));
}

export async function revokeApiKey(
  database: Database,
  id: number,
  salesId: number | null,
) {
  const [row] = await database
    .update(apiKeys)
    .set({ revoked_at: new Date().toISOString() })
    .where(
      and(
        eq(apiKeys.id, id),
        isNull(apiKeys.revoked_at),
        salesId === null ? undefined : eq(apiKeys.sales_id, salesId),
      ),
    )
    .returning(visible);
  return row;
}

/**
 * The person a key acts as, with the role they have now: a revoked key, a disabled person or one who
 * no longer has access gets nothing.
 */
export async function actorForApiKey(
  database: Database,
  key: string,
): Promise<{ actor: AuthenticatedActor; keyId: number } | null> {
  const match = KEY.exec(key);
  if (!match) return null;
  const [row] = await database
    .select({
      id: apiKeys.id,
      hash: apiKeys.hash,
      disabled: sales.disabled,
      user_id: sales.user_id,
    })
    .from(apiKeys)
    .innerJoin(sales, eq(sales.id, apiKeys.sales_id))
    .where(and(eq(apiKeys.prefix, match[1]), isNull(apiKeys.revoked_at)));
  if (!row || row.disabled || !row.user_id) return null;
  const expected = Buffer.from(row.hash, "hex");
  const given = Buffer.from(hashOf(key), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const [user] = await database
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, row.user_id));
  const roles = (
    await database
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, row.user_id))
  ).map((each) => each.role);
  if (!user || !roles.length) return null;
  await database
    .update(apiKeys)
    .set({ last_used_at: new Date().toISOString() })
    .where(
      and(
        eq(apiKeys.id, row.id),
        or(
          isNull(apiKeys.last_used_at),
          lt(
            apiKeys.last_used_at,
            new Date(Date.now() - USED_EVERY_MS).toISOString(),
          ),
        ),
      ),
    );
  return {
    keyId: row.id,
    actor: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roles.includes("admin") ? "admin" : "user",
    },
  };
}
